// 管理者ページで扱う型

export type RoleValue = 'user' | 'admin';

// ユーザー一覧 (利用状況・最終ログインつき)
export interface AdminUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string;
  role: string;
  // 一度もログインしていない場合は null
  last_login_at: string | null;
  created_at: string;
  reservation_count: number;
  // 累計利用時間 (秒)
  total_seconds: number;
}

export interface AdminUsersResponse {
  status: string;
  data: AdminUser[];
}

// 全員の予約 (閲覧用)
export interface AdminReservation {
  id: number;
  user_id: number;
  user_name: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string;
}

export interface AdminReservationsResponse {
  status: string;
  data: AdminReservation[];
}
