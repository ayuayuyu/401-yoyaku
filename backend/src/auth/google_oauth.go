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
		Scopes:       []string{"https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"},
		Endpoint:     google.Endpoint,
	}
	return nil
}

func GetUserInfo(state string, code string) ([]byte, error) {
	if state != OauthStateString {
		return nil, fmt.Errorf("invalid oauth state")
	}

	token, err := GoogleOauthConfig.Exchange(context.Background(), code)
	if err != nil {
		return nil, fmt.Errorf("code exchange failed: %s", err.Error())
	}

	response, err := http.Get("https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + token.AccessToken)
	if err != nil {
		return nil, fmt.Errorf("failed getting user info: %s", err.Error())
	}
	defer response.Body.Close()

	contents, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, fmt.Errorf("failed reading response body: %s", err.Error())
	}

	return contents, nil
}
