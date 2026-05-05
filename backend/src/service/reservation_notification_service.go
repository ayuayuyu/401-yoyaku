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

func (s *ReservationService) notifyReservationCreated(ctx context.Context, reservation db.Reservation, user db.User) {
	if err := notifySlackReservationCreated(reservation, user); err != nil {
		log.Printf("slack notification failed: %v", err)
	}
	if err := syncGoogleCalendarEvent(ctx, reservation, user); err != nil {
		log.Printf("google calendar sync failed: %v", err)
	}
}

func notifySlackReservationCreated(reservation db.Reservation, user db.User) error {
	if strings.ToLower(os.Getenv("SLACK_NOTIFY_ENABLED")) != "true" {
		return nil
	}

	webhookURL := strings.TrimSpace(os.Getenv("SLACK_WEBHOOK_URL"))
	if webhookURL == "" {
		return fmt.Errorf("SLACK_WEBHOOK_URL is empty")
	}

	message := fmt.Sprintf(
		":spiral_calendar_pad: 新しい予約が登録されました\n予約者: %s\nタイトル: %s\n時間: %s - %s",
		user.Name,
		reservation.Title,
		reservation.StartTime.Format("2006-01-02 15:04"),
		reservation.EndTime.Format("15:04"),
	)

	body, err := json.Marshal(slackPayload{Text: message})
	if err != nil {
		return err
	}

	resp, err := http.Post(webhookURL, "application/json", bytes.NewReader(body))
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
