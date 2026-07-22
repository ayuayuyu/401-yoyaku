package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
	"yoyaku/db"

	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
)

type slackPayload struct {
	Text string `json:"text"`
}

// slackHTTPClient は Slack Webhook への POST に使う。予約作成/キャンセルの
// レスポンスパスから同期的に呼ばれるため、Slack 側の遅延でリクエストが
// 詰まらないようタイムアウトを設定する。
var slackHTTPClient = &http.Client{Timeout: 5 * time.Second}

// jpWeekdays は time.Weekday(日=0) を日本語表記に対応させる。
var jpWeekdays = [...]string{"日", "月", "火", "水", "木", "金", "土"}

func (s *ReservationService) notifyReservationCreated(ctx context.Context, reservation db.Reservation, user db.User) {
	message := formatReservationSlackMessage("✅", "予約しました", reservation, user)
	if err := notifySlack(message); err != nil {
		log.Printf("slack notification failed: %v", err)
	}
	if err := syncGoogleCalendarEvent(ctx, reservation, user); err != nil {
		log.Printf("google calendar sync failed: %v", err)
	}
}

func (s *ReservationService) notifyReservationCanceled(reservation db.Reservation, user db.User) {
	message := formatReservationSlackMessage("❌", "予約をキャンセルしました", reservation, user)
	if err := notifySlack(message); err != nil {
		log.Printf("slack notification failed: %v", err)
	}
}

// formatReservationSlackMessage は「何月何日に誰が予約(またはキャンセル)したか」を
// 主役にした放送文を組み立てる。TIMESTAMPTZ は絶対時刻なので、表示は必ず JST に
// 変換してから月日・曜日・時刻を出す。
func formatReservationSlackMessage(emoji, action string, reservation db.Reservation, user db.User) string {
	loc := mustLoadTokyoLocation()
	start := reservation.StartTime.In(loc)
	end := reservation.EndTime.In(loc)

	dateLabel := fmt.Sprintf("%d月%d日(%s)", int(start.Month()), start.Day(), jpWeekdays[start.Weekday()])

	return fmt.Sprintf(
		"%s %s、%s さんが%s\n🕒 %s〜%s",
		emoji,
		dateLabel,
		user.Name,
		action,
		start.Format("15:04"),
		end.Format("15:04"),
	)
}

func notifySlack(message string) error {
	if strings.ToLower(os.Getenv("SLACK_NOTIFY_ENABLED")) != "true" {
		return nil
	}

	webhookURL := strings.TrimSpace(os.Getenv("SLACK_WEBHOOK_URL"))
	if webhookURL == "" {
		return fmt.Errorf("SLACK_WEBHOOK_URL is empty")
	}

	body, err := json.Marshal(slackPayload{Text: message})
	if err != nil {
		return err
	}

	resp, err := slackHTTPClient.Post(webhookURL, "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("slack webhook status: %d", resp.StatusCode)
	}

	return nil
}

func syncGoogleCalendarEvent(ctx context.Context, reservation db.Reservation, user db.User) error {
	if strings.ToLower(os.Getenv("GOOGLE_CALENDAR_SYNC_ENABLED")) != "true" {
		return nil
	}

	calendarID := strings.TrimSpace(os.Getenv("GOOGLE_CALENDAR_ID"))
	credentialJSON := strings.TrimSpace(os.Getenv("GOOGLE_SERVICE_ACCOUNT_JSON"))
	if calendarID == "" || credentialJSON == "" {
		return fmt.Errorf("google calendar env is not configured")
	}

	svc, err := calendar.NewService(
		ctx,
		option.WithCredentialsJSON([]byte(credentialJSON)),
		option.WithScopes(calendar.CalendarEventsScope),
	)
	if err != nil {
		return err
	}

	event := &calendar.Event{
		Summary:     fmt.Sprintf("%s (%s)", user.Name, reservation.Title),
		Description: fmt.Sprintf("予約者: %s", user.Email),
		Start: &calendar.EventDateTime{
			DateTime: reservation.StartTime.Format(time.RFC3339),
			TimeZone: "Asia/Tokyo",
		},
		End: &calendar.EventDateTime{
			DateTime: reservation.EndTime.Format(time.RFC3339),
			TimeZone: "Asia/Tokyo",
		},
	}

	_, err = svc.Events.Insert(calendarID, event).Do()
	return err
}
