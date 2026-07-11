# CI/CD と push ゲート

品質ゲートを二層で担保する。

1. **ローカル git hook（`.githooks/`）** … 一次ゲート。コミット/プッシュ時に即座に整形・検査・拒否。
2. **GitHub Actions（`.github/workflows/ci.yml`）** … 最終ゲート。バイパス不可（ブランチ保護と併用）。

---

## 1. セットアップ（クローン後に一度だけ）

```bash
bash .githooks/setup.sh   # core.hooksPath=.githooks を設定し hook を有効化
```

無効化: `git config --unset core.hooksPath`

> hook は各自のローカル設定（`core.hooksPath`）なので、クローンした人は上記を実行する必要がある。
> 未実行でも CI 側で同じ検査が走るため、最終的な品質は担保される。

---

## 2. ローカル hook の挙動

| hook | タイミング | 内容 | 失敗時 |
|---|---|---|---|
| `commit-msg` | `git commit` | メッセージを Conventional Commits で検証 | **コミット拒否** |
| `pre-commit` | `git commit` | staged の `*.go` を `gofmt -w` で自動整形し再ステージ | （整形のみ・拒否しない） |
| `pre-push` | `git push` | 変更領域を検査：backend=gofmt/vet/build/test、frontend=lint/typecheck | **push 中止** |

- 緊急回避: `git commit --no-verify` / `git push --no-verify`（CI では別途検証される）。
- pre-push は**変更のあった領域だけ**検査して高速化している（backend/ を触っていなければ Go 検査はスキップ）。

### Conventional Commits 形式

```
<type>(<scope 任意>): <説明>
type: feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert
例:  feat(reservation): 予約重複チェックを追加
     fix(calendar): 初回表示で予約が出ない不具合を修正
破壊的変更: feat!: ... または feat(scope)!: ...
```

---

## 3. GitHub Actions（CI）

トリガー: `push`（全ブランチ）と `pull_request`（master 宛て）。ジョブ:

| ジョブ | 内容 |
|---|---|
| **frontend** | `npm ci` → `npm run lint`（next lint）→ `npm run typecheck`（tsc --noEmit）→ `npm run build` |
| **backend** | `gofmt -l` チェック → `go vet` → `go build` → `go test` → `sqlc generate` 差分チェック |
| **docker-build** | frontend/backend の Dockerfile を `push:false` でビルド検証（＝CD の入口） |
| **commit-check** | PR 内の各コミットを Conventional Commits で検証（PR 時のみ） |

いずれか失敗で PR はマージ不可（下記ブランチ保護と併用）。

> **パッケージマネージャ**: CI/Docker は **npm** を基準とする（`Dockerfile` が `npm ci`、`package-lock.json` が同期済みのため）。
> ローカル開発で `pnpm` を使うのも可。`pnpm-lock.yaml` も `package.json` と同期済みで、`pnpm install --frozen-lockfile` が通る。
> ただし CI/Docker は npm 基準のため、依存を変更したら **`package-lock.json` と `pnpm-lock.yaml` の両方**を更新してコミットすること。

---

## 4. ブランチ保護（GitHub 側の設定 — 要手動）

push 制限を実効化するには、リポジトリ設定でブランチ保護を有効にする（ファイルでは設定不可）。

**Settings → Branches → Add branch ruleset（または Add rule）** で `master` に対し:

- ✅ Require a pull request before merging（直接 push を禁止）
- ✅ Require status checks to pass before merging → 必須チェックに
  `Frontend (lint / typecheck / build)` / `Backend (gofmt / vet / build / test / sqlc)` /
  `Docker build (frontend / backend)` / `Conventional Commits` を指定
- ✅ Require branches to be up to date before merging
- （任意）Require linear history / Do not allow bypassing the above settings

CLI 例（`gh` + API。`OWNER/REPO` は置換）:

```bash
gh api -X PUT repos/OWNER/REPO/branches/master/protection \
  -H "Accept: application/vnd.github+json" \
  -f "required_pull_request_reviews.required_approving_review_count=1" \
  -F "enforce_admins=true" \
  -F "restrictions=null" \
  -f "required_status_checks.strict=true" \
  -f "required_status_checks.contexts[]=Frontend (lint / typecheck / build)" \
  -f "required_status_checks.contexts[]=Backend (gofmt / vet / build / test / sqlc)" \
  -f "required_status_checks.contexts[]=Docker build (frontend / backend)" \
  -f "required_status_checks.contexts[]=Conventional Commits"
```

---

## 5. ローカルで CI と同じ検査を回す

```bash
# backend
cd backend/src && gofmt -l . && go vet ./... && go build ./... && go test ./...
sqlc generate && git diff --exit-code -- db     # 生成物の再生成漏れ確認

# frontend
cd frontend && npm ci && npm run lint && npm run typecheck && npm run build
```
