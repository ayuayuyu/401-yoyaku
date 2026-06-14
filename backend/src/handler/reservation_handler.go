package handler

import (
	"errors"
	"net/http"
	"strconv"
	"yoyaku/service"
	"yoyaku/types"
	"yoyaku/utils"

	"github.com/gin-gonic/gin"
)

type ReservationHandler struct {
	service *service.ReservationService
}

func NewReservationHandler(s *service.ReservationService) *ReservationHandler {
	return &ReservationHandler{service: s}
}

func (h *ReservationHandler) Create(c *gin.Context) {
	var req types.ReservationsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "リクエストの形式が正しくありません"})
		return
	}

	userID, ok := utils.GetUserIDFromSession(c)
	if !ok {
		return
	}

	reservation, gcalStatus, err := h.service.Create(c.Request.Context(), userID, req)
	if err != nil {
		handleReservationError(c, err)
		return
	}

	resp := gin.H{
		"status":     "success",
		"id":         reservation.ID,
		"user_id":    reservation.UserID,
		"title":      reservation.Title,
		"start_time": reservation.StartTime,
		"end_time":   reservation.EndTime,
		"notes":      reservation.Notes,
		"created_at": reservation.CreatedAt,
		"updated_at": reservation.UpdatedAt,
	}
	// Google カレンダー連携を要求した場合のみ結果を返す。
	if req.AddToGoogleCalendar {
		resp["google_calendar"] = gcalStatus
	}
	c.JSON(http.StatusOK, resp)
}

func (h *ReservationHandler) GetMe(c *gin.Context) {
	userID, ok := utils.GetUserIDFromSession(c)
	if !ok {
		return
	}

	reservations, err := h.service.GetMyReservations(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "予約の取得に失敗しました"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   reservations,
	})
}

func (h *ReservationHandler) Cancel(c *gin.Context) {
	idStr := c.Query("id")
	if idStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "IDが指定されていません"})
		return
	}

	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "IDの形式が正しくありません"})
		return
	}

	userID, ok := utils.GetUserIDFromSession(c)
	if !ok {
		return
	}

	if err := h.service.Cancel(c.Request.Context(), userID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Reservation Canceled",
	})
}

func (h *ReservationHandler) Edit(c *gin.Context) {
	idStr := c.Query("id")
	if idStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "IDが指定されていません"})
		return
	}

	var req types.ReservationsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "リクエストの形式が正しくありません"})
		return
	}

	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "IDの形式が正しくありません"})
		return
	}

	userID, ok := utils.GetUserIDFromSession(c)
	if !ok {
		return
	}

	updated, err := h.service.Edit(c.Request.Context(), userID, id, req)
	if err != nil {
		handleReservationError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     "success",
		"id":         updated.ID,
		"user_id":    updated.UserID,
		"title":      updated.Title,
		"start_time": updated.StartTime,
		"end_time":   updated.EndTime,
		"notes":      updated.Notes,
		"created_at": updated.CreatedAt,
		"updated_at": updated.UpdatedAt,
	})
}

func (h *ReservationHandler) ListByMonth(c *gin.Context) {
	monthStr := c.Query("month")
	if monthStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "monthクエリパラメータは必須です"})
		return
	}

	reservations, err := h.service.ListByMonth(c.Request.Context(), monthStr)
	if err != nil {
		if errors.Is(err, service.ErrInvalidMonth) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "予約の取得に失敗しました"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": reservations})
}

func handleReservationError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrOverlapping):
		c.JSON(http.StatusConflict, gin.H{"status": "error", "code": "OVERLAPPING_RESERVATION", "message": err.Error()})
	case errors.Is(err, service.ErrInvalidTimeRange):
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "code": "INVALID_TIME_RANGE", "message": err.Error()})
	case errors.Is(err, service.ErrPastDateTime):
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "code": "PAST_DATE_TIME", "message": err.Error()})
	case errors.Is(err, service.ErrOutsideHours):
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "code": "OUTSIDE_BUSINESS_HOURS", "message": err.Error()})
	case errors.Is(err, service.ErrInvalidTitle):
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "code": "INVALID_TITLE", "message": err.Error()})
	case errors.Is(err, service.ErrNotFoundOrDenied):
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "code": "RESERVATION_NOT_FOUND", "message": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "code": "INTERNAL_ERROR", "message": "予約処理に失敗しました"})
	}
}

func (h *ReservationHandler) ListByWeek(c *gin.Context) {
	startStr := c.Query("start")
	endStr := c.Query("end")
	if startStr == "" || endStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "startとendクエリパラメータは必須です"})
		return
	}

	reservations, err := h.service.ListByWeek(c.Request.Context(), startStr, endStr)
	if err != nil {
		if errors.Is(err, service.ErrInvalidDate) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "予約の取得に失敗しました"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": reservations})
}

func (h *ReservationHandler) ListByDate(c *gin.Context) {
	dateStr := c.Query("date")
	if dateStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "dateクエリパラメータは必須です"})
		return
	}

	reservations, err := h.service.ListByDate(c.Request.Context(), dateStr)
	if err != nil {
		if errors.Is(err, service.ErrInvalidDate) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "予約の取得に失敗しました"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": reservations})
}
