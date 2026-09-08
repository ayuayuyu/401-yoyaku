import apiClient from '../apiClient';
import type { AdminUser, AdminUsersResponse } from '@/types/admin';

export const fetchAdminUsers = async (): Promise<AdminUser[]> => {
  const response = await apiClient.get<AdminUsersResponse>('/api/admin/users');
  return response.data.data;
};
