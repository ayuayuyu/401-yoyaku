# STATE: <ループ名>

> ループの「作業記憶」。**毎反復ごとに上書き更新**する。次のターンへ持ち越す情報を
> ここに凝縮する（＝コンテキストの取捨選択）。LOOP.md が憲法、これが現在地。
> 主張（例「テスト通過」）は必ず根拠（コマンド出力）とセットで書く。`/loop-sync` で
> ここの主張と実状態(git/test)の乖離を検知する。

## Status

- 現在の状態: `IN_PROGRESS` <IN_PROGRESS / BLOCKED / DONE のいずれか>
- 最終更新: <YYYY-MM-DD HH:MM>
- 反復回数: <n> / 上限 <max>

## Definition of Done チェック（LOOP.md と同期）

- [ ] <条件1>
- [ ] <条件2>
- [ ] <条件3>

## いま分かっていること / 前提

- <このループが把握している事実。差分・原因・制約など>

## 次にやること（Next actions）

1. <次ターンで最初にやる具体アクション>
2. <...>

## Blockers（あれば）

- <人間の判断待ち・権限不足・仕様不明など。あるなら Status を BLOCKED に>

## Verification log（検証履歴｜loop-verify が追記）

| 日時 | 判定 | 根拠（コマンド/理由） |
|---|---|---|
| <YYYY-MM-DD HH:MM> | PASS/FAIL | <例: go test ./... OK, pnpm build OK / lint 3 件> |

## Iteration log（反復ログ）

- <YYYY-MM-DD HH:MM> #1: <何をしたか・結果を1行で>
