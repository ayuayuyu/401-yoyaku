---
name: loop-status
description: このリポジトリの全ループ(loops/*)を一覧し、目的・進捗・直近の検証判定・停止条件の達成状況をまとめて表示する。ユーザーが「loop-status」「ループ一覧」「今どのループが動いてる/止まってる」「全ループの状況」等と言ったときに使う。
---

# loop-status — 全ループのダッシュボード

`loops/` 配下の全ループを走査し、現在地を1画面で俯瞰する。読み取り専用。

## 手順

1. `loops/*/LOOP.md` を列挙する（`_template` は除外）。
2. 各ループについて LOOP.md と STATE.md から以下を抽出:
   - **Goal**（1行に要約）
   - **Status**（IN_PROGRESS / BLOCKED / DONE）と最終更新日時
   - **反復回数 / 上限**
   - **Definition of Done** の達成数（例 2/3）
   - **直近の検証判定**（Verification log の最終行: PASS/FAIL）
   - **Blockers** の有無
3. 一覧表で表示し、注意が必要なループ（BLOCKED / 直近 FAIL / 上限接近 / 更新が古い）を強調する。
4. 各ループに推奨アクションを一言添える（例: 「FAIL 継続 → loop-verify 再実行 or 人間確認」
   「DONE 3/3 → 停止してよい」「更新が3日前 → 放置の可能性、loop-sync 推奨」）。

## 出力例（イメージ）

| ループ | Status | 反復 | DoD | 直近検証 | 次アクション |
|---|---|---|---|---|---|
| pr-guardian | IN_PROGRESS | 2/5 | 1/3 | FAIL | lint 修正して loop-verify |

## 原則

- 読み取りのみ。ファイルは変更しない。
- 数字や判定は STATE.md の記述を根拠にし、古い/矛盾が疑わしい場合は loop-sync を勧める。
