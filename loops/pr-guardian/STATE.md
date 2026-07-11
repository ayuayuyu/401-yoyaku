# STATE: pr-guardian

> 毎反復ごとに上書き更新する作業記憶。起動時に対象 PR 番号をここへ記入してから回す。
> 主張は必ず根拠（コマンド出力）とセットで書く。`/loop-sync pr-guardian` で実態と照合する。

## Status

- 対象 PR: `#<未設定>`（起動時に記入）
- 現在の状態: `IN_PROGRESS`
- 最終更新: <未実行>
- 反復回数: 0 / 5

## Definition of Done チェック（LOOP.md と同期）

- [ ] CI 緑（`gh pr checks` 全 success）
- [ ] 未対応レビュー指摘 0 件
- [ ] ローカル検証すべて成功（go test/vet, pnpm lint/build）
- [ ] approve 済み or 人間が完了を明示

## いま分かっていること / 前提

- （初回起動時に、PR の目的・変更範囲・現在の CI 状態をここへ記入）

## 次にやること（Next actions）

1. 対象 PR 番号を設定し `gh pr checks <PR>` で現状把握。

## Blockers（あれば）

- なし

## Verification log（loop-verify が追記）

| 日時 | 判定 | 根拠（コマンド/理由） |
|---|---|---|
| — | — | 未実行 |

## Iteration log（反復ログ）

- （まだ反復なし）
