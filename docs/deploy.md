# デプロイ手順 (Proxmox CT + Cloudflare Tunnel + GHCR 自動デプロイ)

401 予約管理アプリを Proxmox の LXC(CT) 上で本番運用するための手順。
方式は `ayuayuyu/lab-presence` を手本にした **GHCR-pull 型の自動デプロイ**。

## 全体像

```
 ブラウザ ─HTTPS─▶ Cloudflare ─Tunnel─▶ cloudflared(CTホスト/systemd) ─http─▶ nginx:80
   nginx:  /                         → out/ 静的配信 (next export)
           /api/ /login /callback /health → backend:8080 (Go)
           backend ──▶ postgres:16 (永続 volume: db-data)
```

- フロントと API を **同一オリジン**に集約 → CORS 不要・Cookie(SameSite) 問題を回避。
- CT は **ビルドしない**。GitHub Actions が GHCR にイメージを push し、CT の
  self-hosted runner が `docker compose pull && up -d` するだけ。

## パイプライン

```
push (main)
  └─▶ build-images.yml : ci.yml(test)通過 → 401-backend / 401-nginx を GHCR へ push
        └─▶ deploy.yml (workflow_run 成功時) : CT の self-hosted runner で pull & 再起動
```

イメージ: `ghcr.io/ayuayuyu/401-backend` / `ghcr.io/ayuayuyu/401-nginx`（tag: `latest` と `<sha>`）。

---

## 1. Proxmox CT の作成

- Debian/Ubuntu の LXC を作成（amd64）。
- **unprivileged CT の場合は Docker のために nesting を有効化**:
  - Web UI: CT → Options → Features → `Nesting` にチェック
  - CLI(ホスト): `pct set <CTID> --features nesting=1,keyctl=1`
- CT を起動し、SSH でログイン。

## 2. CT セットアップスクリプト

リポジトリを CT に配置して実行する（例 `~/401`）。

```bash
git clone https://github.com/ayuayuyu/401-yoyaku.git ~/401-yoyaku
cd ~/401-yoyaku
sudo bash scripts/setup-ct.sh
```

これで Docker / compose plugin / cloudflared のインストールと、ポート80の解放を行う。

## 3. 本番環境変数 `~/.401.env`

テンプレートから作成し、実値を設定する（**git 管理外**。deploy 時に `.env.prod` として展開される）。

```bash
cp .env.prod.example ~/.401.env
vim ~/.401.env
```

最低限設定する項目:

| 変数 | 例 / 説明 |
|---|---|
| `POSTGRES_USER/PASSWORD/DB` | DB 認証情報（強固なパスワード） |
| `DATABASE_URL` | `postgres://<user>:<pass>@db:5432/<db>?sslmode=disable&TimeZone=Asia%2FTokyo` |
| `SECRET_KEY` | セッション署名鍵。`openssl rand -hex 32` で生成 |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth クライアント |
| `FRONTEND_URL` | `https://<公開ドメイン>` |
| `OAUTH_REDIRECT_URL` | `https://<公開ドメイン>/callback` |
| `COOKIE_SECURE` | `true`（HTTPS 配信のため） |
| `SLACK_NOTIFY_ENABLED` / `SLACK_WEBHOOK_URL` | Slack 通知（任意） |

## 4. Cloudflare Tunnel

1. Cloudflare Zero Trust → Networks → Tunnels で Tunnel を作成し、トークンを取得。
2. CT でトークン接続（systemd 常駐）:
   ```bash
   sudo cloudflared service install <TUNNEL_TOKEN>
   ```
3. ダッシュボードで **Public hostname** を設定:
   `<公開ドメイン>` → Service `http://localhost:80`

## 5. Google OAuth リダイレクト URI

Google Cloud Console → 認証情報 → OAuth クライアント → 承認済みのリダイレクト URI に
`https://<公開ドメイン>/callback` を追加する（`OAUTH_REDIRECT_URL` と一致させる）。

## 6. self-hosted runner の登録

GitHub → Settings → Actions → Runners → New self-hosted runner でトークンを取得し:

```bash
bash scripts/setup-runner.sh ayuayuyu/401-yoyaku <runner-token>
```

ラベルは `self-hosted, linux, x64`（deploy.yml の `runs-on` と一致）。

## 7. リポジトリ設定（GitHub 側・一度だけ）

- **デフォルトブランチを `main` にリネーム**（Settings → Branches）。
- ブランチ保護を `main` に設定（`docs/ci-cd.md` 参照）。
- Actions の GITHUB_TOKEN に packages 書き込み権限があること（ワークフローで `packages: write` 指定済み）。
- 初回の GHCR パッケージは private。runner は `packages: read` で pull 可能。

---

## デプロイの流れ（通常運用）

1. `main` に push（または PR マージ）。
2. `build-images.yml` がテスト→イメージ push。
3. `deploy.yml` が CT の runner で pull→再起動→ヘルスチェック。
4. `https://<公開ドメイン>/` で確認。

手動デプロイ（CT 上で直接）:

```bash
cd ~/401
docker compose -f docker-compose.prod.yml --env-file ~/.401.env pull
docker compose -f docker-compose.prod.yml --env-file ~/.401.env up -d
```

## ロールバック

イメージは `<sha>` タグでも push される。特定コミットに戻すには CT で:

```bash
docker pull ghcr.io/ayuayuyu/401-backend:<sha>
docker pull ghcr.io/ayuayuyu/401-nginx:<sha>
# compose の image: を <sha> に差し替えるか、tag を latest に張り替えて up -d
```

## バックアップ / 運用メモ

- DB 実体は volume `db-data`（postgres データ）。Proxmox スナップショット or `pg_dump` を定期取得する。
- スキーマは初回起動時に `schema.sql` のみ適用。以降のスキーマ変更は現状マイグレーション自動適用の仕組みが無い（`db/query.sql` の sqlc とは別管理）。破壊的変更時は手動対応が必要（今後の課題）。

## トラブルシュート

| 症状 | 確認 |
|---|---|
| ログイン後に 401 が続く | `COOKIE_SECURE`/`FRONTEND_URL`/`OAUTH_REDIRECT_URL` がドメインと一致しているか |
| `/login` が Google に飛ばない | `GOOGLE_CLIENT_ID/SECRET`、`OAUTH_REDIRECT_URL` の設定 |
| deploy が env で失敗 | CT の `~/.401.env` が存在するか |
| ポート80が開かない | ホスト側 nginx/apache が停止済みか、`docker compose ps` |
