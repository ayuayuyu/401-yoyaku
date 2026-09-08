package service

import (
	"context"
	"errors"
	"fmt"
	"yoyaku/db"
)

var (
	ErrInvalidRole      = errors.New("role は 'user' または 'admin' を指定してください")
	ErrCannotChangeSelf = errors.New("自分自身の権限は変更できません")
)

// AdminService は管理者向けの参照・権限操作をまとめる。
type AdminService struct {
	queries *db.Queries
}

func NewAdminService(queries *db.Queries) *AdminService {
	return &AdminService{queries: queries}
}

// ListUsersWithStats は全ユーザーを利用状況 (予約回数・累計利用秒数) と
// 最終ログイン日時つきで返す。
func (s *AdminService) ListUsersWithStats(ctx context.Context) ([]db.ListUsersWithStatsRow, error) {
	rows, err := s.queries.ListUsersWithStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("ユーザー一覧の取得に失敗しました: %w", err)
	}
	if rows == nil {
		rows = []db.ListUsersWithStatsRow{}
	}
	return rows, nil
}

// UpdateUserRole は対象ユーザーの role を変更する。
// role は "user" / "admin" のみ許可し、実行者自身の role 変更は
// 意図しない権限喪失 (ロックアウト) を防ぐため拒否する。
func (s *AdminService) UpdateUserRole(ctx context.Context, actorID, targetID int64, role string) error {
	if role != "user" && role != "admin" {
		return ErrInvalidRole
	}
	if actorID == targetID {
		return ErrCannotChangeSelf
	}
	if err := s.queries.UpdateUserRole(ctx, db.UpdateUserRoleParams{
		ID:   targetID,
		Role: role,
	}); err != nil {
		return fmt.Errorf("権限の更新に失敗しました: %w", err)
	}
	return nil
}

// ListAllReservations は全ユーザーの確定済み予約を予約者名つきで返す (管理者の閲覧用)。
func (s *AdminService) ListAllReservations(ctx context.Context) ([]db.ListAllReservationsWithUserRow, error) {
	rows, err := s.queries.ListAllReservationsWithUser(ctx)
	if err != nil {
		return nil, fmt.Errorf("予約一覧の取得に失敗しました: %w", err)
	}
	if rows == nil {
		rows = []db.ListAllReservationsWithUserRow{}
	}
	return rows, nil
}
