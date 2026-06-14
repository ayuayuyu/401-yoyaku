-- users テーブル
CREATE TABLE users(
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  google_id VARCHAR(255) NOT NULL UNIQUE,
  avatar_url TEXT,
  -- 本人の Google カレンダー連携用 refresh token (オフラインアクセス)
  google_refresh_token TEXT,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ
);


-- reservations テーブル
CREATE TABLE reservations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'confirmed',
  notes TEXT NOT NULL DEFAULT '',
  -- 連携した場合の Google カレンダーのイベントID (将来のキャンセル同期用)
  google_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reservations_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_reservations_time_range ON reservations (start_time, end_time);