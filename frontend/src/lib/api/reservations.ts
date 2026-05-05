// lib/api/reservations.ts
import apiClient from '../apiClient';
import type {
  CreateReservationRequest,
  ReservationResponse,
} from '@/types/reservation';

export const fetchReservations = async (
  reservation: CreateReservationRequest,
): Promise<ReservationResponse> => {
  const response = await apiClient.post<ReservationResponse>(
    '/api/reservations',
    reservation,
    {
      withCredentials: true,
    },
  );
  return response.data;
};
