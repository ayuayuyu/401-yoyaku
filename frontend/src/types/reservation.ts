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
  // true のとき予約者本人の Google カレンダーにも追加する
  add_to_google_calendar?: boolean;
}

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
  // Google カレンダー連携を要求した場合の結果
  // ('added' | 'needs_relogin' | 'failed')
  google_calendar?: string;
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
