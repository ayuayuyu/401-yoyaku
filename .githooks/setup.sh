#!/usr/bin/env bash
# git hook を有効化する。クローン後に一度だけ実行する:
#   bash .githooks/setup.sh
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

# フックの実行権限を付与
chmod +x .githooks/pre-commit .githooks/pre-push .githooks/commit-msg .githooks/setup.sh 2>/dev/null || true

# このリポジトリの hook ディレクトリを .githooks に向ける
git config core.hooksPath .githooks

echo "✔ git hooks を有効化しました (core.hooksPath=.githooks)"
echo "  - commit-msg : Conventional Commits を強制"
echo "  - pre-commit : staged の Go を gofmt で自動整形"
echo "  - pre-push   : lint/format/型/vet/test に失敗すると push を中止"
echo ""
echo "無効化する場合: git config --unset core.hooksPath"
