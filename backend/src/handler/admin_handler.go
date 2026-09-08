package handler

import (
	"errors"
	"net/http"
	"time"
	"yoyaku/db"
	"yoyaku/service"

	"github.com/gin-gonic/gin"
)

type AdminHandler struct {
	service *service.AdminService
}

func NewAdminHandler(s *service.AdminService) *AdminHandler {
	return &AdminHandler{service: s}
}

// ListUsers は全ユーザーを利用状況つきで返す。sql.Null* をそのまま JSON 化すると
// {"String":..,"Valid":..} になり扱いづらいため、素の値へ整形して返す。
func (h *AdminHandler) ListUsers(c *gin.Context) {
	rows, err := h.service.ListUsersWithStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}

	data := make([]gin.H, 0, len(rows))
	for _, u := range rows {
		var lastLogin *time.Time
		if u.LastLoginAt.Valid {
			t := u.LastLoginAt.Time
			lastLogin = &t
		}
		data = append(data, gin.H{
			"id":                u.ID,
			"name":              u.Name,
			"email":             u.Email,
			"avatar_url":        u.AvatarUrl.String,
			"role":              u.Role,
			"last_login_at":     lastLogin,
			"created_at":        u.CreatedAt,
			"reservation_count": u.ReservationCount,
			"total_seconds":     u.TotalSeconds,
		})
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": data})
}

type updateRoleRequest struct {
	UserID int64  `json:"user_id"`
	Role   string `json:"role"`
}

// UpdateRole は対象ユーザーの role を変更する (管理者権限の付与/解除)。
func (h *AdminHandler) UpdateRole(c *gin.Context) {
	var req updateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "リクエストの形式が正しくありません"})
		return
	}

	// AdminMiddleware がセッションから解決した実行者。自己変更の判定に使う。
	actor, ok := c.MustGet("current_user").(db.User)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "実行ユーザーの特定に失敗しました"})
		return
	}

	if err := h.service.UpdateUserRole(c.Request.Context(), actor.ID, req.UserID, req.Role); err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidRole), errors.Is(err, service.ErrCannotChangeSelf):
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// ListReservations は全ユーザーの確定済み予約を予約者名つきで返す (閲覧のみ)。
func (h *AdminHandler) ListReservations(c *gin.Context) {
	rows, err := h.service.ListAllReservations(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": rows})
}
