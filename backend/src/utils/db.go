package utils

import (
	"database/sql"
	"log"
	"os"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func NewDBConnection() (*sql.DB, error) {
	// 環境変数からDSNを取得
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is not set in the environment")
	}

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		// このエラーはDSNの形式が不正な場合などに発生します
		// 実際の接続エラーはPing()で検知します
		log.Fatal("failed to connect database: ", err)
	}

	db.SetConnMaxLifetime(time.Minute * 3) //コネクションを再利用できる最大時間を3分に設定
	db.SetMaxOpenConns(10)                 //同時に開くことができる最大のコネクション数を10に設定
	db.SetMaxIdleConns(10)                 //プール内に保持するアイドリング状態のコネクションの最大数を10に設定

	// 実際にデータベースへの接続が可能か確認
	if err := db.Ping(); err != nil {
		// Pingに失敗した場合、リソースを解放してから終了する
		db.Close()
		log.Fatalf("failed to connect database: %v", err)
	}

	log.Println("Database connection established successfully.")
	return db, nil
}

// EnsureSchema は schema.sql に後から追加した列を、既存DB(初回作成後は
// docker-entrypoint-initdb.d が再実行されない)にも冪等に反映する簡易マイグレーション。
// マイグレーション基盤が無いため、新規カラムはここに ADD COLUMN IF NOT EXISTS で足す。
func EnsureSchema(db *sql.DB) error {
	stmts := []string{
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`,
	}
	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}
