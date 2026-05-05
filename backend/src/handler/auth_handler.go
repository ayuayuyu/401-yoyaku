package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"yoyaku/auth"
	"yoyaku/service"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/sessions"
)

type AuthHandler struct {
	service *service.AuthService
}

func NewAuthHandler(s *service.AuthService) *AuthHandler {
	return &AuthHandler{service: s}
}

// GoogleのOAuthコールバックハンドラ
func (h *AuthHandler) HandleGoogleCallback(c *gin.Context) {
	state := c.Query("state")
	code := c.Query("code")

	frontendUrl := os.Getenv("FRONTEND_URL")
	if frontendUrl == "" {
		log.Fatalf("環境変数 FRONTEND_URL が設定されていません")
	}

	// Googleからユーザー情報を取得
	content, err := auth.GetUserInfo(state, code)
	if err != nil {
		log.Println(err.Error())
		c.Redirect(http.StatusTemporaryRedirect, frontendUrl+"/login?error=true")
		return
	}

	// JSONをパース
	var googleUser service.GoogleUserInfo
	if err := json.Unmarshal(content, &googleUser); err != nil {
		log.Println("JSON Unmarshal error:", err)
		c.Redirect(http.StatusTemporaryRedirect, frontendUrl+"/login?error=true")
		return
	}

	// pluslab.org ドメインのみ許可
	if !strings.HasSuffix(googleUser.Email, "@pluslab.org") {
		log.Println("Unauthorized domain access attempt:", googleUser.Email)
		c.Redirect(http.StatusTemporaryRedirect, frontendUrl+"/login?error=domain")
		return
	}

	// ユーザー取得または作成（Serviceに委譲）
	dbUser, err := h.service.FindOrCreateUser(context.Background(), googleUser)
	if err != nil {
		log.Println(err.Error())
		c.Redirect(http.StatusTemporaryRedirect, frontendUrl+"/login?error=true")
		return
	}

	// セッションに保存
	store := c.MustGet("session_store").(*sessions.CookieStore)
	session, _ := store.Get(c.Request, "session-name")

	session.Values["user_id"] = fmt.Sprintf("%d", dbUser.ID)
	session.Values["user_google_id"] = dbUser.GoogleID
	session.Values["user_email"] = dbUser.Email
	session.Values["user_name"] = dbUser.Name
	session.Values["user_picture"] = dbUser.AvatarUrl.String

	if err := session.Save(c.Request, c.Writer); err != nil {
		log.Println("セッション保存失敗:", err)
		c.Redirect(http.StatusTemporaryRedirect, frontendUrl+"/login?error=true")
		return
	}

	// フロントエンドへリダイレクト
	c.Redirect(http.StatusPermanentRedirect, frontendUrl)
}

// 現在のユーザー情報を返す
func HandleGetMe(c *gin.Context) {
	store := c.MustGet("session_store").(*sessions.CookieStore)
	session, _ := store.Get(c.Request, "session-name")

	userID, ok := session.Values["user_id"].(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":      userID,
		"email":   session.Values["user_email"],
		"name":    session.Values["user_name"],
		"picture": session.Values["user_picture"],
	})
}

// ログアウト処理
func HandleLogout(c *gin.Context) {
	store := c.MustGet("session_store").(*sessions.CookieStore)
	session, _ := store.Get(c.Request, "session-name")

	session.Values["user_id"] = ""
	session.Options.MaxAge = -1

	if err := session.Save(c.Request, c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to logout"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}

// Googleログイン開始
func HandleGoogleLogin(c *gin.Context) {
	url := auth.GoogleOauthConfig.AuthCodeURL(auth.OauthStateString)
	c.Redirect(http.StatusTemporaryRedirect, url)
}
