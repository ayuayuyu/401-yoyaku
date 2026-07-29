#!/usr/bin/env bash
# Proxmox CT(LXC) 初期セットアップ: Docker / compose plugin / cloudflared / ポート80解放。
# 前提: unprivileged CT なら features に nesting=1 を有効化しておくこと。
# 使い方: sudo bash scripts/setup-ct.sh
set -euo pipefail

echo "=========================================="
echo "  401 予約管理 — Proxmox CT セットアップ"
echo "=========================================="

# 1. Docker Engine
if ! command -v docker &>/dev/null; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  target_user="${SUDO_USER:-$(logname 2>/dev/null || echo root)}"
  usermod -aG docker "$target_user" || true
  echo "    (docker グループ反映のため再ログインが必要な場合あり)"
fi

# 2. docker compose plugin
if ! docker compose version &>/dev/null; then
  echo "==> Installing Docker Compose plugin..."
  apt-get update -qq
  apt-get install -y -qq docker-compose-plugin
fi

# 3. ポート80を占有するホスト側サービスを停止(nginx は CT 内 Docker が握る)
for svc in nginx apache2; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    echo "==> Stopping host $svc (port 80 conflict)..."
    systemctl stop "$svc"
    systemctl disable "$svc"
  fi
done

# 4. cloudflared (Cloudflare Tunnel)
if ! command -v cloudflared &>/dev/null; then
  echo "==> Installing cloudflared..."
  arch="$(dpkg --print-architecture)" # amd64 / arm64
  curl -fsSL -o /tmp/cloudflared.deb \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}.deb"
  dpkg -i /tmp/cloudflared.deb || apt-get -f install -y
  rm -f /tmp/cloudflared.deb
fi

# 5. 本番 env の存在確認
ENV_FILE="${HOME}/.401.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "[WARN] ${ENV_FILE} が未配置です。テンプレートから作成して実値を設定してください:"
  echo "         cp .env.prod.example ~/.401.env && vim ~/.401.env"
fi

cat <<'NOTE'

==========================================
  次の手動ステップ
==========================================
1. ~/.401.env に本番の実値を設定
   (POSTGRES_*, DATABASE_URL, SECRET_KEY, GOOGLE_*, FRONTEND_URL,
    OAUTH_REDIRECT_URL, COOKIE_SECURE=true, SLACK_* など)

2. Cloudflare Tunnel をトークンで接続 (systemd 常駐):
     sudo cloudflared service install <TUNNEL_TOKEN>
   Cloudflare ダッシュボードで Public hostname を
     <公開ドメイン>  ->  http://localhost:80
   にマップする。

3. Google OAuth の承認済みリダイレクト URI に
     https://<公開ドメイン>/callback
   を追加する。

4. GitHub Actions self-hosted runner を登録:
     bash scripts/setup-runner.sh <owner/repo> <runner-token>

5. main に push すると Actions がイメージを GHCR へ push し、CT へ自動デプロイされる。
==========================================
NOTE
