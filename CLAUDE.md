# CLAUDE.md

このファイルは Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイドです。

## プロジェクト概要

**401号室予約管理アプリケーション** — 会議室「401号室」の予約を管理するための Web アプリケーション。Google アカウントでログインし、月/週/日表示のカレンダーで予約を作成・確認できる。

リポジトリは以下の2つのサービスで構成されるモノレポ:

| ディレクトリ | 役割 | スタック |
|---|---|---|
| [yoyaku-frontend/](yoyaku-frontend/) | Web UI | Next.js 15 (App Router) / React 19 / TypeScript / Schedule-X / Jotai |
| [yoyaku-backendo/](yoyaku-backendo/) | REST API | Go / Gin / sqlc / PostgreSQL / Google OAuth |

`docker-compose.yaml` でフロント・バック・DB をまとめて起動できる。

---

## 開発コマンド

### 全体起動 (Docker)

```bash
make -C yoyaku-backendo up      # build & up (backend + frontend + postgres)
make -C yoyaku-backendo down    # down
make -C yoyaku-backendo logs    # follow logs
```

ポート: フロント `3000`、バックエンド `8080`、PostgreSQL `55432`。

### フロントエンド単独 ([yoyaku-frontend/](yoyaku-frontend/))

```bash
pnpm install
pnpm dev          # Turbopack 開発サーバ
pnpm build        # 静的エクスポート (out/)
pnpm lint
```

> 注意: Dockerfile は `npm ci` を使うため `package-lock.json` も保持している。ローカル開発は `pnpm` 推奨。

### バックエンド単独 ([yoyaku-backendo/src/](yoyaku-backendo/src/))

```bash
cd yoyaku-backendo/src
sqlc generate     # query.sql → query.sql.go
go test ./...
go run .
```

ホットリロードは Air (`.air.toml`) を使用。Docker 起動時は自動的に有効。

---

## アーキテクチャ

### バックエンド ([yoyaku-backendo/src/](yoyaku-backendo/src/))

レイヤー構成:

```
handler/  ← HTTP ハンドラ (Gin)
service/  ← ビジネスロジック
db/       ← sqlc 生成のクエリ (query.sql.go, models.go)
auth/     ← Google OAuth
utils/    ← DB 接続・認証ヘルパ
types/    ← リクエスト型
```

- エントリポイント: [main.go](yoyaku-backendo/src/main.go) — Gin ルーティング、CORS、セッション
- セッション: `gorilla/sessions` の Cookie ストア (`SECRET_KEY` 必須)
- 認証: Google OAuth 2.0 (`auth/google_oauth.go`)
- DB アクセス: sqlc 経由のみ (生クエリは `db/query.sql` に集約)

#### API ルート

| Method | Path | 説明 |
|---|---|---|
| GET | `/login` | Google OAuth 開始 |
| GET | `/callback` | OAuth コールバック |
| GET | `/api/me` | ログインユーザ情報 |
| POST | `/api/logout` | ログアウト |
| POST | `/api/reservations` | 予約作成 |
| PUT | `/api/reservations` | 予約編集 |
| GET | `/api/reservations` | 予約一覧 (`?month=` / `?start=&end=` / `?date=` で切替) |
| GET | `/api/reservations/me` | 自分の予約一覧 |
| PUT | `/api/reservations/cancel` | 予約キャンセル |

### フロントエンド ([yoyaku-frontend/src/](yoyaku-frontend/src/))

- **ルーティング**: App Router、`output: 'export'` で静的書き出し
- **UI 状態**: ローカル `useState` 中心、認証ユーザのみ Jotai (`store/user.ts`)
- **カレンダー**: Schedule-X (`@schedule-x/react`)。月/週/日表示を `currentView` で切替
- **API クライアント**: `lib/apiClient.ts` で axios インスタンスを管理 (`withCredentials: true`)
- **スタイリング**: SCSS Modules + 共通変数 (`styles/modules/_colors.scss` 等)。`next.config.ts` の `additionalData` で全モジュールに `@use "@/styles/modules" as *;` を自動注入

主要ディレクトリ:

```
src/app/                 ← Next.js ルート (page.tsx, layout.tsx, not-found.tsx)
src/components/
  base/                  ← header / footer / feedbackModal など共通
  auth/                  ← ログイン画面
  dashboard/             ← ログイン後のダッシュボード本体
    calendar/            ← Schedule-X ラッパ (ReservationCalendar.tsx)
    user/                ← マイ予約・プロフィール編集
  reservation/
    form/, modal/        ← 予約作成・編集モーダル
src/lib/
  apiClient.ts           ← axios インスタンス
  api/                   ← REST 呼び出し関数群 (1 関数 = 1 ファイル)
  calendar/              ← Schedule-X イベント変換
  datetime.ts            ← 日時フォーマッタ
src/store/user.ts        ← Jotai userAtom
src/types/               ← 共有型 (reservation など)
src/styles/              ← グローバル + 共通モジュール
src/instrumentation.ts   ← SSR 時の localStorage シム (Next.js 自動ロード)
```

### データモデル ([schema.sql](yoyaku-backendo/src/db/schema.sql))

- `users` — `id, name, email, google_id, avatar_url, role`、論理削除 (`deleted_at`)
- `reservations` — `id, user_id, title, start_time, end_time, status`、複合インデックス `(start_time, end_time)`

### 環境変数

**バックエンド** (docker-compose.yaml で注入):

```
DATABASE_URL                  postgres://user:password@db:5432/app?...
SECRET_KEY                    セッション署名キー (必須)
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
FRONTEND_URL                  http://localhost:3000
GOOGLE_CALENDAR_SYNC_ENABLED  Google Calendar 同期 (今後)
SLACK_NOTIFY_ENABLED          Slack 通知 (今後)
```

**フロントエンド** (`yoyaku-frontend/.env`):

```
NEXT_PUBLIC_API_URL           http://localhost:8080
```

---

## 規約とパターン

### API 関数の構成

`src/lib/api/` は **1 機能 = 1 ファイル** に分割する (`reservationsByWeek.ts`, `reservationsCancel.ts` など)。同一エンドポイントに対するクエリパラメータ違いも別ファイルとして書く方針。

### Schedule-X カレンダーのカスタマイズ

`ReservationCalendar.tsx` 内で:

- `customComponents.headerContentLeftAppend` でヘッダーに「新規予約」ボタンを差し込む
- `nEventsPerDay` はセル高さから JS で算出 (ResizeObserver + computeEventsPerDay)
- 翻訳は `translations['ja-JP']` で日本語化、`+ N events` を `...` に短縮

### スタイリング

- ボタン等のグローバル class は `:global(.sx__custom-...)` で記述し、コンテナの `.view` 配下にスコープして他に漏らさない
- 色は `_colors.scss` の変数を使用 ($color-blue, $color-white など)。Hover の暗色は変数化されていないので個別指定 (例: `#3367d6`)
- レスポンシブは `@media (max-width: 768px)` を `.container` 直下にまとめる

### sqlc

`db/query.sql` に SQL を書き、`sqlc generate` で `db/query.sql.go` を生成する。**生成ファイルは手で編集しない**。

---

## 既知の進行中タスク

[todo.md](todo.md) の「やることリスト」参照。代表的な未対応項目:

- カレンダーの予約タイトルを予約者名にする
- 過去日時への予約防止 (バリデーション + UI)
- マイページの予約直近順ソート
- Google Calendar 同期 (`GOOGLE_CALENDAR_SYNC_ENABLED`)
- Slack 通知 (`SLACK_NOTIFY_ENABLED`)
- 予約可能時間の 9–22 時制限

## 注意点

- [yoyaku-backendo/README.md](yoyaku-backendo/README.md) には MySQL と書かれているが実装は **PostgreSQL**。READMEの記述は古い
- `docker-compose.yaml` には `GOOGLE_CLIENT_SECRET` が直書きされている。本番に出す前に環境変数化が必要
- Air のビルド成果物 (`src/tmp/`, `src/yoyaku`) は `.gitignore` 済み

---

## CI/CD と push ゲート

品質ゲートは二層。詳細は [docs/ci-cd.md](docs/ci-cd.md)。

- **ローカル git hook（`.githooks/`）**: クローン後に `bash .githooks/setup.sh` で有効化（`core.hooksPath`）。
  - `commit-msg`: **Conventional Commits** を強制（違反はコミット拒否）。
  - `pre-commit`: staged の `*.go` を `gofmt -w` で**自動整形**して再ステージ。
  - `pre-push`: 変更領域を検査し、**lint/format/型/vet/test のいずれか失敗で push を中止**。
    緊急回避は `--no-verify`（CI が最終ゲート）。
- **GitHub Actions（[.github/workflows/ci.yml](.github/workflows/ci.yml)）**: push と master 宛て PR で実行。
  - frontend: `npm ci`→`lint`→`typecheck`(tsc --noEmit)→`build`
  - backend: `gofmt -l` チェック→`go vet`→`go build`→`go test`→`sqlc generate` 差分チェック
  - docker-build: frontend/backend の Dockerfile をビルド検証（CD の入口、push はしない）
  - commit-check: PR コミットの Conventional Commits 検証
- **パッケージマネージャ**: CI/Docker は **npm** 基準（`package-lock.json`）。`pnpm-lock.yaml` も同期済み。
  依存を変更したら `package-lock.json` と `pnpm-lock.yaml` の**両方**を更新してコミットする。
- push を実効的に制限するには GitHub 側で **master のブランチ保護**（PR 必須＋必須ステータスチェック）を設定する（手順は docs 参照）。
- コミット型の規約: `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`（破壊的変更は `!` 付き）。

---

## Loop Engineering（自走ループ）

「目的と停止条件だけを与え、実装判断はループ自身に任せる」開発スタイルを本リポジトリで実践するための基盤。
詳細は [docs/loop-engineering.md](docs/loop-engineering.md)。ループ定義は `loops/<名>/`、スキルは `.claude/skills/loop-*`。

### スキル

| スキル | 役割 |
|---|---|
| `/loop-init <名>` | 新規ループの雛形生成（目的・停止条件・検証・ガードレールを定義） |
| `/loop-audit <LOOP.md>` | Loop Readiness Score で起動可否を判定（**起動前に必ず**） |
| `/loop-verify <名>` | `loop-verifier` サブエージェント(**sonnet**＝本体と別モデル)で DoD 達成を採点 |
| `/loop-sync <名>` | STATE.md の主張と実態(git/test)の乖離＝理解負債を検知 |
| `/loop-status` | 全ループの進捗・検証判定を一覧 |

### 運用規約（必読）

- ループは `loops/<名>/` に **LOOP.md（憲法）** と **STATE.md（作業記憶）** を置く。実行は組込み `/loop`・`/schedule`。
- **起動前に必ず `/loop-audit`**。Red 判定のまま回さない。
- **検証は必ず別モデル**（`/loop-verify`）。本体が自分の成果を自己採点しない。
- STATE.md は **毎反復更新**し、`/loop-sync` でドリフトを確認する。主張は根拠（コマンド出力）とセットで書く。
- 停止条件（Definition of Done）は**機械的に検証可能**な形にする。曖昧なループは作らない。
- ループの学び・再発防止パターンは [tasks/lessons.md](tasks/lessons.md) に記録する。
- すぐ試せる実例: `loops/pr-guardian/`（PR を CI 緑・指摘対応済みに保つ。`gh` CLI 連携）。
