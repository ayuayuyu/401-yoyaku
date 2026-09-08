import apiClient from '../apiClient';
import type {
  AdminReservation,
  AdminReservationsResponse,
} from '@/types/admin';

export const fetchAdminReservations = async (): Promise<AdminReservation[]> => {
  const response = await apiClient.get<AdminReservationsResponse>(
    '/api/admin/reservations',
  );
  return response.data.data;
};
