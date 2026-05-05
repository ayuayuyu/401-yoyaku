'use client';

import { useState } from 'react';
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

  const navItems = [
    { view: 'month', text: '月間' },
    { view: 'week', text: '週間' },
    { view: 'day', text: '日間' },
  ];

  const user = useAtomValue(userAtom);

  return (
    <header className={styles.header}>
      <div className={styles.title}>401号室予約管理</div>

      <nav className={styles.nav}>
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => onViewChange(item.view as ViewType)}
            className={`${styles.navButton} ${
              currentView === item.view ? styles.active : ''
            }`}
          >
            {item.text}
          </button>
        ))}
      </nav>

      <div className={styles.user}>
        <UserIcon onClick={toggleMenu} />
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
