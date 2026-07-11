# LOOP: pr-guardian（PR 見守りループ）

> Boris Cherny の原型例「PR を見守り、ビルド失敗を自動修正し、レビューコメントに対応する」を
> この 401 リポジトリ向けに具体化したもの。目的と停止条件だけを与え、修正の中身はループが判断する。
> このファイル（憲法）は基本変えない。作業状況は STATE.md に書く。

## Goal（目的）

指定した PR を「**CI 緑・レビュー指摘対応済み**」の状態に保ち、マージ可能にする。

## Definition of Done（停止条件）

> すべて満たしたら STOP。

- [ ] `gh pr checks <PR>` のすべてのチェックが success（＝ CI 緑）
- [ ] `gh pr view <PR> --comments` に未対応（未 resolve）のレビュー指摘が 0 件
- [ ] ローカル検証がすべて成功（下記 Verification）
- [ ] 次のいずれか: approve 済み **または** 人間が「これ以上不要」と明示

## Non-Goals / やらないこと

- **マージそのものはしない**（承認・マージは人間が実行）。
- main への直接 push、force push、履歴改変はしない。
- スコープ外の大規模リファクタや新機能追加はしない（指摘対応と CI 修正に限定）。
- DB スキーマの破壊的変更・本番デプロイはしない。

## Cadence（スケジューリング）

- 起動方法: `/loop 5m loops/pr-guardian/LOOP.md に従って PR <番号> を見守って`
- 間隔/トリガー: 5〜10 分ごと、または PR 更新時。
- 稼働時間帯の制限: なし（ガードレールで反復上限により暴走を防ぐ）。

## Verification（検証者）

> `/loop-verify pr-guardian` で loop-verifier(sonnet) が実行。本体は自己採点しない。

- 検証コマンド:
  - `cd backend/src && go test ./... && go vet ./...`
  - `cd frontend && pnpm lint && pnpm build`
  - SQL(`db/query.sql`)変更時: `cd backend/src && sqlc generate` 後 `git diff --exit-code`（未再生成は不合格）
- CI 状態: `gh pr checks <PR>`
- 合格基準: 上記すべて成功 かつ DoD 全項目達成。

## Isolation（隔離ワークスペース）

- worktree を使う: 任意（他ブランチ作業と並行するなら推奨）。
- 使う場合: `git worktree add ../pr-guardian-wt <PRのブランチ>` で隔離する。

## Connectors（コネクタ）

- `gh` CLI: PR 状態取得（`gh pr view/checks`）、コメント確認/返信（`gh pr comment`）、
  差分取得（`gh pr diff`）、CI ログ確認（`gh run view --log-failed`）。
- 前提: `gh auth status` が通っていること。push は PR のブランチにのみ行う。

## Guardrails（ガードレール）

- 1 起動あたり最大反復数: **5**。超えたら停止して状況を STATE.md に残す。
- 同一のチェック失敗が **2 回連続**で直せない場合: 停止し、原因仮説を書いて人間へエスカレーション。
- 禁止操作: force push / main への push / `gh pr merge` / 生成物(`query.sql.go`)の手編集 / 秘密情報のコミット。
- コスト上限（目安）: 1 起動あたり過大なトークン消費を避け、無限修正ループにしない。
- エスカレーション先: STATE.md の Status を `BLOCKED` にして停止（＝人間待ち）。

## Memory（永続メモリ）

- 進捗と引き継ぎ: `STATE.md`（毎反復更新）。
- 学び・再発防止: `tasks/lessons.md`（同種の CI 失敗が再発したらパターンを記録）。
- リポジトリ規約: `CLAUDE.md`（sqlc 生成物は手編集しない 等）/ `docs/loop-engineering.md`。

## 1 反復の進め方（ループの標準手順）

1. `gh pr checks <PR>` と `gh pr view <PR> --comments` で現状を把握。
2. 失敗チェックがあれば `gh run view --log-failed` で原因特定 → 最小修正。
3. 未対応レビュー指摘があれば対応（コード修正 or 返信）。
4. ローカル Verification を実行して緑を確認。
5. PR ブランチへ commit & push（`gh` 経由 or 通常 push）。
6. STATE.md を更新（やったこと・次アクション・検証ログ）。
7. DoD を再点検。満たせば STOP、未達なら次反復へ。迷ったら BLOCKED で停止。
