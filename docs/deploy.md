# デプロイ手順 (Proxmox VE LXC + Cloudflare Tunnel)

401予約アプリを Proxmox VE の **LXC コンテナ**にデプロイするための手順。`lab-presence` と同じ
「**GHCR にイメージを build&push → コンテナ内の self-hosted runner が pull して起動**」方式。
外部公開は **Cloudflare Tunnel**。

> LXC はホストのカーネルを共有するため、アプリ用イメージは引き続き **linux/amd64**（ホストが amd64 の場合）。
> Docker を LXC 内で動かすには **nesting の有効化**が必要（下記 手順1）。

## アーキテクチャ

```
Internet
  │  HTTPS
  ▼
Cloudflare (TLS 終端)
  │  Tunnel
  ▼
cloudflared ──► nginx:80 ─┬─► / (静的フロント: Next static export)
 (compose)                └─► /api,/login,/callback,/health ─► backend:8080 ─► db:5432
```

全て単一ドメイン (same-origin) 配下で配信するため、Cookie / OAuth が安定する。

- 本番 compose: [`docker-compose.prod.yml`](../docker-compose.prod.yml)
- 本番イメージ: `backend/Dockerfile`（静的 Go バイナリ）/ `frontend/Dockerfile.prod`（Next export + nginx）
- CI/CD: `.github/workflows/build-images.yml`（GHCR へ push）→ `deploy.yml`（runner が起動）

---

## 1. LXC コンテナ準備 (Proxmox VE)

### 1-1. ホスト側: コンテナ作成 + nesting 有効化

1. Proxmox で LXC コンテナを作成（**Debian 12 / Ubuntu 22.04+ テンプレ, amd64**、2 cores / 2GB 目安）。
   unprivileged コンテナ推奨。
2. **Docker-in-LXC 用に nesting を有効化**（Proxmox ホストのシェルで。`<CTID>` はコンテナID）:

   ```bash
   pct set <CTID> --features nesting=1,keyctl=1
   pct reboot <CTID>
   ```
   - GUI の場合: コンテナ → Options → Features → **Nesting** と **keyctl** にチェック。
   - Debian/Ubuntu テンプレは systemd 起動なので、後段の runner の systemd 登録も動く。

   > Docker が起動しない/overlay で失敗する場合: nesting が入っているか再確認。
   > それでも storage 由来で overlay2 が使えない場合は `fuse-overlayfs` を導入するか、
   > コンテナを privileged にして再試行する。

### 1-2. コンテナ内: Docker + .env

3. コンテナに入り（`pct enter <CTID>` またはSSH）、リポジトリを clone してセットアップ:

   ```bash
   git clone https://github.com/ayuayuyu/401-yoyaku.git
   cd 401-yoyaku
   bash scripts/setup-container.sh   # Docker 導入 + /etc/401-yoyaku/.env 雛形作成
   ```
   Docker グループ反映のため一度入り直す。

4. `/etc/401-yoyaku/.env` を編集して本番値を設定（[`.env.prod.example`](../.env.prod.example) 参照）。

---

## 2. Cloudflare Tunnel

1. Cloudflare Zero Trust → **Networks → Tunnels → Create a tunnel**（Cloudflared 型）。
2. 発行された **トークン**を `/etc/401-yoyaku/.env` の `TUNNEL_TOKEN` に設定。
3. **Public hostname** を追加:
   - Subdomain/Domain: `yoyaku.ayuayuyu.dev`
   - Service: **`http://nginx:80`**（cloudflared は同じ compose ネットワークにいるためサービス名で解決）
4. この公開URL（`https://yoyaku.ayuayuyu.dev`）を `.env` の `FRONTEND_URL` と
   `GOOGLE_REDIRECT_URL`(`.../callback`) に反映。

---

## 3. Google Cloud Console (OAuth)

プロジェクト（例: 65271644036）の OAuth クライアントに本番URLを登録:

- **承認済みリダイレクト URI**: `https://yoyaku.ayuayuyu.dev/callback`
- **承認済み JavaScript 生成元**: `https://yoyaku.ayuayuyu.dev`
- OAuth 同意画面: **本番公開**、**Google Calendar API 有効化**（カレンダー連携を使う場合）。

---

## 4. self-hosted runner 登録

1. GitHub → リポジトリ **Settings → Actions → Runners → New self-hosted runner** でトークンを取得。
2. コンテナ内で:

   ```bash
   cd ~/401-yoyaku
   bash scripts/setup-runner.sh ayuayuyu/401-yoyaku <RUNNER_TOKEN> [runner名]
   ```
   `self-hosted,linux,x64` ラベルの runner が systemd サービスとして常駐する。
   root 運用の LXC でもそのまま動く（`RUNNER_ALLOW_RUNASROOT` と .NET 依存パッケージを
   スクリプト側で面倒を見る）。

---

## 5. 初回デプロイ

main に push すると自動で回る:

```
push → CI (lint/型/test/build) → build-images (GHCR へ amd64 イメージ) → deploy (runner が pull & up)
```

手動で今すぐ動かしたい場合はコンテナ内で:

```bash
cd ~/401-yoyaku
cp /etc/401-yoyaku/.env .env
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

`https://yoyaku.ayuayuyu.dev/` を開き、Google ログイン → ダッシュボード表示を確認。

---

## 動作確認・トラブルシュート

```bash
# サービス状態
docker compose -f docker-compose.prod.yml ps
# ログ
docker compose -f docker-compose.prod.yml logs -f backend
# ヘルスチェック (コンテナ内)
curl -sf http://localhost/health
```

| 症状 | 見るところ |
|---|---|
| ログインで `redirect_uri_mismatch` | Cloud Console のリダイレクトURI と `GOOGLE_REDIRECT_URL` の一致 |
| ログイン後すぐログアウト状態 | `COOKIE_SECURE=true` か（HTTPS 必須）、`FRONTEND_URL` が実ドメインか |
| 502 / トンネルは繋がるが表示されない | Public hostname の service が `http://nginx:80` か、`nginx`/`backend` が healthy か |
| デプロイが走らない | runner がオンラインか（`svc.sh status`）、build-images が緑か |
| `Cannot connect to the Docker daemon` | LXC の nesting/keyctl（手順1-1）。`journalctl -u docker -n 20` |
| runner 設定が `Couldn't find a valid ICU package` で落ちる | `bin/installdependencies.sh` が走ったか（setup-runner.sh が実行する）|
| runner 設定が `Must not run with sudo` で落ちる | root 実行時は `RUNNER_ALLOW_RUNASROOT=1`（setup-runner.sh が設定する）|
| PWA が古いまま更新されない | `curl -I https://<ドメイン>/sw.js` の `Cache-Control: no-cache`。Cloudflare のキャッシュもパージ |

---

## ローカルでの本番ビルド確認 (任意)

手元で本番イメージが組めるか検証（cloudflared 抜き）:

```bash
# ルートの .env は開発用 compose が使っているので上書きしない。
# 本番用の値は別ファイルに書いて --env-file で渡す。
docker compose -p 401-prodtest --env-file ./prod-test.env -f docker-compose.prod.yml build
docker compose -p 401-prodtest --env-file ./prod-test.env -f docker-compose.prod.yml up -d db backend nginx
curl -sf http://localhost/health   # {"status":"ok"}
curl -s http://localhost/ | head   # フロントの HTML
docker compose -p 401-prodtest --env-file ./prod-test.env -f docker-compose.prod.yml down -v
```

- `prod-test.env` には `POSTGRES_*` / `SECRET_KEY` / `GOOGLE_*` が要る（[`.env.prod.example`](../.env.prod.example) をコピーしてダミー値で可）。`DATABASE_URL` は compose が `POSTGRES_*` から組み立てるので書かない。
  backend の `env_file: .env` はルートの `.env` を読むため、`env_file` を差し替える override を併用するか一時的に `.env` を用意する。
- `backend/Dockerfile` は BuildKit の `TARGETARCH` に従うので、arm64 Mac でもそのまま動く（CI は `--platform linux/amd64`）。
- OAuth の実挙動は本番ドメインでのみ確認可能。
