'use client';

import { useEffect } from 'react';

// PWA 用にサービスワーカー (/sw.js) を登録するだけのクライアントコンポーネント。
// UI は描画しない。layout の body 末尾でマウントする。
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service worker の登録に失敗しました:', error);
      });
    };

    // 初期表示の負荷を避けるため load 後に登録する。
    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
