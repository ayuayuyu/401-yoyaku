'use client';

import { useEffect, useRef, useState } from 'react';
import type { ViewType } from '@/constants/type';
import { useAtomValue } from 'jotai';
import { userAtom } from '@/store/user';
import UserIcon from './user';
import styles from './index.module.scss';
import { MdiAccount, MdiLogout } from '@/constants/svgIcon';


interface HeaderProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onLogout: () => void;
}

const Header = ({ currentView, onViewChange, onLogout }: HeaderProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { view: 'month', text: '月間' },
    { view: 'week', text: '週間' },
    { view: 'day', text: '日間' },
  ];

  const user = useAtomValue(userAtom);

  // メニューを開いている間だけ、外側クリックと Escape で閉じる。
  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className={styles.header}>
      <div className={styles.title}>401号室予約管理</div>

      <nav className={styles.nav}>
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => onViewChange(item.view as ViewType)}
            aria-current={currentView === item.view ? 'page' : undefined}
            className={`${styles.navButton} ${
              currentView === item.view ? styles.active : ''
            }`}
          >
            {item.text}
          </button>
        ))}
      </nav>

      <div className={styles.user} ref={userMenuRef}>
        <UserIcon onClick={toggleMenu} expanded={menuOpen} />
        {menuOpen && (
          <div className={styles.menuContainer}>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user?.name || 'ユーザー'}</div>
              <div className={styles.userEmail}>{user?.email || ' '}</div>
            </div>

            <div className={styles.menuActions}>
              <button
                className={styles.menuItem}
                onClick={() => {
                  onViewChange('user');
                  toggleMenu();
                }}
              >
                <MdiAccount />
                <span>マイ予約</span>
              </button>
              <button className={styles.menuItem} onClick={onLogout}>
                <MdiLogout />
                <span>ログアウト</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
