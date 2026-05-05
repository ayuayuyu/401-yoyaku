-- name: CreateUser :execresult
INSERT INTO users (
    name, email, google_id, avatar_url, role
) VALUES (
  $1, $2, $3, $4, $5
);

-- name: GetUserByID :one
SELECT * FROM users
WHERE id = $1
  AND deleted_at IS NULL;

-- name: GetUserByEmail :one
SELECT * FROM users
WHERE email = $1
  AND deleted_at IS NULL;

-- name: GetUserByGoogleID :one
SELECT * FROM users
WHERE google_id = $1
  AND deleted_at IS NULL;

-- name: ListUsers :many
SELECT * FROM users
WHERE deleted_at IS NULL
ORDER BY id;

-- name: SoftDeleteUser :exec
UPDATE users
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = $1;


-- name: CreateReservation :execresult
INSERT INTO reservations (
    user_id, title, start_time, end_time, status
) VALUES (
  $1, $2, $3, $4, 'confirmed'
);

-- name: GetReservationLastInserted :one
SELECT * FROM reservations
ORDER BY id DESC
LIMIT 1;


-- name: GetReservationByID :one
SELECT * FROM reservations
WHERE id = $1;

-- name: ListReservationsByUserID :many
SELECT * FROM reservations
WHERE status = 'confirmed'
  AND user_id = $1
  AND end_time >= NOW()
ORDER BY start_time ASC;

-- name: ListReservationsByMonth :many
SELECT r.*, u.name as user_name
FROM reservations AS r
JOIN users AS u ON r.user_id = u.id AND u.deleted_at IS NULL
WHERE
  r.status = 'confirmed'
  AND r.start_time < $1  -- 翌月の初日
  AND r.end_time >= $2 -- 月の初日
ORDER BY
  r.start_time;

-- name: ListReservationsByWeek :many
SELECT r.*, u.name as user_name
FROM reservations AS r
JOIN users AS u ON r.user_id = u.id AND u.deleted_at IS NULL
WHERE
  r.status = 'confirmed'
  AND r.start_time < $1
  AND r.end_time >= $2
ORDER BY
  r.start_time;

-- name: ListReservationsByDate :many
SELECT r.*, u.name as user_name
FROM reservations AS r
JOIN users AS u ON r.user_id = u.id AND u.deleted_at IS NULL
WHERE
  r.status = 'confirmed'
  AND r.start_time < $1
  AND r.end_time >= $2
ORDER BY
  r.start_time;

-- name: UpdateReservationByID :execresult
UPDATE reservations
SET title = $1, start_time = $2, end_time = $3, updated_at = CURRENT_TIMESTAMP
WHERE id = $4
  AND user_id = $5
  AND status = 'confirmed';

-- name: DeleteReservationByID :exec
DELETE FROM reservations
WHERE user_id = $1
  AND id = $2;

-- name: CanceledReservationByID :exec
UPDATE reservations
SET
  status = 'canceled',
  updated_at = CURRENT_TIMESTAMP
WHERE
  user_id = $1 AND id = $2;

-- name: CheckOverlappingReservation :one
SELECT COUNT(*) FROM reservations
WHERE status = 'confirmed'
  AND start_time < $1
  AND end_time > $2;

-- name: CheckOverlappingReservationForUpdate :one
SELECT COUNT(*) FROM reservations
WHERE status = 'confirmed'
  AND id <> $1
  AND start_time < $2
  AND end_time > $3;
