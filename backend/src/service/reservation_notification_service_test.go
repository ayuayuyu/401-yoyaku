package service

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
	"yoyaku/db"
)

func testReservationAndUser() (db.Reservation, db.User) {
	// 2026-07-22(水) 10:00 JST の予約。TIMESTAMPTZ 相当の絶対時刻として渡す。
	start := time.Date(2026, 7, 22, 10, 0, 0, 0, mustLoadTokyoLocation())
	res := db.Reservation{
		ID:        1,
		UserID:    42,
		Title:     "定例MTG",
		StartTime: start,
		EndTime:   start.Add(time.Hour),
	}
	user := db.User{ID: 42, Name: "山田太郎"}
	return res, user
}

func TestNotifySlackSendsPayloadWhenEnabled(t *testing.T) {
	received := make(chan slackPayload, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var p slackPayload
		if err := json.Unmarshal(body, &p); err != nil {
			t.Errorf("invalid json body: %v", err)
		}
		received <- p
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	t.Setenv("SLACK_NOTIFY_ENABLED", "true")
	t.Setenv("SLACK_WEBHOOK_URL", srv.URL)

	res, user := testReservationAndUser()
	msg := formatReservationSlackMessage("❌", "予約をキャンセルしました", res, user)
	if err := notifySlack(msg); err != nil {
		t.Fatalf("notifySlack returned error: %v", err)
	}

	select {
	case p := <-received:
		if p.Text != msg {
			t.Errorf("unexpected text.\n got: %q\nwant: %q", p.Text, msg)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("webhook was not called")
	}
}

func TestNotifySlackNoopWhenDisabled(t *testing.T) {
	called := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	t.Setenv("SLACK_NOTIFY_ENABLED", "false")
	t.Setenv("SLACK_WEBHOOK_URL", srv.URL)

	if err := notifySlack("hello"); err != nil {
		t.Fatalf("notifySlack returned error: %v", err)
	}
	if called {
		t.Error("webhook should not be called when disabled")
	}
}

func TestFormatReservationSlackMessage(t *testing.T) {
	res, user := testReservationAndUser()
	got := formatReservationSlackMessage("✅", "予約しました", res, user)
	want := "✅ 7月22日(水)、山田太郎 さんが予約しました\n🕒 10:00〜11:00"
	if got != want {
		t.Errorf("unexpected message.\n got: %q\nwant: %q", got, want)
	}
}
