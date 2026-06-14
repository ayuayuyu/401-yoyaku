package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
	"yoyaku/db"
	"yoyaku/types"
)

var (
	ErrOverlapping      = errors.New("この時間帯には既に予約があります")
	ErrCreateFailed     = errors.New("予約の登録に失敗しました")
	ErrFetchFailed      = errors.New("予約情報の取得に失敗しました")
	ErrCancelFailed     = errors.New("予約のキャンセルに失敗しました")
	ErrEditFailed       = errors.New("予約の編集に失敗しました")
	ErrInvalidMonth     = errors.New("monthの形式が正しくありません (YYYY-MM)")
	ErrInvalidDate      = errors.New("日付の形式が正しくありません (YYYY-MM-DD)")
	ErrInvalidTimeRange = errors.New("開始時刻より後の終了時刻を指定してください")
	ErrPastDateTime     = errors.New("指定した時刻は既に過ぎています")
	ErrOutsideHours     = errors.New("予約可能時間は9:00から22:00までです")
	ErrInvalidTitle     = errors.New("タイトルは必須です")
	ErrOverlapCheckFail = errors.New("重複チェック中にエラーが発生しました")
	ErrNotFoundOrDenied = errors.New("対象の予約が見つからないか、編集権限がありません")
)

type ReservationService struct {
	queries *db.Queries
}

func NewReservationService(queries *db.Queries) *ReservationService {
	return &ReservationService{queries: queries}
}

// Create は予約を登録する。第 2 戻り値は本人 Google カレンダー連携の結果
// ("" / added / needs_relogin / failed)。req.AddToGoogleCalendar が false の
// ときは "" を返す。カレンダー連携の失敗は予約自体を失敗させない。
func (s *ReservationService) Create(ctx context.Context, userID int64, req types.ReservationsRequest) (db.Reservation, string, error) {
	if err := validateReservationRequest(req); err != nil {
		return db.Reservation{}, "", err
	}

	// 重複チェック
	count, err := s.queries.CheckOverlappingReservation(ctx, db.CheckOverlappingReservationParams{
		StartTime: req.EndTime,
		EndTime:   req.StartTime,
	})
	if err != nil {
		return db.Reservation{}, "", ErrOverlapCheckFail
	}
	if count > 0 {
		return db.Reservation{}, "", ErrOverlapping
	}

	// 登録
	_, err = s.queries.CreateReservation(ctx, db.CreateReservationParams{
		UserID:    userID,
		Title:     req.Title,
		StartTime: req.StartTime,
		EndTime:   req.EndTime,
		Notes:     req.Notes,
	})
	if err != nil {
		return db.Reservation{}, "", ErrCreateFailed
	}

	// 作成した予約を取得
	reservation, err := s.queries.GetReservationLastInserted(ctx)
	if err != nil {
		return db.Reservation{}, "", ErrFetchFailed
	}

	// 通知・本人カレンダー連携にはユーザー情報が必要。
	gcalStatus := ""
	if user, userErr := s.queries.GetUserByID(ctx, userID); userErr == nil {
		s.notifyReservationCreated(ctx, reservation, user)
		if req.AddToGoogleCalendar {
			gcalStatus = s.addToReserverGoogleCalendar(ctx, user, reservation)
		}
	} else if req.AddToGoogleCalendar {
		gcalStatus = GCalStatusFailed
	}

	return reservation, gcalStatus, nil
}

func (s *ReservationService) GetMyReservations(ctx context.Context, userID int64) ([]db.Reservation, error) {
	reservations, err := s.queries.ListReservationsByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("予約取得エラー: %w", err)
	}
	return reservations, nil
}

func (s *ReservationService) Cancel(ctx context.Context, userID int64, id int64) error {
	err := s.queries.CanceledReservationByID(ctx, db.CanceledReservationByIDParams{
		UserID: userID,
		ID:     id,
	})
	if err != nil {
		return ErrCancelFailed
	}
	return nil
}

func (s *ReservationService) Edit(ctx context.Context, userID int64, id int64, req types.ReservationsRequest) (db.Reservation, error) {
	if err := validateReservationRequest(req); err != nil {
		return db.Reservation{}, err
	}

	count, err := s.queries.CheckOverlappingReservationForUpdate(ctx, db.CheckOverlappingReservationForUpdateParams{
		ID:        id,
		StartTime: req.EndTime,
		EndTime:   req.StartTime,
	})
	if err != nil {
		return db.Reservation{}, ErrOverlapCheckFail
	}
	if count > 0 {
		return db.Reservation{}, ErrOverlapping
	}

	result, err := s.queries.UpdateReservationByID(ctx, db.UpdateReservationByIDParams{
		Title:     req.Title,
		StartTime: req.StartTime,
		EndTime:   req.EndTime,
		Notes:     req.Notes,
		ID:        id,
		UserID:    userID,
	})
	if err != nil {
		return db.Reservation{}, ErrEditFailed
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return db.Reservation{}, ErrEditFailed
	}
	if affected == 0 {
		return db.Reservation{}, ErrNotFoundOrDenied
	}

	updated, err := s.queries.GetReservationByID(ctx, id)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return db.Reservation{}, ErrFetchFailed
	}
	if errors.Is(err, sql.ErrNoRows) {
		return db.Reservation{}, ErrNotFoundOrDenied
	}
	return updated, nil
}

func (s *ReservationService) ListByMonth(ctx context.Context, monthStr string) ([]db.ListReservationsByMonthRow, error) {
	layout := "2006-01"
	loc := mustLoadTokyoLocation()
	t, err := time.ParseInLocation(layout, monthStr, loc)
	if err != nil {
		return nil, ErrInvalidMonth
	}

	startOfMonth := t
	endOfMonth := t.AddDate(0, 1, 0)

	reservations, err := s.queries.ListReservationsByMonth(ctx, db.ListReservationsByMonthParams{
		EndTime:   startOfMonth,
		StartTime: endOfMonth,
	})
	if err != nil {
		return nil, ErrFetchFailed
	}

	if reservations == nil {
		reservations = []db.ListReservationsByMonthRow{}
	}
	return reservations, nil
}

func (s *ReservationService) ListByWeek(ctx context.Context, startStr, endStr string) ([]db.ListReservationsByWeekRow, error) {
	layout := "2006-01-02"
	loc := mustLoadTokyoLocation()
	startTime, err1 := time.ParseInLocation(layout, startStr, loc)
	endTime, err2 := time.ParseInLocation(layout, endStr, loc)
	if err1 != nil || err2 != nil {
		return nil, ErrInvalidDate
	}

	endTime = endTime.AddDate(0, 0, 1)

	reservations, err := s.queries.ListReservationsByWeek(ctx, db.ListReservationsByWeekParams{
		StartTime: endTime,
		EndTime:   startTime,
	})
	if err != nil {
		return nil, ErrFetchFailed
	}

	if reservations == nil {
		reservations = []db.ListReservationsByWeekRow{}
	}
	return reservations, nil
}

func (s *ReservationService) ListByDate(ctx context.Context, dateStr string) ([]db.ListReservationsByDateRow, error) {
	layout := "2006-01-02"
	loc := mustLoadTokyoLocation()
	date, err := time.ParseInLocation(layout, dateStr, loc)
	if err != nil {
		return nil, ErrInvalidDate
	}

	startOfDay := date
	endOfDay := date.AddDate(0, 0, 1)

	reservations, err := s.queries.ListReservationsByDate(ctx, db.ListReservationsByDateParams{
		StartTime: endOfDay,
		EndTime:   startOfDay,
	})
	if err != nil {
		return nil, ErrFetchFailed
	}

	if reservations == nil {
		reservations = []db.ListReservationsByDateRow{}
	}
	return reservations, nil
}

func validateReservationRequest(req types.ReservationsRequest) error {
	if strings.TrimSpace(req.Title) == "" {
		return ErrInvalidTitle
	}
	if !req.EndTime.After(req.StartTime) {
		return ErrInvalidTimeRange
	}

	now := time.Now()
	if !req.StartTime.After(now) || !req.EndTime.After(now) {
		return ErrPastDateTime
	}

	loc := mustLoadTokyoLocation()
	start := req.StartTime.In(loc)
	end := req.EndTime.In(loc)

	if start.Day() != end.Day() || start.Month() != end.Month() || start.Year() != end.Year() {
		return ErrOutsideHours
	}

	dayStart := time.Date(start.Year(), start.Month(), start.Day(), 9, 0, 0, 0, loc)
	dayEnd := time.Date(start.Year(), start.Month(), start.Day(), 22, 0, 0, 0, loc)
	if start.Before(dayStart) || end.After(dayEnd) {
		return ErrOutsideHours
	}

	return nil
}

func mustLoadTokyoLocation() *time.Location {
	loc, err := time.LoadLocation("Asia/Tokyo")
	if err != nil {
		return time.Local
	}
	return loc
}
