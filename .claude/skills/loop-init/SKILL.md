---
name: loop-init
description: 新しい自走ループ(Loop Engineering)の雛形を作る。ユーザーが「ループを作りたい」「loop-init」「〜を自動で回したい」「PR見守り/定期タスクをループ化したい」等と言ったとき、loops/<名>/ に LOOP.md と STATE.md を生成し目的・停止条件・検証を定義する。
---

# loop-init — 自走ループの雛形を作る

Loop Engineering の「目的と停止条件だけを与え、実装判断はループに任せる」ループを 1 つ新規作成する。
成果物は `loops/<名>/LOOP.md`（憲法）と `loops/<名>/STATE.md`（作業記憶）。

背景と全体像は `docs/loop-engineering.md` を必ず一読すること。

## 引数

- `$1` = ループ名（kebab-case。例 `pr-guardian`, `nightly-lint`）。未指定なら用途を1問だけ聞く。
- 以降の自由記述があれば目的・パターンのヒントとして使う。

## 手順

1. **重複確認**: `loops/<名>/` が既にあれば上書きしない。中身を要約して「更新するか別名にするか」を確認。
2. **テンプレをコピー**: `loops/_template/LOOP.md` と `STATE.md` を `loops/<名>/` に複製する。
3. **6 要素を埋める**（不明点は最小限の質問でまとめて確認。既定値で埋められるものは埋める）:
   - **Goal**: 手段でなく「達成状態」を1〜2文。
   - **Definition of Done（停止条件）**: 機械的に検証できる条件に落とす。曖昧語（"いい感じ"等）は禁止。
   - **Cadence**: 起動間隔/トリガー（`/loop` 前提）。
   - **Verification**: この 401 リポジトリの検証コマンドを具体化する。
     - バックエンド: `cd backend/src && go test ./... && go vet ./...`（SQL 変更時は `sqlc generate` の差分も確認）
     - フロント: `cd frontend && pnpm lint && pnpm build`
     - 検証は **必ず別モデル**（`/loop-verify`→loop-verifier）で行う旨を明記。
   - **Isolation**: 並行作業や実験なら worktree を推奨（`git worktree add`）。
   - **Connectors**: gh CLI / Slack / MCP など使うものと前提（認証）を書く。
   - **Guardrails**: 最大反復数、連続失敗時の停止・エスカレーション、禁止操作、コスト上限。
4. **STATE.md の DoD チェック**を LOOP.md と一致させ、Status を `IN_PROGRESS`、反復 0 に初期化。
5. **監査**: 続けて `loop-audit` の手順で Readiness Score を出す（`loops/<名>/LOOP.md` を対象）。
   閾値（70）未満なら不足項目を埋めるまで「起動非推奨」と伝える。
6. **起動案内**: 最後に次を提示する（実行はユーザー判断。ここでは起動しない）:
   ```
   /loop <間隔> loops/<名>/LOOP.md に従って進めて。毎反復で STATE.md を更新し、
   停止条件を満たしたら終了。迷ったら BLOCKED にして止まって。
   ```

## 原則

- LOOP.md は「人間が書く憲法」。ここで勝手に Non-Goals を広げない。
- 停止条件が検証不能なループは作らない（無限ループ＆理解負債の温床）。
- 作成のみ。ループの実行・スケジュール登録はしない。
