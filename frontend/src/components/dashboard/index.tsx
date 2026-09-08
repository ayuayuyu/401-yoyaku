'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { userAtom } from '@/store/user';
import Header from '../base/header';
import ReservationCalendar from './calendar/ReservationCalendar';
import ReservationModal from '../reservation/modal';
import AdminPanel from '../admin';
import type { ViewType } from '@/constants/type';
import { PiconLeft, PiconRight } from '@/constants/svgIcon';
import styles from './index.module.scss';
import UserInfo from './user';

interface DashboardProps {
  onLogout: () => void;
}

const VIEW_STORAGE_KEY = 'yoyaku.currentView';

const isViewType = (value: string | null): value is ViewType =>
  value === 'month' ||
  value === 'week' ||
  value === 'day' ||
  value === 'user' ||
  value === 'admin';

// firstDayOfWeek: 7 (日曜) に合わせ、currentDate を含む週の日曜日を返す。
const getWeekStart = (date: Date): Date => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
};

const WEEK_DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

const formatPeriodLabel = (view: ViewType, date: Date): string => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if (view === 'month') return `${y}年${m}月`;
  if (view === 'day') return `${y}年${m}月${d}日 (${WEEK_DAY_LABELS[date.getDay()]})`;
  // week
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = `${start.getMonth() + 1}月${start.getDate()}日`;
  const endLabel = sameMonth
    ? `${end.getDate()}日`
    : `${end.getMonth() + 1}月${end.getDate()}日`;
  return `${start.getFullYear()}年 ${startLabel} - ${endLabel}`;
};

export default function Dashboard({ onLogout }: DashboardProps) {
  const user = useAtomValue(userAtom);
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

  const shiftDate = (direction: -1 | 1) => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (currentView === 'month') {
        next.setMonth(next.getMonth() + direction);
      } else if (currentView === 'week') {
        next.setDate(next.getDate() + 7 * direction);
      } else {
        next.setDate(next.getDate() + direction);
      }
      return next;
    });
  };

  const handleToday = () => setCurrentDate(new Date());

  // カレンダー以外のビュー (マイ予約・管理) では期間ラベルを使わないため month 相当で計算する。
  const isCalendarView = currentView !== 'user' && currentView !== 'admin';

  const periodLabel = useMemo(
    () => formatPeriodLabel(isCalendarView ? currentView : 'month', currentDate),
    [isCalendarView, currentView, currentDate],
  );

  // 管理ページは管理者のみ表示する (ヘッダのボタンは admin にしか出ないが、
  // localStorage 復元などの経路に対する多層防御)。
  const showAdmin = currentView === 'admin' && user?.role === 'admin';

  return (
    <div className={styles.container}>
      <Header
        currentView={currentView}
        onViewChange={handleViewChange}
        onLogout={onLogout}
      />
      <div className={styles.calendarContainer}>
        {isCalendarView && (
          <div className={styles.navBar}>
            <button
              type="button"
              className={styles.todayButton}
              onClick={handleToday}
            >
              今日
            </button>
            <div className={styles.navControls}>
              <button
                type="button"
                className={styles.navArrow}
                onClick={() => shiftDate(-1)}
                aria-label="前へ"
              >
                <PiconLeft width={20} height={20} />
              </button>
              <div className={styles.periodLabel} aria-live="polite">
                {periodLabel}
              </div>
              <button
                type="button"
                className={styles.navArrow}
                onClick={() => shiftDate(1)}
                aria-label="次へ"
              >
                <PiconRight width={20} height={20} />
              </button>
            </div>
            <button
              type="button"
              className={styles.newReservationButton}
              onClick={handleNewReservation}
            >
              新規予約
            </button>
          </div>
        )}
        <div className={styles.view}>
          {isCalendarView ? (
            <ReservationCalendar
              currentView={currentView}
              currentDate={currentDate}
              onDateClick={handleDateClick}
              onDayDetails={handleDayDetails}
              refreshKey={refreshKey}
            />
          ) : showAdmin ? (
            <AdminPanel />
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
