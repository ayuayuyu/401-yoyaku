import apiClient from '../apiClient';
import type { Reservation, MyReservationsResponse } from '@/types/reservation';

export const fetchReservationsMe = async (): Promise<Reservation[]> => {
  const response = await apiClient.get<MyReservationsResponse>(
    '/api/reservations/me',
    {
      withCredentials: true,
    },
  );
  return response.data.data;
};
