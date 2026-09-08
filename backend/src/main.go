package main

import (
	"log"
	"net/http"
	"os"

	"yoyaku/auth"
	"yoyaku/db"
	"yoyaku/handler"
	"yoyaku/service"
	"yoyaku/utils"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/sessions"
)

func main() {

	// データベースとの接続
	sqlDB, err := utils.NewDBConnection()
	if err != nil {
		log.Fatalf("データベースに接続できませんでした: %v", err)
	}
	defer sqlDB.Close()

	// schema.sql に後から追加した列を既存DBへ冪等に反映する (簡易マイグレーション)。
	if err := utils.EnsureSchema(sqlDB); err != nil {
		log.Fatalf("スキーマの適用に失敗しました: %v", err)
	}

	// sql.DBからsqlcのクエリオブジェクトを生成
	queries := db.New(sqlDB)

	// Service層の初期化
	authService := service.NewAuthService(queries)
	reservationService := service.NewReservationService(queries)
	adminService := service.NewAdminService(queries)

	// Handler層の初期化
	authHandler := handler.NewAuthHandler(authService)
	reservationHandler := handler.NewReservationHandler(reservationService)
	adminHandler := handler.NewAdminHandler(adminService)

	// OAuth設定の初期化
	if err := auth.Setup(); err != nil {
		log.Fatalf("OAuth設定の初期化に失敗しました: %v", err)
	}

	secretKey := os.Getenv("SECRET_KEY")
	if secretKey == "" {
		log.Fatalf("環境変数 SECRET_KEY が設定されていません")
	}

	// セッション情報を保存するためのストア
	var store = sessions.NewCookieStore([]byte(secretKey))
	// Cookie の既定オプション。本番 (HTTPS) では COOKIE_SECURE=true で Secure 化する。
	store.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   86400 * 7,
		HttpOnly: true,
		Secure:   os.Getenv("COOKIE_SECURE") == "true",
		SameSite: http.SameSiteLaxMode,
	}

	// Ginのルーティング
	r := gin.Default()

	// CORS設定。本番はフロントの公開オリジンを許可する (未設定時は開発用)。
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{frontendURL}
	config.AllowCredentials = true
	r.Use(cors.New(config))

	// ヘルスチェック (compose / デプロイ検証用)。
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// セッションミドルウェア
	r.Use(func(c *gin.Context) {
		c.Set("session_store", store)
		c.Set("db_queries", queries)
		c.Next()
	})

	// ルーティングの設定
	r.GET("/login", handler.HandleGoogleLogin)
	r.GET("/callback", authHandler.HandleGoogleCallback)

	api := r.Group("/api")
	{
		// ユーザー認証関連
		api.GET("/me", handler.HandleGetMe)
		api.PUT("/me", authHandler.HandleUpdateMe)
		api.POST("/logout", handler.HandleLogout)

		// 予約関連のAPIをグループ化
		reservations := api.Group("/reservations")
		{
			reservations.POST("", reservationHandler.Create)
			reservations.PUT("", reservationHandler.Edit)
			reservations.GET("/me", reservationHandler.GetMe)
			reservations.PUT("/cancel", reservationHandler.Cancel)

			reservations.GET("", func(c *gin.Context) {
				if c.Query("month") != "" {
					reservationHandler.ListByMonth(c)
				} else if c.Query("start") != "" && c.Query("end") != "" {
					reservationHandler.ListByWeek(c)
				} else if c.Query("date") != "" {
					reservationHandler.ListByDate(c)
				} else {
					c.JSON(http.StatusBadRequest, gin.H{"error": "有効なクエリパラメータがありません"})
				}
			})
		}

		// 管理者専用のAPI。AdminMiddleware で role=admin 以外を 403 で弾く。
		admin := api.Group("/admin")
		admin.Use(utils.AdminMiddleware())
		{
			admin.GET("/users", adminHandler.ListUsers)
			admin.PUT("/users/role", adminHandler.UpdateRole)
			admin.GET("/reservations", adminHandler.ListReservations)
		}
	}

	// サーバーの起動
	log.Println("Started server on http://localhost:8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("サーバーの起動に失敗しました: %v", err)
	}
}
