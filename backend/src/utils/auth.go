package utils

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"yoyaku/db"
	"yoyaku/service"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/sessions"
)

// GetUserIDFromSession は、Ginのコンテキストからセッション情報を取得し、ユーザーIDを返します。
// 処理中にエラーが発生した場合は、自動的にクライアントにエラーレスポンスを返し、falseを返します。
// 成功した場合は、ユーザーID(int64)とtrueを返します。
func GetUserIDFromSession(c *gin.Context) (int64, bool) {
	storeValue, ok := c.Get("session_store")
	if !ok {
		log.Println("セッションストアの取得に失敗しました")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "サーバー内部エラーが発生しました"})
		c.Abort()
		return 0, false
	}

	store, ok := storeValue.(*sessions.CookieStore)
	if !ok {
		log.Println("セッションストアの型変換に失敗しました")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "サーバー内部エラーが発生しました"})
		c.Abort()
		return 0, false
	}

	session, _ := store.Get(c.Request, "session-name")

	if userID, ok := getValidUserID(c, session); ok {
		return userID, true
	}

	googleID, _ := session.Values["user_google_id"].(string)
	email, _ := session.Values["user_email"].(string)
	name, _ := session.Values["user_name"].(string)
	picture, _ := session.Values["user_picture"].(string)
	if email == "" || name == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "ログイン情報が見つかりません"})
		c.Abort()
		return 0, false
	}

	queriesValue, ok := c.Get("db_queries")
	if !ok {
		log.Println("db_queriesの取得に失敗しました")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "サーバー内部エラーが発生しました"})
		c.Abort()
		return 0, false
	}

	queries, ok := queriesValue.(*db.Queries)
	if !ok {
		log.Println("db_queriesの型変換に失敗しました")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "サーバー内部エラーが発生しました"})
		c.Abort()
		return 0, false
	}

	authService := service.NewAuthService(queries)
	user, err := authService.FindOrCreateUser(context.Background(), service.GoogleUserInfo{
		ID:      googleID,
		Email:   email,
		Name:    name,
		Picture: picture,
	})
	if err != nil {
		log.Println("ユーザーの再作成に失敗しました:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "ユーザー情報の復元に失敗しました"})
		c.Abort()
		return 0, false
	}

	session.Values["user_id"] = fmt.Sprintf("%d", user.ID)
	session.Values["user_email"] = user.Email
	session.Values["user_name"] = user.Name
	session.Values["user_picture"] = user.AvatarUrl.String
	if err := session.Save(c.Request, c.Writer); err != nil {
		log.Println("セッションの再保存に失敗しました:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "セッションの保存に失敗しました"})
		c.Abort()
		return 0, false
	}

	return user.ID, true
}

// AdminMiddleware は管理者専用ルートを保護する Gin ミドルウェア。
// セッションからユーザーを特定し、DB から最新の role を引いて "admin" 以外を
// 403 で弾く。role は DB を正とするため、権限変更が即時に反映される。
// 認証に成功したユーザーは c.Set("current_user", user) で後続ハンドラに渡す。
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := GetUserIDFromSession(c)
		if !ok {
			// GetUserIDFromSession が既にエラーレスポンスを返し Abort 済み。
			return
		}

		queriesValue, ok := c.Get("db_queries")
		if !ok {
			log.Println("db_queriesの取得に失敗しました")
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "サーバー内部エラーが発生しました"})
			c.Abort()
			return
		}
		queries, ok := queriesValue.(*db.Queries)
		if !ok {
			log.Println("db_queriesの型変換に失敗しました")
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "サーバー内部エラーが発生しました"})
			c.Abort()
			return
		}

		user, err := queries.GetUserByID(c.Request.Context(), userID)
		if err != nil || user.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"status": "error", "message": "管理者権限が必要です"})
			c.Abort()
			return
		}

		c.Set("current_user", user)
		c.Next()
	}
}

func getValidUserID(c *gin.Context, session *sessions.Session) (int64, bool) {
	userIDStr, ok := session.Values["user_id"].(string)
	if !ok || userIDStr == "" {
		return 0, false
	}

	userID, err := strconv.ParseInt(userIDStr, 10, 64)
	if err != nil || userID < 0 {
		return 0, false
	}

	queriesValue, ok := c.Get("db_queries")
	if !ok {
		return userID, true
	}
	queries, ok := queriesValue.(*db.Queries)
	if !ok {
		return 0, false
	}

	if _, err := queries.GetUserByID(c.Request.Context(), userID); err == nil {
		return userID, true
	}

	return 0, false
}
