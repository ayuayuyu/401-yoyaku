## やることリスト
- DBに保存はされてそうだけどカレンダーに自分の登録したやつが見れない（他の人もそうだとおもう）修正が必要
- 現在は、カレンダーに表示される場合は、面接というタイトルならば面接というものが表示されるとおもうがそれを予約者の名前が表示されるように修正をする、
- カレンダーで現在時刻よりも過去の時間に予約をしようとしていたらエラーなので期日が過ぎていますなどのエラーを表示する。（過去には予約をできなくする）
- できているか確認をしていないマイページにて自分の予約しているものの一番近い予定順にソートされて予定が表示されるようにする。
- このシステムに予定を登録したらGoogleカレンダーにも同期をされるようにしたい。
- slac botで日程が追加されたことを表示したい。
- 予約する時間は9時から22時までにしたい。
- カレンダーをもっとみやすくする
- ヘッダーがついてくるようにしたい
- コピーライトはどうしようか迷っている

## 今回の対応
- [x] 週間表示で予約が出ない原因だった取得条件の順番を修正した。
- [x] 月表示で前月・当月・翌月の予約をまとめて取得し、表示中の他月の日付にも予約を出すようにした。
- [x] フロントの入力制約とバックエンドの検証ロジックが同じ条件を見ていることを確認した。

## Review
- `cd yoyaku-backendo/src && go test ./...` 成功。
- `cd yoyaku-frontend && pnpm build` 成功。

## 今回の追加対応
- [x] 週間表示と日間表示で、予約を開始時刻の1枠だけでなく予約時間分の高さで表示するようにした。

## Review
- `cd yoyaku-backendo/src && go test ./...` 成功。
- `cd yoyaku-frontend && pnpm build` 成功。
## 今回の対応 (2026-09-08): env ファイルの一本化
- [x] `backend/.env` を廃止。全キーが compose 直書き / ルート `.env` に同一値で存在し、固有の値は無かった (MySQL 時代の `DATABASE_URL`・`MYSQL_*`・`GOPATH` は破棄)。
- [x] `backend/docker-compose.yaml` (`../yoyaku-frontend` 参照で起動不可) と `backend/Makefile` (`login` が mysql) を削除。起動はルート `Makefile` に一本化。
- [x] `frontend/.env` を廃止。`next.config.ts` がルート `.env` から `NEXT_PUBLIC_API_URL` を読む。
- [x] ルート `docker-compose.yaml` を `env_file: .env` 化し、`GOOGLE_CLIENT_SECRET` 等の直書きを撤去。
- [x] ルート `.gitignore` を新設 (従来は個人のグローバル gitignore 頼みで、他マシンでは `.env` が追跡され得た)。
- [x] `.env.example` を追加。
- [x] 本番 env を `~/.401-yoyaku.env` → `/etc/401-yoyaku/.env` へ移動 (runner の `$HOME` が空で Deploy が失敗していた原因)。移行は `setup-container.sh` が自動で行う。
- [x] CLAUDE.md / README / 仕様書 / skill.md の旧パス (`yoyaku-backendo/`, `yoyaku-frontend/`) を修正。

## Review
- `cd backend/src && gofmt -l . / go vet ./... / go build ./... / go test ./...` すべて成功。
- `frontend`: `tsc --noEmit` / `next lint` / `next build` 成功。
- `docker compose config`: backend に全キー、frontend は `NEXT_PUBLIC_API_URL` のみ注入されることを確認。
- ホストビルド (env 未設定) で `http://localhost:8080` がルート `.env` から焼き込まれることを確認。
- 本番相当 (`NEXT_PUBLIC_API_URL=""`) では `localhost:8080` が 0 件 = same-origin 維持を確認。
- `docker compose up -d` で `/health` 200、`/login` が Google OAuth へ 307、フロント 200 を確認。

### 未対応 (要ユーザー対応)
- [ ] `GOOGLE_CLIENT_SECRET` のローテーション。ファイルからは除去したが public リポジトリの履歴 (初回コミット `a92dc8a`) に残っている。
- [ ] 本番 LXC で `bash scripts/setup-container.sh` を再実行し、env を `/etc/401-yoyaku/.env` へ移行する。
