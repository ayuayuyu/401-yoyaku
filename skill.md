# skill.md — 401号室予約管理プロジェクトで使用している技術スタック

このドキュメントは本プロジェクトで採用している技術と、習得・確認が必要なスキル領域をまとめたものです。

---

## フロントエンド

### コア

| 技術 | バージョン | 用途・備考 |
|---|---|---|
| TypeScript | ^5 | 型付き JavaScript |
| Next.js | 15.3.4 | App Router、Turbopack 開発、`output: 'export'` で静的書き出し |
| React | ^19 | UI ライブラリ |
| Node.js | 22 (Docker) | ランタイム |

### UI / 状態管理

| 技術 | バージョン | 用途 |
|---|---|---|
| Schedule-X | ^4.5 | カレンダー UI (`@schedule-x/react`, `calendar`, `events-service`, `calendar-controls`, `theme-default`) |
| Jotai | ^2.12 | 軽量グローバル状態 (現状はログインユーザのみ) |
| Sass (SCSS Modules) | ^1.89 | スタイリング。`additionalData` で共通モジュールを自動注入 |
| temporal-polyfill | 0.3 | Schedule-X が要求する Temporal API のポリフィル |

### 通信

| 技術 | バージョン | 用途 |
|---|---|---|
| axios | ^1.10 | API クライアント (`withCredentials: true` でセッション Cookie を送信) |

### 開発ツール

- ESLint + `eslint-config-next`
- pnpm (ローカル開発推奨)、npm (Docker ビルドが `npm ci` を使用)

---

## バックエンド

### コア

| 技術 | バージョン | 用途 |
|---|---|---|
| Go | 1.22+ (`go.mod` 参照) | サーバ言語 |
| Gin | ^1 | HTTP フレームワーク |
| sqlc | latest | SQL → Go コード生成 |
| gorilla/sessions | - | Cookie ベースのセッション |
| gin-contrib/cors | - | CORS ミドルウェア |

### 認証

- **Google OAuth 2.0** — `golang.org/x/oauth2` + `golang.org/x/oauth2/google`
- セッション: HttpOnly Cookie (`SECRET_KEY` で署名)

### データベース

| 技術 | 用途 |
|---|---|
| PostgreSQL 16 | 本番 DB |
| `lib/pq` または `pgx` | ドライバ (`go.sum` 参照) |
| sqlc | コンパイル時に SQL を Go 型に変換。`query.sql` を編集して `sqlc generate` で再生成 |

### 開発ツール

- **Air** (`.air.toml`) — Go ホットリロード
- **Docker / docker-compose** — DB + バック + フロントの一括起動

---

## インフラ・デプロイ周り

| 技術 | 用途 |
|---|---|
| Docker / Docker Compose | ローカル開発環境 (postgres + go + next.js) |
| Makefile | `make up / down / logs / restart` のラッパ |

将来的な機能拡張で導入予定:

- **Google Calendar API** — 予約のカレンダー同期 (`GOOGLE_CALENDAR_SYNC_ENABLED`)
- **Slack Web API / Bot Token** — 予約通知 (`SLACK_NOTIFY_ENABLED`)

---

## 必要なスキル領域

### 必須

- **TypeScript / React Hooks** — `useEffect`, `useMemo`, `useRef`, `ResizeObserver` など (ReservationCalendar.tsx で多用)
- **Next.js App Router** — Server / Client コンポーネント、`'use client'` 境界、静的エクスポートの制約
- **Go の標準的な書き方** — レイヤー分離 (handler → service → db)、エラーハンドリング、context
- **SQL** — sqlc は生 SQL を書く前提。インデックス、トランザクション、論理削除パターン
- **OAuth 2.0** — 認可コードフロー、トークン保管、CSRF (state パラメータ)
- **セッション管理** — Cookie の Secure / HttpOnly / SameSite

### あると望ましい

- **Schedule-X** — カスタムコンポーネント、プラグイン (`events-service`, `calendar-controls`)、Temporal API
- **Docker Compose** — `depends_on`, `healthcheck`, ボリュームマウント
- **PostgreSQL の TIMESTAMPTZ** — タイムゾーン取扱い (本プロジェクトは `Asia/Tokyo`)
- **CSS の sticky / dvh / container query** — モバイル対応 (`100dvh`, `position: sticky`)
- **アクセシビリティ** — `:focus-visible`, ARIA, キーボード操作

### 今後追加で必要になる予定

- **Google Calendar API** クライアントライブラリ (`google.golang.org/api/calendar/v3`)
- **Slack Bolt for Go** または `slack-go/slack` SDK
- **Cron / スケジューラ** (リマインダ機能を入れる場合)

---

## 学習リソース (参考)

- Next.js 15 App Router: https://nextjs.org/docs/app
- Schedule-X: https://schedule-x.dev/
- sqlc: https://docs.sqlc.dev/
- Gin: https://gin-gonic.com/docs/
- Google OAuth (Go): https://pkg.go.dev/golang.org/x/oauth2/google
- Jotai: https://jotai.org/
- Temporal API: https://tc39.es/proposal-temporal/docs/

---

## 関連ドキュメント

- [CLAUDE.md](CLAUDE.md) — プロジェクトの構造とコマンド
- [todo.md](todo.md) — 未対応タスク一覧
- [backend/README.md](backend/README.md) — バックエンドのセットアップ手順
- [frontend/README.md](frontend/README.md) — フロントのセットアップ手順
