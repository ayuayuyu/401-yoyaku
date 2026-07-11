# Loop Engineering ガイド（401 予約管理プロジェクト）

このリポジトリで「Loop Engineering」を実践するための手引き。
元ネタ: Zenn 記事「Loop Engineering」(acntechjp) — Boris Cherny の
「My job is to write loops.」に端を発する、**開発者の役割の転換**についての考え方。

## 1. Loop Engineering とは

- **従来**: エンジニアが都度プロンプトを打ち、1 回の応答を得る。
- **これから**: エンジニアは「**目的（Goal）と停止条件（Definition of Done）だけを与え、
  実装の判断はループ自身に任せる**」システムを設計する。人間は "loop を書く" 側に回る。

ただし記事は強く警告している:

> 監視なきループは失敗を積み重ね、コードを読まなくなると「次のターンへ持ち越す情報の
> 取捨選択」ができなくなり、**理解負債（understanding debt）が返済不能**になる。

だからこのリポジトリでは、ループに必ず **停止条件・別モデル検証・状態管理・監査** を付ける。

## 2. 6 つの構成要素 → このリポジトリでの実現

| # | 要素 | このリポジトリでの実現 |
|---|---|---|
| 1 | スケジューリング | Claude Code 組込みの `/loop`・`/schedule`。周期は各 `LOOP.md` の `## Cadence` に明記 |
| 2 | ゴール条件 | `LOOP.md` の `## Goal` と `## Definition of Done（停止条件）` |
| 3 | 隔離ワークスペース | `git worktree`（loop-init が要否を判断・案内） |
| 4 | 検証者 | `/loop-verify` → `loop-verifier` サブエージェント（**model: sonnet**、本体 opus と別モデル） |
| 5 | 永続メモリ | `CLAUDE.md` / 各 `STATE.md` / `tasks/lessons.md` / 本ガイド |
| 6 | コネクタ | `gh` CLI（GitHub）、Slack（backend の `SLACK_WEBHOOK_URL`）、MCP |

## 3. ディレクトリ構成

```
.claude/
  skills/loop-init/    …新規ループの雛形生成
  skills/loop-audit/   …Loop Readiness Score（起動前ゲート）
  skills/loop-verify/  …別モデルで成果を採点
  skills/loop-sync/    …STATE と実態のドリフト検知
  skills/loop-status/  …全ループのダッシュボード
  agents/loop-verifier.md …検証専用サブエージェント(sonnet)
loops/
  _template/           …LOOP.md / STATE.md のテンプレ
  pr-guardian/         …実例: PR 見守りループ
docs/loop-engineering.md …このガイド
```

- **LOOP.md = 憲法**: 人間が書く。目的・境界・停止条件・ガードレール。頻繁に変えない。
- **STATE.md = 作業記憶**: ループが毎反復更新する現在地。主張は必ず根拠付きで書く。

## 4. スキル一覧（スラッシュコマンド）

| スキル | 役割 | 主な使いどき |
|---|---|---|
| `/loop-init <名>` | ループの雛形を作り 6 要素を定義 | 新しい自走タスクを始めるとき |
| `/loop-audit <LOOP.md>` | Readiness Score で起動可否を判定 | **起動前に必ず** |
| `/loop-verify <名>` | 別モデルで DoD 達成を採点 | 反復のたび / 停止判断前 |
| `/loop-sync <名>` | STATE と実態の乖離を検知 | 「本当にその状態？」を確かめたいとき |
| `/loop-status` | 全ループの進捗一覧 | 今どれが動いている/詰まっているか |

## 5. クイックスタート

```
# 1) ループを作る（対話で目的・停止条件・検証を定義）
/loop-init nightly-lint

# 2) 起動前に監査（Green 判定を目指す）
/loop-audit loops/nightly-lint/LOOP.md

# 3) 起動（組込み /loop。目的と停止条件だけを渡す）
/loop 10m loops/nightly-lint/LOOP.md に従って進めて。毎反復 STATE.md を更新し、
      停止条件を満たしたら終了。迷ったら BLOCKED にして止まって。

# 4) 途中・完了前に別モデルで検証
/loop-verify nightly-lint

# 5) 状態が怪しければ実態と照合
/loop-sync nightly-lint
```

実例の `pr-guardian` はすぐ試せる。対象 PR 番号を `loops/pr-guardian/STATE.md` に書いてから
`/loop-audit loops/pr-guardian/LOOP.md` → `/loop ...` の順で回す。

## 6. コネクタの前提（このリポジトリ）

- **GitHub**: `gh` CLI を使う（`gh auth status` が通っていること）。PR 状態・CI・コメント操作。
  - 認証で詰まったら `gh auth token` を一時 credential helper に使う運用がある（メモリ参照）。
- **Slack**: backend の予約通知が `SLACK_NOTIFY_ENABLED=true` + `SLACK_WEBHOOK_URL` で有効化。
  ループからの通知に転用も可能（`service/reservation_notification_service.go` 参照）。
- **検証コマンド**（このリポジトリ標準）:
  - backend: `cd backend/src && go test ./... && go vet ./...`（SQL 変更時は `sqlc generate`）
  - frontend: `cd frontend && pnpm lint && pnpm build`

## 7. アンチパターン（記事の警告を運用ルールに）

- ❌ **停止条件が曖昧なループを回す** → 無限ループと理解負債。DoD は機械的に検証可能にする。
- ❌ **本体が自分の成果を自己採点する** → 見逃す。必ず `/loop-verify`（別モデル）で採点。
- ❌ **STATE を更新せず走らせ続ける** → 引き継ぎ情報が腐る。毎反復更新＋`/loop-sync` で照合。
- ❌ **監視ゼロで放置** → `/loop-status` で定期的に俯瞰し、BLOCKED/連続 FAIL を拾う。
- ❌ **ガードレール無し** → 最大反復数・連続失敗時の停止・禁止操作を必ず LOOP.md に書く。

## 8. 参考

- 元記事: https://zenn.dev/acntechjp/articles/0c63b5b08bbdb9
- 関連ツール（記事で紹介）: cobusgreyling/loop-engineering（`loop-init`/`loop-audit`/`loop-cost`/`loop-sync`）。
  本リポジトリではその考え方を Claude Code のスキルとして再構成している。
