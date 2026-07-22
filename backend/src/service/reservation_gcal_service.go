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

	svc, err := newReserverCalendarService(ctx, user)
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

	// キャンセル同期用にイベントIDを保存する (ベストエフォート)。
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

// newReserverCalendarService は予約者本人の refresh token から Google Calendar
// クライアントを生成する。refresh token の有無は呼び出し側で確認済みとする。
func newReserverCalendarService(ctx context.Context, user db.User) (*calendar.Service, error) {
	if auth.GoogleOauthConfig == nil {
		return nil, fmt.Errorf("oauth config is not initialized")
	}
	// refresh token から自動更新されるトークンソースを作る。
	tokenSource := auth.GoogleOauthConfig.TokenSource(ctx, &oauth2.Token{
		RefreshToken: user.GoogleRefreshToken.String,
	})
	return calendar.NewService(ctx, option.WithTokenSource(tokenSource))
}

// deleteReserverGoogleCalendarEvent は予約者本人のカレンダーから予定を削除する
// (キャンセル同期)。refresh token が無い場合や削除失敗はログのみで、キャンセル
// 処理自体は成功させる。
func (s *ReservationService) deleteReserverGoogleCalendarEvent(ctx context.Context, user db.User, eventID string) {
	if !user.GoogleRefreshToken.Valid || user.GoogleRefreshToken.String == "" {
		return
	}

	svc, err := newReserverCalendarService(ctx, user)
	if err != nil {
		log.Printf("personal google calendar: new service failed: %v", err)
		return
	}

	if err := svc.Events.Delete("primary", eventID).Do(); err != nil {
		log.Printf("personal google calendar: delete failed: %v", err)
	}
}
