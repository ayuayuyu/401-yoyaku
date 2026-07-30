#!/usr/bin/env bash
# Proxmox VE の LXC コンテナ (Debian/Ubuntu, amd64) の中で本番実行環境を用意する。
# - Docker Engine + compose plugin を導入
# - 本番 .env の雛形 (~/.401-yoyaku.env) を作成
#
# 前提: Proxmox ホスト側で LXC の nesting を有効化しておくこと (Docker-in-LXC 要件)。
#   pct set <CTID> --features nesting=1,keyctl=1   ならびに Debian/Ubuntu テンプレ。
#   詳細は docs/deploy.md を参照。
#
# 使い方: LXC 内でリポジトリを clone したディレクトリ直下で
#   bash scripts/setup-container.sh

set -euo pipefail

echo "==> Docker Engine + compose plugin を導入..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "${USER}"
  echo "  '${USER}' を docker グループに追加しました (反映には再ログインが必要)。"
else
  echo "  docker は導入済み。"
fi

ENV_DEST="${HOME}/.401-yoyaku.env"
if [ ! -f "${ENV_DEST}" ]; then
  if [ -f .env.prod.example ]; then
    cp .env.prod.example "${ENV_DEST}"
    chmod 600 "${ENV_DEST}"
    echo "==> ${ENV_DEST} を作成しました。値を編集してください:"
    echo "      vim ${ENV_DEST}"
  else
    echo "::warning:: .env.prod.example が見つかりません。リポジトリ直下で実行してください。"
  fi
else
  echo "  ${ENV_DEST} は既に存在します。編集のみ行ってください。"
fi

echo ""
echo "=========================================="
echo "  次のステップ:"
echo "   1) vim ~/.401-yoyaku.env で本番値を設定"
echo "   2) Cloudflare Zero Trust でトンネル作成 → TUNNEL_TOKEN を設定"
echo "      public hostname を http://nginx:80 に向ける"
echo "   3) bash scripts/setup-runner.sh ayuayuyu/401-yoyaku <RUNNER_TOKEN>"
echo "   4) main に push すると自動デプロイ"
echo "=========================================="
