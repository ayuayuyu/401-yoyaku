package types

import (
	"time"
)

type ReservationsRequest struct {
	Title     string    `json:"title" binding:"required"`
	StartTime time.Time `json:"start_time" binding:"required"`
	EndTime   time.Time `json:"end_time" binding:"required"`
	Notes     string    `json:"notes"`
	// true のとき予約者本人の Google カレンダーにも予定を作成する
	AddToGoogleCalendar bool `json:"add_to_google_calendar"`
}
