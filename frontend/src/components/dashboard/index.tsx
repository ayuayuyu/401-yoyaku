'use client';

import { useEffect, useState } from 'react';
import Header from '../base/header';
import ReservationCalendar from './calendar/ReservationCalendar';
import ReservationModal from '../reservation/modal';
import type { ViewType } from '@/constants/type';
import styles from './index.module.scss';
import UserInfo from './user';

interface DashboardProps {
  onLogout: () => void;
}

const VIEW_STORAGE_KEY = 'yoyaku.currentView';

const isViewType = (value: string | null): value is ViewType =>
  value === 'month' || value === 'week' || value === 'day' || value === 'user';

export default function Dashboard({ onLogout }: DashboardProps) {
  const [currentView, setCurrentView] = useState<ViewType>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // 表示中のビューをリロード後も保持する。output:'export' のためビルド時は
  // localStorage が無く、初期値 month で描画してからクライアントで復元する
  // (サーバ/クライアントの初期描画を揃えハイドレーション不一致を避ける)。
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (isViewType(saved)) setCurrentView(saved);
    } catch {
      // localStorage が使えない環境では既定の month のままにする
    }
  }, []);

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // 保存に失敗しても表示は継続する
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  // 月表示で日をクリックしたら、その日の詳細(日ビュー)へ移動する。
  const handleDayDetails = (date: Date) => {
    setCurrentDate(date);
    handleViewChange('day');
  };

  const handleNewReservation = () => {
    setSelectedDate(new Date());
    setIsModalOpen(true);
  };

  const handleReservationChanged = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className={styles.container}>
      <Header
        currentView={currentView}
        onViewChange={handleViewChange}
        onLogout={onLogout}
      />
      <div className={styles.calendarContainer}>
        <div className={styles.view}>
          {currentView !== 'user' ? (
            <ReservationCalendar
              currentView={currentView}
              currentDate={currentDate}
              onDateClick={handleDateClick}
              onDayDetails={handleDayDetails}
              refreshKey={refreshKey}
              onNewReservation={handleNewReservation}
            />
          ) : (
            <UserInfo refreshKey={refreshKey} />
          )}
        </div>
      </div>
      <ReservationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedDate={selectedDate}
        onSuccess={handleReservationChanged}
      />
    </div>
  );
}
