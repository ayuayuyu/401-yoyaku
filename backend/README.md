# 401号室予約管理アプリケーション バックエンド及びデータベース

このリポジトリは、401号室の予約を管理するアプリケーションのバックエンドおよびデータベース構成を提供します。  
バックエンドには Go 言語を用いた REST API を採用しており、  
データベースには MySQL を使用し、コード生成には `sqlc` を利用しています。  
また、Docker を用いることで、バックエンド・DB・フロントエンドをまとめて立ち上げられます。

---

## セットアップ手順

### 1. コードの自動生成

SQLファイルからGoコードを自動生成します。

```bash
cd src
sqlc generate
```

### 2. Docker コンテナの起動

`yoyaku-backendo` と同階層に `yoyaku-frontend` がある状態で、
以下のコマンドを実行します。

```bash
cd ..
make up
```

- `Makefile` の `make up` により、バックエンド (`http://localhost:8080`)・
  フロントエンド (`http://localhost:3000`)・MySQL が起動します。

### 3. テーブルの作成

スキーマ定義ファイルからテーブルを作成します。

```bash
mysql -u user -p -h 127.0.0.1 -P 53306 app < src/db/schema.sql
```

- `users`テーブルと`reservations`テーブルを作成する．

### 4. MySQL に接続

MySQL クライアントでデータベースに接続します。

```bash
mysql -u user -p -h 127.0.0.1 -P 53306 app
```

### Docker の停止

開発終了時はコンテナを停止・削除します。

```bash
make down
```
