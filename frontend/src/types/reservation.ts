// 予約の基本型
export interface Reservation {
  id: number;
  user_id: number;
  title: string;
  start_time: string;
  end_time: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ユーザー名付き予約データ（JOINクエリのレスポンス）
export interface ReservationWithUser {
  id: number;
  user_id: number;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string;
  user_name: string;
}

// 予約作成・更新リクエスト
export interface CreateReservationRequest {
  title: string;
  start_time: string;
  end_time: string;
  notes?: string;
  // 予約者本人の Google カレンダーに予定を追加するか
  add_to_google_calendar?: boolean;
}

// 本人 Google カレンダー連携の結果ステータス
// added: 追加成功 / needs_relogin: 再ログインで権限付与が必要 / failed: 失敗
export type GoogleCalendarStatus = 'added' | 'needs_relogin' | 'failed';

// 予約作成レスポンス
export interface ReservationResponse {
  status: string;
  id: number;
  user_id: number;
  title: string;
  start_time: string;
  end_time: string;
  notes: string;
  created_at: string;
  updated_at: string;
  // add_to_google_calendar を指定したときのみ返る
  google_calendar?: GoogleCalendarStatus;
}

// 一覧取得APIの共通レスポンス
export interface ReservationListResponse {
  status: string;
  data: ReservationWithUser[];
}

// ユーザー予約一覧のレスポンス
export interface MyReservationsResponse {
  status: string;
  data: Reservation[];
}

// キャンセルレスポンス
export interface CancelResponse {
  status: string;
  message: string;
}
