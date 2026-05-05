import apiClient from '../apiClient';
import type {
  CreateReservationRequest,
  ReservationResponse,
} from '@/types/reservation';

/**
 * 予約を更新するAPI
 * @param id 更新対象の予約ID
 * @param reservation 更新内容（タイトル・開始・終了）
 */
export const updateReservation = async (
  id: string,
  reservation: CreateReservationRequest,
): Promise<ReservationResponse> => {
  const response = await apiClient.put<ReservationResponse>(
    `/api/reservations`,
    reservation,
    {
      params: { id },
      withCredentials: true,
    },
  );
  return response.data;
};
