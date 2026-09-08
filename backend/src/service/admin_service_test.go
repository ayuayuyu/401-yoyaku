package service

import (
	"context"
	"errors"
	"testing"
)

// UpdateUserRole のバリデーションは queries に触れる前に早期リターンするため、
// nil queries でも純粋なロジックを検証できる。
func TestUpdateUserRole_Validation(t *testing.T) {
	s := NewAdminService(nil)
	ctx := context.Background()

	tests := []struct {
		name     string
		actorID  int64
		targetID int64
		role     string
		wantErr  error
	}{
		{name: "不正なrole", actorID: 1, targetID: 2, role: "superuser", wantErr: ErrInvalidRole},
		{name: "空のrole", actorID: 1, targetID: 2, role: "", wantErr: ErrInvalidRole},
		{name: "自分自身の変更は拒否", actorID: 5, targetID: 5, role: "admin", wantErr: ErrCannotChangeSelf},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := s.UpdateUserRole(ctx, tt.actorID, tt.targetID, tt.role)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("期待したエラー %v が返りませんでした: got %v", tt.wantErr, err)
			}
		})
	}
}
