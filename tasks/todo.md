- [x] Review current mobile layout pain points
- [x] Remove custom date navigation
- [x] Place new reservation button inside calendar
- [x] Adjust calendar container spacing and typography for mobile

## Review
- [ ] Verify calendar usability on mobile widths
- [ ] Confirm week/day views remain scrollable to 22:00

## Fix: 予約が初回/作成直後に表示されない (2026-06-14)
- [x] 真因特定: Schedule-X 4.x の onRangeUpdate は初回 range セット時に発火しない(wasInitialized)。初回ロードが空になり rangeRef も未設定で refreshKey リフェッチも走らない
- [x] range ベース読み込みを callbacks.fetchEvents に一本化(初回レンダーでも発火する正規API)
- [x] mutation 後の手動リフェッチは eventsService.set で継続(rangeRef は fetchEvents が埋める)
- [x] 二次対応: customComponents を useMemo で安定化 / plugins から number(nEventsPerDay) 除去
- [x] tsc / lint / コンテナ再コンパイルで検証

---

# デプロイ基盤 実装プラン (Proxmox CT + Cloudflare Tunnel + Nginx + GHCR自動デプロイ) 2026-07-28 改訂

lab-presence(ayuayuyu/lab-presence) の CD を手本にする。**CTはビルドせず GHCR から pull するだけ**の2段パイプライン。

## 決定事項 (2026-07-28 確定)
- 実行形態: **Docker Compose(本番用)** を CT(LXC, `nesting=1`) 上で動かす
- パイプライン: **push(main) → build-images.yml が GHCR へ push → deploy.yml(workflow_run) が self-hosted runner で pull & up**
  (旧案の「CT で --build」は廃止。lab-presence どおり GHCR-pull に統一)
- レジストリ: **GHCR** `ghcr.io/ayuayuyu/401-backend` / `ghcr.io/ayuayuyu/401-nginx` (tags: `latest` + `<sha>`)
- 基準ブランチ: **main にリネーム**(現状 default は master) ← ユーザー確定
- cloudflared: **CT ホストに systemd 常駐**(lab-presence と同一)。compose には含めない ← ユーザー確定
- runner: **CT 自身を self-hosted runner(x64)** に登録 → SSH 鍵不要でローカル pull

## ターゲット構成
```
 ブラウザ ─HTTPS─▶ Cloudflare ─Tunnel─▶ cloudflared(CTホスト/systemd) ─http─▶ nginx:80
   nginx:  /  → out/ 静的配信(next export)
           /api/ /login /callback /health → backend:8080 (Go)
           backend ──▶ postgres:16 (永続volume)
```
- 公開ホスト名(例 `yoyaku.example.com`)にサイトも API も**同一オリジン**で集約 → CORS 不要・Cookie 問題回避
- nginx.conf はイメージに**焼き込む**(bind mount しない=CT側手作業ゼロ)

## Phase 1: 本番用イメージ & Compose
- [x] `backend/build/go/Dockerfile.prod` … multi-stage(golang→alpine、static binary、air 無し、`CGO_ENABLED=0 -ldflags '-s -w'`)
- [x] `frontend/Dockerfile.prod` … multi-stage(`next build`→`out/` を `nginx:alpine` へ COPY、`nginx.conf` も COPY)。`NEXT_PUBLIC_API_URL` は build-arg(prod は空="" =相対パス)
- [x] `frontend/nginx.conf` … `/`静的 + `/api/` `=/login` `=/callback` `=/health` を backend へ proxy(Host/X-Forwarded-Proto 付与)
- [x] `docker-compose.prod.yml` … db(永続volume/healthcheck) / backend(GHCR image + build fallback / env_file / healthcheck=/health) / nginx(GHCR image + build fallback / `80:80`)。**cloudflared は含めない**
- [x] `.env.prod.example` + `.gitignore` に `.env.prod` 追加

## Phase 2: バックエンド/フロント prod 小改修
- [x] `backend/src/auth/google_oauth.go`: RedirectURL を env `OAUTH_REDIRECT_URL`(default `http://localhost:8080/callback`)
- [x] `backend/src/main.go`: CORS `AllowOrigins` を env `CORS_ORIGINS`(default localhost) / **`GET /health` 追加** / セッション Cookie に Options(Path=/,HttpOnly,SameSite=Lax,`Secure=COOKIE_SECURE`)
- [x] `frontend/src/components/auth/login.tsx`: `(NEXT_PUBLIC_API_URL ?? '') + '/login'` に堅牢化(空文字=相対で `/login`)
- [x] `go test ./...` / `gofmt -l` / `npm run build` / `tsc --noEmit` 通過確認

## Phase 3: CI/CD Workflow
- [x] `.github/workflows/ci.yml`: `on:` に `workflow_call:` 追加 / `pull_request.branches` を `[main]` に
- [x] `.github/workflows/build-images.yml`: `on: push:[main]`。`uses: ./ci.yml`(テスト緑ゲート)→ build-backend / build-nginx を GHCR へ push(`linux/amd64`, gha cache, tags latest+sha, nginx は NEXT_PUBLIC_API_URL build-arg)
- [x] `.github/workflows/deploy.yml`: `on: workflow_run:["Build & Push Images"] success & main`。`runs-on:[self-hosted,linux,x64]` → `~/.401.env` 復元 → ghcr login → `docker compose -f docker-compose.prod.yml pull && up -d` → healthy 待機ループ → `curl /health` 検証 → `docker image prune -f`

## Phase 4: CT セットアップ スクリプト & 手順書
- [x] `scripts/setup-ct.sh` … docker/compose plugin 導入 / 80番解放 / cloudflared 導入&`localhost:80`向け / `~/.401.env` 確認(lab-presence setup-pi.sh を 401 用に)
- [x] `scripts/setup-runner.sh` … CT を self-hosted runner(x64) 登録(lab-presence 版を流用)
- [x] `docs/deploy.md` … 下記ユーザー作業＋運用(バックアップ/ロールバック=sha タグ)を手順化
- [x] `docs/ci-cd.md` / `CLAUDE.md` を main + CD 反映に更新

## ユーザー側で用意が必要 (インフラ/秘密)
1. Proxmox CT(Debian/Ubuntu LXC, `nesting=1,keyctl=1`) 作成
2. `scripts/setup-ct.sh` 実行(Docker/cloudflared) → `scripts/setup-runner.sh <owner/repo> <token>` で runner 登録
3. Cloudflare: Tunnel 作成 → 公開名を `http://localhost:80` にマップ(cloudflared はホスト常駐)
4. Google OAuth: 承認済みリダイレクト URI に `https://<公開名>/callback` 追加
5. CT の `~/.401.env`: POSTGRES_*/DATABASE_URL/SECRET_KEY(強固)/GOOGLE_*/FRONTEND_URL/OAUTH_REDIRECT_URL/COOKIE_SECURE=true/SLACK_*
6. GitHub: default を **main** にリネーム / ブランチ保護を main へ / (nginx build 用) `NEXT_PUBLIC_API_URL` は空でよい

## 未確定・要確認
- 公開ホスト名(ドメイン) ← 実 push 前に確定必要(OAuth/Cloudflare 設定に必須)
- DB マイグレーション運用(現状 schema.sql 初回のみ。lab-presence は migrations/*.sql を deploy 時 psql -f。将来対応)
- postgres volume のバックアップ運用(Proxmox スナップショット or pg_dump cron)

## Review (2026-07-29 実装完了)

Phase 1〜4 を実装し、feature ブランチ `feat/deploy-cd` に Phase ごとコミット:
- `build(deploy):` 本番イメージ + prod compose
- `feat(deploy):` backend env 駆動化 + /health + login 堅牢化
- `ci(deploy):` build-images.yml / deploy.yml / ci.yml(main+workflow_call)
- `docs(deploy):` setup スクリプト + deploy.md + ci-cd/CLAUDE 更新

### 検証 (ローカルで実地)
- backend: `gofmt -l`=空 / `go vet`=空 / `go build`=OK / `go test`=ok(service)
- frontend: `tsc --noEmit`=OK / `next lint`=No warnings/errors / `next build`=static export 成功
- 本番スタック: `docker compose -f docker-compose.prod.yml build`=backend/nginx 両方 Built
- `up -d` 後 db/backend healthy、nginx 稼働。nginx 経由(:80)で:
  - `/health`→200 "ok" / `/`→200 html(予約管理) / `/api/me`→401
  - `/login`→307 Google、`redirect_uri=.../callback`(OAUTH_REDIRECT_URL 反映を確認)
- ワークフロー3本 YAML 構文 OK。

### 残タスク (ユーザー/インフラ・コード外)
- 公開ドメイン確定 → OAuth リダイレクト URI / Cloudflare 設定 / `~/.401.env`
- GitHub: master→main リネーム、ブランチ保護を main へ、CT に runner 登録
- git 追跡下の平文 secret(`docker-compose.yaml` の GOOGLE_CLIENT_SECRET 等) のローテーション
- DB マイグレーション運用の整備(schema.sql は初回のみ)
