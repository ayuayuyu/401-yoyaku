'use client';

import { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/user';
import { fetchCurrentUser, logoutUser } from '@/lib/api/auth';
import LoginPage from '@/components/auth/login';
import Dashboard from '@/components/dashboard';

const PageLoader = () => {
  return (
    <div>
      <p>Loading...</p>
    </div>
  );
};

export default function Home() {
  const [user, setUser] = useAtom(userAtom);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const fetchedUser = await fetchCurrentUser();
        setUser(fetchedUser);
      } catch {
        // 認証されていない場合はnullに設定
        console.log('User is not authenticated.');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkLoginStatus();
  }, [setUser]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (isLoading) {
    return <PageLoader />;
  }

  return user ? <Dashboard onLogout={handleLogout} /> : <LoginPage />;
}
