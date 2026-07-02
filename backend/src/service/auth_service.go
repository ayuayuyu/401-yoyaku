package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"
	"yoyaku/db"
)

type GoogleUserInfo struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

type AuthService struct {
	queries *db.Queries
}

func NewAuthService(queries *db.Queries) *AuthService {
	return &AuthService{queries: queries}
}

// FindOrCreateUser はGoogleユーザー情報をもとにDBからユーザーを取得し、存在しなければ新規作成する。
func (s *AuthService) FindOrCreateUser(ctx context.Context, info GoogleUserInfo) (db.User, error) {
	if info.ID != "" {
		dbUser, err := s.queries.GetUserByGoogleID(ctx, info.ID)
		if err == nil {
			return dbUser, nil
		}
		if err != sql.ErrNoRows {
			return db.User{}, fmt.Errorf("DBユーザー検索エラー: %w", err)
		}
	}

	if info.Email != "" {
		dbUser, err := s.queries.GetUserByEmail(ctx, info.Email)
		if err == nil {
			return dbUser, nil
		}
		if err != sql.ErrNoRows {
			return db.User{}, fmt.Errorf("DBユーザー検索エラー: %w", err)
		}
	}

	googleID := info.ID
	if googleID == "" {
		googleID = info.Email
	}
	if googleID == "" {
		return db.User{}, fmt.Errorf("ユーザー作成に必要な情報が不足しています")
	}

	// 新規作成
	params := db.CreateUserParams{
		Name:      info.Name,
		Email:     info.Email,
		GoogleID:  googleID,
		AvatarUrl: sql.NullString{String: info.Picture, Valid: info.Picture != ""},
		Role:      "user",
	}
	if _, err := s.queries.CreateUser(ctx, params); err != nil {
		return db.User{}, fmt.Errorf("ユーザー作成エラー: %w", err)
	}

	// 再取得
	dbUser, err := s.queries.GetUserByGoogleID(ctx, googleID)
	if err == nil {
		return dbUser, nil
	}
	if err != sql.ErrNoRows {
		return db.User{}, fmt.Errorf("作成後のユーザー取得失敗: %w", err)
	}

	dbUser, err = s.queries.GetUserByEmail(ctx, info.Email)
	if err != nil {
		return db.User{}, fmt.Errorf("作成後のユーザー取得失敗: %w", err)
	}

	return dbUser, nil
}

// SaveGoogleRefreshToken は本人カレンダー連携用の refresh token を保存する。
// Google は初回同意時などにしか refresh token を返さないため、呼び出し側で
// 空でない場合のみ呼ぶこと。
func (s *AuthService) SaveGoogleRefreshToken(ctx context.Context, userID int64, refreshToken string) error {
	return s.queries.UpdateUserGoogleRefreshToken(ctx, db.UpdateUserGoogleRefreshTokenParams{
		ID:                 userID,
		GoogleRefreshToken: sql.NullString{String: refreshToken, Valid: refreshToken != ""},
	})
}

var (
	ErrInvalidUserName = errors.New("表示名を入力してください")
	ErrUserNameTooLong = errors.New("表示名は50文字以内で入力してください")
)

const userNameMaxLength = 50

// UpdateUserName はマイページからの表示名変更を保存する。
func (s *AuthService) UpdateUserName(ctx context.Context, userID int64, name string) (db.User, error) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return db.User{}, ErrInvalidUserName
	}
	if utf8.RuneCountInString(trimmed) > userNameMaxLength {
		return db.User{}, ErrUserNameTooLong
	}

	if err := s.queries.UpdateUserName(ctx, db.UpdateUserNameParams{
		ID:   userID,
		Name: trimmed,
	}); err != nil {
		return db.User{}, fmt.Errorf("表示名の更新に失敗しました: %w", err)
	}

	user, err := s.queries.GetUserByID(ctx, userID)
	if err != nil {
		return db.User{}, fmt.Errorf("更新後のユーザー取得失敗: %w", err)
	}
	return user, nil
}
