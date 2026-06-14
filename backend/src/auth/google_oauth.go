package auth

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

var (
	// GoogleOauthConfig は、外部のハンドラから参照できるように公開します。
	GoogleOauthConfig *oauth2.Config
	// OauthStateString は、ログインリクエストとコールバックでstateを検証するために使用します。
	OauthStateString = "random" // 本番環境ではセッションごとにランダムな文字列を生成することを推奨します。
)

func Setup() error {
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	if clientID == "" {
		return fmt.Errorf("環境変数 GOOGLE_CLIENT_ID が設定されていません")
	}

	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	if clientSecret == "" {
		return fmt.Errorf("環境変数 GOOGLE_CLIENT_SECRET が設定されていません")
	}

	GoogleOauthConfig = &oauth2.Config{
		RedirectURL:  "http://localhost:8080/callback",
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
			// 予約者本人の Google カレンダーにイベントを作成するため
			"https://www.googleapis.com/auth/calendar.events",
		},
		Endpoint: google.Endpoint,
	}
	return nil
}

// AuthCodeURL は refresh token を確実に取得するため、オフラインアクセス＋
// 再同意 (consent) を付与した認可 URL を返す。consent を強制しないと 2 回目
// 以降のログインで refresh token が返らないことがある。
func AuthCodeURL(state string) string {
	return GoogleOauthConfig.AuthCodeURL(
		state,
		oauth2.AccessTypeOffline,
		oauth2.ApprovalForce,
	)
}

// GetUserInfo は code を交換してユーザー情報を取得し、併せて発行された
// トークン (refresh token を含む) を返す。呼び出し側で refresh token を保存する。
func GetUserInfo(state string, code string) ([]byte, *oauth2.Token, error) {
	if state != OauthStateString {
		return nil, nil, fmt.Errorf("invalid oauth state")
	}

	token, err := GoogleOauthConfig.Exchange(context.Background(), code)
	if err != nil {
		return nil, nil, fmt.Errorf("code exchange failed: %s", err.Error())
	}

	response, err := http.Get("https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + token.AccessToken)
	if err != nil {
		return nil, nil, fmt.Errorf("failed getting user info: %s", err.Error())
	}
	defer response.Body.Close()

	contents, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, nil, fmt.Errorf("failed reading response body: %s", err.Error())
	}

	return contents, token, nil
}
