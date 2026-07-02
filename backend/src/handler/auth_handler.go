package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
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

	// Googleからユーザー情報とトークンを取得
	content, token, err := auth.GetUserInfo(state, code)
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

	// 本人カレンダー連携用に refresh token を保存する。
	// Google は再同意時などにしか refresh token を返さないため、空でない時だけ更新。
	if token != nil && token.RefreshToken != "" {
		if err := h.service.SaveGoogleRefreshToken(context.Background(), dbUser.ID, token.RefreshToken); err != nil {
			log.Println("refresh token の保存に失敗:", err)
		}
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

// マイページからの表示名更新リクエスト
type updateMeRequest struct {
	Name string `json:"name"`
}

// HandleUpdateMe はマイページから送られた表示名 (users.name) を更新し、
// セッションの user_name も同期する。フロントの userAtom はレスポンスから
// 再構築する。
func (h *AuthHandler) HandleUpdateMe(c *gin.Context) {
	store := c.MustGet("session_store").(*sessions.CookieStore)
	session, _ := store.Get(c.Request, "session-name")

	userIDStr, ok := session.Values["user_id"].(string)
	if !ok || userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	userID, err := strconv.ParseInt(userIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req updateMeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "リクエストの形式が正しくありません"})
		return
	}

	user, err := h.service.UpdateUserName(c.Request.Context(), userID, req.Name)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidUserName), errors.Is(err, service.ErrUserNameTooLong):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			log.Println("ユーザー名更新失敗:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "表示名の更新に失敗しました"})
		}
		return
	}

	session.Values["user_name"] = user.Name
	if err := session.Save(c.Request, c.Writer); err != nil {
		log.Println("セッション保存失敗:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "セッション保存に失敗しました"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":      userIDStr,
		"email":   user.Email,
		"name":    user.Name,
		"picture": user.AvatarUrl.String,
	})
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
	url := auth.AuthCodeURL(auth.OauthStateString)
	c.Redirect(http.StatusTemporaryRedirect, url)
}
