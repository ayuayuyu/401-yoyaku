## 概要

<!-- 何を・なぜ変更したかを簡潔に -->

## 変更内容

-

## 確認したこと（セルフチェック）

- [ ] `cd backend/src && gofmt -l . && go vet ./... && go build ./... && go test ./...` が緑
- [ ] SQL を変えた場合 `sqlc generate` を実行し `db/` をコミットした
- [ ] `cd frontend && npm run lint && npm run typecheck && npm run build` が緑
- [ ] コミットメッセージが Conventional Commits 形式（`feat:` / `fix:` / `docs:` …）
- [ ] アプリの挙動に影響する変更は動作確認済み

## 関連 Issue / 補足

<!-- あれば -->
