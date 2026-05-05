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
