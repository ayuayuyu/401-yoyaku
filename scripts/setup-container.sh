#!/usr/bin/env bash
# Proxmox VE の LXC コンテナ (Debian/Ubuntu, amd64) の中で本番実行環境を用意する。
# - 不足しがちな基本ツール (curl 等) を導入
# - Docker Engine + compose plugin を導入し、実際に起動できるか検証
# - 本番 .env の雛形 (/etc/401-yoyaku/.env) を作成
#
# 前提: Proxmox ホスト側で LXC の nesting を有効化しておくこと (Docker-in-LXC 要件)。
#   pct set <CTID> --features nesting=1,keyctl=1
#   詳細は docs/deploy.md を参照。
#
# 使い方: LXC 内でリポジトリを clone したディレクトリ直下で
#   bash scripts/setup-container.sh

set -euo pipefail

# LXC は root で運用することが多く、最小テンプレートには sudo が入っていない。
# root なら sudo を挟まない。
if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
elif command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
else
  echo "[ERROR] root でも sudo 利用可能でもありません。root で実行してください。"
  exit 1
fi

# Proxmox の Debian テンプレートは最小構成で curl / ca-certificates が無いことがある。
# Docker の導入スクリプトが curl を使うので先に埋める。
MISSING=""
command -v curl >/dev/null 2>&1 || MISSING="${MISSING} curl"
[ -e /etc/ssl/certs/ca-certificates.crt ] || MISSING="${MISSING} ca-certificates"
if [ -n "${MISSING}" ]; then
  echo "==> 基本ツールを導入:${MISSING}"
  ${SUDO} apt-get update -qq
  # shellcheck disable=SC2086
  ${SUDO} apt-get install -y -qq ${MISSING}
fi

echo "==> Docker Engine + compose plugin を導入..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | ${SUDO} sh
  if [ "$(id -u)" -ne 0 ]; then
    ${SUDO} usermod -aG docker "${USER}"
    echo "  '${USER}' を docker グループに追加しました (反映には再ログインが必要)。"
  fi
else
  echo "  docker は導入済み。"
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "==> docker compose plugin を導入..."
  ${SUDO} apt-get update -qq
  ${SUDO} apt-get install -y -qq docker-compose-plugin
fi

# LXC では nesting/keyctl が無効だと dockerd が導入できても起動しない。
# ここで止めないと、後段の `docker compose up` が
# "Cannot connect to the Docker daemon" という分かりにくいエラーで落ちる。
if ! docker info >/dev/null 2>&1; then
  echo "==> Docker デーモンが起動していません。起動を試みます..."
  ${SUDO} systemctl enable --now docker >/dev/null 2>&1 || true
  sleep 3
fi
if ! docker info >/dev/null 2>&1; then
  echo "[ERROR] Docker デーモンに接続できません。"
  echo "  LXC 内で Docker を動かすには Proxmox ホスト側の設定が必要です:"
  echo "    pct set <CTID> --features nesting=1,keyctl=1"
  echo "    pct stop <CTID> && pct start <CTID>    # 反映には再起動が必要"
  echo "  それでも起動しない場合は特権コンテナ (--unprivileged 0) を試してください。"
  echo ""
  echo "  dockerd の直近ログ:"
  ${SUDO} journalctl -u docker --no-pager -n 20 2>/dev/null || true
  exit 1
fi
echo "==> Docker OK: $(docker --version)"

# nginx は 127.0.0.1:80 を publish する。ホスト側の Web サーバと衝突すると
# `up` が "port is already allocated" で落ちるため、先に潰しておく。
for SVC in nginx apache2; do
  if ${SUDO} systemctl is-active --quiet "${SVC}" 2>/dev/null; then
    echo "==> ポート80 を占有する ${SVC} を停止..."
    ${SUDO} systemctl stop "${SVC}"
    ${SUDO} systemctl disable "${SVC}"
  fi
done

# 本番 .env は固定パスに置く。deploy.yml の runner は systemd 配下で動き
# $HOME が空になることがあるため、ホームディレクトリ基準にはしない。
ENV_DIR="/etc/401-yoyaku"
ENV_DEST="${ENV_DIR}/.env"
LEGACY_ENV="${HOME:-/root}/.401-yoyaku.env"

${SUDO} mkdir -p "${ENV_DIR}"
${SUDO} chmod 700 "${ENV_DIR}"

if [ -f "${ENV_DEST}" ]; then
  echo "  ${ENV_DEST} は既に存在します。編集のみ行ってください。"
elif [ -f "${LEGACY_ENV}" ]; then
  ${SUDO} mv "${LEGACY_ENV}" "${ENV_DEST}"
  ${SUDO} chmod 600 "${ENV_DEST}"
  echo "==> 旧 ${LEGACY_ENV} を ${ENV_DEST} へ移行しました。"
elif [ -f .env.prod.example ]; then
  ${SUDO} cp .env.prod.example "${ENV_DEST}"
  ${SUDO} chmod 600 "${ENV_DEST}"
  echo "==> ${ENV_DEST} を作成しました。値を編集してください:"
  echo "      vim ${ENV_DEST}"
else
  echo "[WARN] .env.prod.example が見つかりません。リポジトリ直下で実行してください。"
fi

echo ""
echo "=========================================="
echo "  次のステップ:"
echo "   1) vim /etc/401-yoyaku/.env で本番値を設定"
echo "   2) Cloudflare Zero Trust でトンネル作成 → TUNNEL_TOKEN を設定"
echo "      public hostname を http://nginx:80 に向ける"
echo "   3) bash scripts/setup-runner.sh ayuayuyu/401-yoyaku <RUNNER_TOKEN>"
echo "   4) main に push すると自動デプロイ"
echo "=========================================="
