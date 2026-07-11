---
name: loop-verify
description: ループの成果を「別モデル」で独立採点する検証者。ユーザーが「loop-verify」「検証して」「DoD を満たしたか採点」「別モデルでチェック」等と言ったとき、loop-verifier サブエージェント(sonnet)を起動し、最新の作業差分と STATE を LOOP.md の Definition of Done に照合して PASS/FAIL を判定する。
---

# loop-verify — 別モデルによる独立検証

Loop Engineering の鉄則「**同一モデルの自己採点をしない**」を担保するスキル。
本体(opus)ではなく、検証専用の `loop-verifier` サブエージェント(**model: sonnet**)に
採点させ、その判定を STATE.md に記録する。

## 引数

- `$1` = 対象ループ名 or `LOOP.md` パス（例 `pr-guardian` / `loops/pr-guardian/LOOP.md`）。
  未指定なら `loops/*/` を列挙して選ばせる。

## 手順

1. 対象の `LOOP.md`（Definition of Done・Verification コマンド）と `STATE.md` を特定する。
2. **loop-verifier サブエージェントを Agent ツールで起動**し、次を渡す:
   - LOOP.md の Goal / Definition of Done / Verification コマンド。
   - STATE.md の現在の主張（「何が終わったと言っているか」）。
   - 「検証コマンドを実際に実行し、出力を根拠に DoD を1項目ずつ PASS/FAIL 判定せよ。
     本体の主張を信用せず、コマンド結果と diff だけを根拠にせよ」という指示。
3. サブエージェントの返した判定（総合 PASS/FAIL＋項目別＋根拠）を受け取る。
4. **STATE.md の「Verification log」に1行追記**する（日時・判定・根拠の要約）。
   DoD 項目のチェックボックスも実態に合わせて更新する。
5. 総合 PASS かつ DoD 全項目達成なら「停止条件到達（STOP 可）」と伝える。
   FAIL なら不合格の項目と次アクションを STATE.md の Next actions に反映する。

## 原則

- 採点は必ずサブエージェント（別モデル）に委ねる。本体が代わりに採点しない。
- 「たぶん通る」で PASS にしない。コマンドを実行した客観的証拠がなければ FAIL 扱い。
- 破壊的操作はしない（検証はビルド/テスト/読み取り中心）。
