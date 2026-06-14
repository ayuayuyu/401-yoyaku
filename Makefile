# 401号室予約管理アプリ — Docker Compose 操作用 Makefile
# 使い方: ルートディレクトリで `make up` など

.PHONY: up down restart rebuild logs ps login sqlc test help

## up: build & 起動 (backend + frontend + postgres)
up:
	docker compose up --build

## down: 停止 & コンテナ削除
down:
	docker compose down

## restart: 全サービス再起動
restart:
	docker compose restart

## rebuild: キャッシュ無しで再ビルドして起動
rebuild:
	docker compose build --no-cache && docker compose up

## logs: ログを追従表示
logs:
	docker compose logs -f

## ps: サービス状態を表示
ps:
	docker compose ps

## login: PostgreSQL (db) に psql で接続
login:
	docker compose exec db psql -U user -d app

## sqlc: query.sql から query.sql.go を生成
sqlc:
	cd backend/src && sqlc generate

## test: バックエンドのテストを実行
test:
	cd backend/src && go test ./...

## help: ターゲット一覧
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/^## //'

.DEFAULT_GOAL := help
