# 401号室予約管理アプリケーション バックエンド

401号室の予約を管理するアプリケーションの REST API です。
Go (Gin) + PostgreSQL、SQL からのコード生成に `sqlc` を使用しています。

> リポジトリ全体の構成・アーキテクチャは [../CLAUDE.md](../CLAUDE.md) を参照。

---

## セットアップ手順

### 0. 環境変数

env ファイルは**リポジトリ直下の `.env` 1つ**に集約しています（`backend/.env` は置きません）。

```bash
cd ..
cp .env.example .env   # 値を埋める
```

### 1. コードの自動生成

`src/db/query.sql` から Go コードを生成します。生成物 (`query.sql.go`) は手で編集しません。

```bash
cd src
sqlc generate
```

### 2. Docker コンテナの起動

リポジトリ直下で:

```bash
make up
```

バックエンド (`http://localhost:8080`)・フロントエンド (`http://localhost:3000`)・
PostgreSQL (`localhost:55432`) がまとめて起動します。ホットリロードは Air。

### 3. テーブルの作成

`src/db/schema.sql` は初回起動時に `docker-entrypoint-initdb.d` 経由で自動適用されます。
手動で流す場合:

```bash
psql -h 127.0.0.1 -p 55432 -U user -d app -f src/db/schema.sql
```

> カラムを追加するときは `schema.sql` と `utils.EnsureSchema` の**両方**を更新します
> （マイグレーション基盤は未導入）。

### 4. PostgreSQL に接続

```bash
make login   # docker compose exec db psql
```

### 停止

```bash
make down
```

---

## テスト

```bash
cd src
go test ./...
```
