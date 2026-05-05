import apiClient from '../apiClient';
import type { CancelResponse } from '@/types/reservation';

export const cancelReservation = async (
  id: string | number,
): Promise<CancelResponse> => {
  const response = await apiClient.put<CancelResponse>(
    '/api/reservations/cancel',
    null,
    {
      params: { id },
      withCredentials: true,
    },
  );
  return response.data;
};
