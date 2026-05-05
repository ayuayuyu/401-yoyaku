import apiClient from '../apiClient';
import type {
  ReservationWithUser,
  ReservationListResponse,
} from '@/types/reservation';

/**
 * 指定された期間（週）の予約をすべて取得します。
 * @param start - "YYYY-MM-DD" 形式の開始日
 * @param end - "YYYY-MM-DD" 形式の終了日
 */
export const fetchReservationsByWeek = async (
  start: string,
  end: string,
): Promise<ReservationWithUser[]> => {
  const response = await apiClient.get<ReservationListResponse>(
    '/api/reservations',
    {
      params: { start, end },
      withCredentials: true,
    },
  );
  return response.data.data || [];
};
