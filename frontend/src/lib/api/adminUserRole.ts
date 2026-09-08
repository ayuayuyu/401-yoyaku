import apiClient from '../apiClient';
import type { RoleValue } from '@/types/admin';

// 対象ユーザーの権限 (admin / user) を更新する。
export const updateUserRole = async (
  userId: number,
  role: RoleValue,
): Promise<void> => {
  await apiClient.put('/api/admin/users/role', { user_id: userId, role });
};
