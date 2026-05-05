'use client';

import { useState } from 'react';
import styles from './index.module.scss';

const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = () => {
    setIsLoading(true);
    // バックエンドのログインエンドポイントにリダイレクトする
    window.location.href = process.env.NEXT_PUBLIC_API_URL + '/login';
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <div className={styles.roomTitle}>401号室</div>
        <div className={styles.systemTitle}>予約管理システム</div>
        <div className={styles.loginDescription}>
          Googleアカウントでログインしてください
        </div>
        <button
          onClick={handleGoogleLogin}
          className={styles.loginButton}
          disabled={isLoading}
        >
          {isLoading ? 'ログイン中...' : 'Googleでログイン'}
        </button>
        <div className={styles.policyNotice}>
          ログインすることで、利用規約とプライバシーポリシーに同意したものとみなされます。
        </div>
      </div>
    </div>
  );
};
export default LoginPage;
