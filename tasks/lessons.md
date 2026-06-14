# Lessons

このプロジェクトで得た再発防止の知見。作業開始時にレビューする。

## 予約が初回ロード/作成直後に表示されない (2026-06-14)

**症状:** リロードでは表示されないが、月を移動して戻すと表示される。

**真因 (これが本丸):**
- Schedule-X 4.x の `onRangeUpdate` は **初回の range セット時には発火しない**。
  `core.js` の `callOnRangeUpdate` に `if (!wasInitialized) return (wasInitialized = true)` があり、
  最初の range 確定では `wasInitialized` を立てて return するだけ。2回目以降の range 変更でのみ発火。
- そのため `onRangeUpdate` で初回ロードしていたコードは初期表示が空になり、`rangeRef` も
  未設定のまま → 予約作成後の `refreshKey` リフェッチも `!rangeRef.current` で早期 return。
- 月移動だけは range が変わり `onRangeUpdate` が発火するので表示された。

**対策:**
- range ベースの読み込みは **`callbacks.fetchEvents` に一本化する**。
  型: `fetchEvents?: (range: DateRange) => Promise<CalendarEventExternal[]>`。
  ドキュメント記載どおり「**once on render** + onRangeUpdate のたび」呼ばれる (`useFetchEvents`)。
  戻り値の配列を Schedule-X が `$app.calendarEvents.list` にセットするので自前 set 不要。
- mutation 後 (range 変更なし) の手動リフェッチは別途 `eventsService.set()` で行う。
  `rangeRef` は fetchEvents が初回に埋めるので以降は有効。
- `DateRange.start/end` は `Temporal.ZonedDateTime`。

## Schedule-X (React) の customComponents 安定化 (二次的だが重要)

- `@schedule-x/react` の `ScheduleXCalendar` は `customComponents` の **参照が変わるたびに**
  `calendarApp.destroy() → render()` を実行する (内部 useEffect 依存に customComponents)。
- 毎レンダー新しいオブジェクト/関数を渡すと再生成され、描画がちらつき余計な再フェッチも走る。
- → `customComponents` は **必ず `useMemo([])` で安定化**。コールバックは ref 越し (`xxxRef.current()`) で呼ぶ。
- `useNextCalendarApp(config, plugins)` の **第2引数は依存配列ではなくプラグイン配列**。
  内部 useEffect は `[]` でマウント時1回だけ生成。ここに値を入れても再生成されない (number を混ぜない)。

## 月表示の「他 N件」が出ない / nEventsPerDay が反映されない (2026-06-14)

**症状:** 1日の予約が表示上限を超えても「他 N件」インジケータが見えず、もっとあるのに無いように見える。

**原因2つ:**
- 月セル `.sx__month-grid-day` は block 配置で、`.sx__month-grid-day__events-more`(「他 N件」)が
  最後の子。セル高に収まらないと `overflow:hidden` で最初に切られて消える。
- `monthGridOptions.nEventsPerDay` を ResizeObserver で算出していたが、`useNextCalendarApp` は
  アプリを1度しか生成せず公開 setter も無いため、算出値は**実際には反映されず初期値(3)に固定**だった。

**対策:**
- CSS: `.sx__month-grid-day` を `display:flex; flex-direction:column` にし、header と events-more を
  `flex:0 0 auto`(常時表示)、events を `flex:1 1 auto; min-height:0; overflow:hidden`(ここだけ縮む)。
- nEventsPerDay 反映: Schedule-X は `$app.config.monthGridOptions`(Signal)を購読しているので、
  `(calendar as ...).$app.config.monthGridOptions.value = {...v, nEventsPerDay}` で **再生成なしに**更新。
  ※ `CalendarApp.$app` は型上 private なので構造的 cast が必要(統合の継ぎ目として割り切る)。
- 件数算出時に events-more の高さ分を控除し、表示件数+インジケータがセルに収まるようにする(件数も正確に)。

## 月表示はドットではなく予約者名チップで表示する (2026-06-14)

**ユーザー修正:** 月セルを色ドットだけにしたら「誰が入れたか分からない」と差し戻し依頼。

- 月セルの予約は **Schedule-X 既定の名前チップ表示**(時刻 + タイトル=予約者名)に戻す。
  `customComponents.monthGridEvent` は **入れない**(入れるとドット等のカスタム描画になる)。
- 表示上限超過時は **時刻順ソート + 「他 N件」**(`'+ {{n}} events' → '他 {{n}} 件'`)で集約。
  ソートと集約は Schedule-X 月グリッドの既定動作。翻訳だけ差し替えればよい(旧 `'...'` は不可)。
- 件数算出 `computeEventsPerDay` は **チップ高さ(24px)+gap ベース**(セル高のみ)。ドット用の
  幅×高さ折り返し計算には戻さない。nEventsPerDay の signal 反映(別 lesson)は維持する。
- CSS は `.sx__month-grid-event`(チップ装飾)/`-title`(ellipsis)/`-time` を活かす。
  ドット用の `.sx__month-grid-day` flex 化や `.rsv-dot`、チップ打ち消しは入れない。

## Schedule-X の translations が効かず「+ {{n}} events」が生で出る (2026-06-14)

**症状:** 月セルの「他 N件」が英語キーのまま `+ {{n}} events` 表示。`{{n}}` も数値に補間されない。

**真因 (2点が重なる):**
- `translate` (core.js): `languages.value[locale.replaceAll('-','')]` で言語を引く。
  つまり照合キーは **ハイフン除去後** (`ja-JP` → `jaJP`)。見つからないと `return key`(=生キー、補間なし)。
- カスタム翻訳は **マージされず丸ごと置換**される: `withTranslations(config.translations || builtinTranslations)`。
- → `translations: { 'ja-JP': {...} }`(ハイフン有り)で渡すと `languages['jaJP']` が undefined になり、
  組み込み jaJP も置換で消えるため、全ラベルがキー文字列のまま出る。

**対策:**
- 翻訳キーは **`jaJP`(ハイフン無し)** にする。`locale` 自体は `'ja-JP'`(regex 検証あり)のままでよい。
- 置換仕様のため、上書きしたいキーだけでなく **組み込み jaJP 辞書を再掲して**渡す
  (`ReservationCalendar.tsx` の `JA_JP_TRANSLATIONS`)。でないと他の日本語表示が英語キーに落ちる。
- 月の超過件数キーは `'+ {{n}} events'` / `'+ 1 event'`。`Link to {{n}} more events on {{date}}` は aria 用。

## 本人 Google カレンダー連携 (OAuth + refresh token) (2026-06-14)

- **本人カレンダー**に書くには userinfo スコープに `calendar.events` を追加し、
  ログインURLを `AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.ApprovalForce)` にして
  **refresh token を取得→users.google_refresh_token に保存**。`Exchange` のトークンは破棄せず返すこと。
- 予約作成時は `GoogleOauthConfig.TokenSource(ctx, &oauth2.Token{RefreshToken: rt})` +
  `calendar.NewService(option.WithTokenSource(ts))` で `primary` に `Events.Insert`。**ベストエフォート**
  (失敗しても予約は成功扱い、レスポンスに `google_calendar: added|needs_relogin|failed`)。
- **スコープ追加は全ユーザー再ログイン(再同意)が必要**。Google Cloud 側で Calendar API 有効化と
  同意画面へのスコープ追加も必須。
- dev DB は db-data 永続のため schema.sql 変更は再実行されない →
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` を流すかボリューム再作成が必要。
