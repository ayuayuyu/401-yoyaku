// lib/api/auth.ts
import apiClient from '../apiClient';

export interface User {
  name: string;
  email: string;
  picture: string;
}

export const fetchCurrentUser = async (): Promise<User> => {
  const response = await apiClient.get<User>('/api/me');
  return response.data;
};

export const logoutUser = async (): Promise<void> => {
  await apiClient.post('/api/logout');
};
