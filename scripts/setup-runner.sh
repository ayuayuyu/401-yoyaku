#!/usr/bin/env bash
# Proxmox VE の LXC コンテナに GitHub Actions self-hosted runner をセットアップする。
# deploy.yml は runs-on: [self-hosted, linux, x64] で動くため、このラベルで登録する。
#
# 使い方:
#   bash scripts/setup-runner.sh <owner/repo> <runner-token> [runner-name]
# 例:
#   bash scripts/setup-runner.sh ayuayuyu/401-yoyaku AAXXXXXXXXXXXXXXXX 401-yoyaku-lxc
#
# runner-token は GitHub → Settings → Actions → Runners → "New self-hosted runner" で取得。

set -euo pipefail

REPO="${1:?Usage: $0 <owner/repo> <runner-token> [runner-name]}"
TOKEN="${2:?Usage: $0 <owner/repo> <runner-token> [runner-name]}"
RUNNER_NAME="${3:-$(hostname)}"
RUNNER_DIR="${HOME}/actions-runner"

# root 運用の LXC でも動くようにする。
#  - runner の config.sh は root 実行を明示的に拒否するため
#    RUNNER_ALLOW_RUNASROOT=1 が必要 ("Must not run with sudo" で即死する)
#  - 最小構成の LXC には sudo が入っていないので、root なら挟まない
if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
  export RUNNER_ALLOW_RUNASROOT=1
elif command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
else
  echo "[ERROR] root でも sudo 利用可能でもありません。root で実行してください。"
  exit 1
fi

ARCH="$(uname -m)"
case "${ARCH}" in
  x86_64)  RUNNER_ARCH="x64" ;;
  aarch64) RUNNER_ARCH="arm64" ;;
  *) echo "Unsupported arch: ${ARCH}"; exit 1 ;;
esac

# 最新 runner バージョンを取得 (先頭の v を除去)。ハッシュ固定は保守が面倒なので
# HTTPS + 公式 github.com リリースを信頼する。
VERSION="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest \
  | grep -oE '"tag_name":[[:space:]]*"v[^"]+"' | head -1 | sed -E 's/.*"v([^"]+)".*/\1/')"
if [ -z "${VERSION}" ]; then
  echo "runner バージョンの取得に失敗しました。ネットワークを確認してください。"
  exit 1
fi

PKG="actions-runner-linux-${RUNNER_ARCH}-${VERSION}.tar.gz"
URL="https://github.com/actions/runner/releases/download/v${VERSION}/${PKG}"

echo "==> GitHub Actions Runner セットアップ"
echo "    repo: ${REPO} / name: ${RUNNER_NAME}"
echo "    arch: ${RUNNER_ARCH} / version: ${VERSION} / user: $(id -un)"

mkdir -p "${RUNNER_DIR}"
cd "${RUNNER_DIR}"

if [ ! -f "${RUNNER_DIR}/config.sh" ]; then
  echo "==> runner をダウンロード..."
  curl -fsSL -o "${PKG}" "${URL}"
  tar xzf "${PKG}"
  rm -f "${PKG}"
else
  echo "==> runner は展開済み。スキップ。"
fi

# runner 本体は .NET アプリなので、素の Debian LXC では libicu が無く
# config.sh が "Couldn't find a valid ICU package installed" で即死する。
# runner 同梱のスクリプトが必要な依存を入れてくれる。
if [ -x "${RUNNER_DIR}/bin/installdependencies.sh" ]; then
  echo "==> runner の依存パッケージを確認..."
  ${SUDO} "${RUNNER_DIR}/bin/installdependencies.sh"
fi

# ラベルは実行環境のアーキテクチャから組み立てる。固定値にすると
# runs-on: [self-hosted, linux, x64] と噛み合わなくなる。
echo "==> runner を登録... (labels: self-hosted,linux,${RUNNER_ARCH})"
./config.sh \
  --url "https://github.com/${REPO}" \
  --token "${TOKEN}" \
  --name "${RUNNER_NAME}" \
  --labels "self-hosted,linux,${RUNNER_ARCH}" \
  --work "_work" \
  --unattended \
  --replace

echo "==> systemd サービスとして登録..."
${SUDO} ./svc.sh install
${SUDO} ./svc.sh start

echo ""
echo "=========================================="
echo "  セットアップ完了!"
echo "  状態確認: ${SUDO} ${RUNNER_DIR}/svc.sh status"
echo "  ログ:     journalctl -u 'actions.runner.*' -f"
echo "=========================================="
