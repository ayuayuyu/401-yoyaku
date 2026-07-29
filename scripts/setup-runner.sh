#!/usr/bin/env bash
# CT を GitHub Actions self-hosted runner として登録する (deploy.yml の実行先)。
# 使い方: bash scripts/setup-runner.sh <owner/repo> <runner-token>
#   owner/repo   : 例 "ayuayuyu/401-yoyaku"
#   runner-token : GitHub Settings -> Actions -> Runners -> New self-hosted runner で取得
#
# ラベルは deploy.yml の runs-on: [self-hosted, linux, x64] と一致させる。
set -euo pipefail

REPO="${1:?Usage: $0 <owner/repo> <runner-token>}"
TOKEN="${2:?Usage: $0 <owner/repo> <runner-token>}"
RUNNER_DIR="${HOME}/actions-runner"

# 最新の runner バージョンを解決 (RUNNER_VERSION で固定も可)
RUNNER_VERSION="${RUNNER_VERSION:-$(
  curl -fsSL https://api.github.com/repos/actions/runner/releases/latest \
    | grep -oE '"tag_name": *"v[^"]+"' | head -1 | sed 's/.*"v\([^"]*\)".*/\1/'
)}"

echo "==> GitHub Actions Runner セットアップ"
echo "    リポジトリ : ${REPO}"
echo "    バージョン : ${RUNNER_VERSION}"
echo "    ディレクトリ: ${RUNNER_DIR}"

case "$(uname -m)" in
  x86_64)  RUNNER_ARCH="x64" ;;
  aarch64) RUNNER_ARCH="arm64" ;;
  *) echo "Unsupported arch: $(uname -m)"; exit 1 ;;
esac

mkdir -p "${RUNNER_DIR}"
cd "${RUNNER_DIR}"

if [ ! -f "${RUNNER_DIR}/config.sh" ]; then
  PKG="actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
  URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${PKG}"
  echo "==> ランナーをダウンロード中... (${RUNNER_ARCH})"
  curl -fsSL -o "${PKG}" "${URL}"
  tar xzf "${PKG}"
  rm -f "${PKG}"
else
  echo "==> ランナーは取得済み。スキップ。"
fi

echo "==> ランナーを設定中..."
./config.sh \
  --url "https://github.com/${REPO}" \
  --token "${TOKEN}" \
  --name "proxmox-ct" \
  --labels "self-hosted,linux,${RUNNER_ARCH}" \
  --work "_work" \
  --unattended \
  --replace

echo "==> systemd サービスとして登録..."
sudo ./svc.sh install
sudo ./svc.sh start

echo ""
echo "=========================================="
echo "  完了! 状態確認: sudo ./svc.sh status"
echo "  ログ:        journalctl -u 'actions.runner.*' -f"
echo "=========================================="
