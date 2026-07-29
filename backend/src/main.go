package main

import (
	"log"
	"net/http"
	"os"
	"strings"

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
	// sql.DBからsqlcのクエリオブジェクトを生成
	queries := db.New(sqlDB)

	// Service層の初期化
	authService := service.NewAuthService(queries)
	reservationService := service.NewReservationService(queries)

	// Handler層の初期化
	authHandler := handler.NewAuthHandler(authService)
	reservationHandler := handler.NewReservationHandler(reservationService)

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
	// Cookie 属性。HTTPS(本番/Cloudflare) では COOKIE_SECURE=true で Secure を付与する。
	store.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   60 * 60 * 24 * 7, // 7日
		HttpOnly: true,
		Secure:   os.Getenv("COOKIE_SECURE") == "true",
		SameSite: http.SameSiteLaxMode,
	}

	// Ginのルーティング
	r := gin.Default()

	// CORS設定 (同一オリジン配信時は不要だが、別オリジン開発用に env で上書き可能)
	config := cors.DefaultConfig()
	config.AllowOrigins = corsAllowOrigins()
	config.AllowCredentials = true
	r.Use(cors.New(config))

	// セッションミドルウェア
	r.Use(func(c *gin.Context) {
		c.Set("session_store", store)
		c.Set("db_queries", queries)
		c.Next()
	})

	// ルーティングの設定
	// ヘルスチェック (compose/nginx/デプロイ検証用)
	r.GET("/health", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

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
	}

	// サーバーの起動
	log.Println("Started server on http://localhost:8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("サーバーの起動に失敗しました: %v", err)
	}
}

// corsAllowOrigins は許可オリジンを環境変数 CORS_ORIGINS (カンマ区切り) から読む。
// 未設定時は開発用の http://localhost:3000 を返す。
func corsAllowOrigins() []string {
	raw := os.Getenv("CORS_ORIGINS")
	if raw == "" {
		return []string{"http://localhost:3000"}
	}
	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	for _, p := range parts {
		if s := strings.TrimSpace(p); s != "" {
			origins = append(origins, s)
		}
	}
	if len(origins) == 0 {
		return []string{"http://localhost:3000"}
	}
	return origins
}
