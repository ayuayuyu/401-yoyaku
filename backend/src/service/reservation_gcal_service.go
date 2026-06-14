package service

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"
	"yoyaku/auth"
	"yoyaku/db"

	"golang.org/x/oauth2"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
)

// 予約作成時の本人 Google カレンダー連携の結果ステータス。
const (
	GCalStatusAdded        = "added"         // 本人カレンダーに作成できた
	GCalStatusNeedsRelogin = "needs_relogin" // refresh token が無く再ログインが必要
	GCalStatusFailed       = "failed"        // 連携に失敗した
)

// addToReserverGoogleCalendar は予約者本人の Google カレンダー(primary)に
// 予定を作成する。refresh token を保存していない (Calendar 権限に未同意の)
// ユーザーには needs_relogin を返す。連携失敗はログに残すが、予約自体は
// 成功させるため呼び出し側にエラーは返さない (ステータス文字列のみ)。
func (s *ReservationService) addToReserverGoogleCalendar(
	ctx context.Context,
	user db.User,
	reservation db.Reservation,
) string {
	if !user.GoogleRefreshToken.Valid || user.GoogleRefreshToken.String == "" {
		return GCalStatusNeedsRelogin
	}
	if auth.GoogleOauthConfig == nil {
		log.Printf("personal google calendar: oauth config is not initialized")
		return GCalStatusFailed
	}

	// refresh token から自動更新されるトークンソースを作る。
	tokenSource := auth.GoogleOauthConfig.TokenSource(ctx, &oauth2.Token{
		RefreshToken: user.GoogleRefreshToken.String,
	})

	svc, err := calendar.NewService(ctx, option.WithTokenSource(tokenSource))
	if err != nil {
		log.Printf("personal google calendar: new service failed: %v", err)
		return GCalStatusFailed
	}

	event := &calendar.Event{
		Summary:     reservation.Title,
		Description: fmt.Sprintf("401号室予約\n予約者: %s", user.Name),
		Start: &calendar.EventDateTime{
			DateTime: reservation.StartTime.Format(time.RFC3339),
			TimeZone: "Asia/Tokyo",
		},
		End: &calendar.EventDateTime{
			DateTime: reservation.EndTime.Format(time.RFC3339),
			TimeZone: "Asia/Tokyo",
		},
	}

	created, err := svc.Events.Insert("primary", event).Do()
	if err != nil {
		log.Printf("personal google calendar: insert failed: %v", err)
		return GCalStatusFailed
	}

	// 将来のキャンセル同期用にイベントIDを保存する (ベストエフォート)。
	if created != nil && created.Id != "" {
		if err := s.queries.SetReservationGoogleEventID(ctx, db.SetReservationGoogleEventIDParams{
			ID:            reservation.ID,
			GoogleEventID: sql.NullString{String: created.Id, Valid: true},
		}); err != nil {
			log.Printf("personal google calendar: save event id failed: %v", err)
		}
	}

	return GCalStatusAdded
}
