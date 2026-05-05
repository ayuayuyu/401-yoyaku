'use client';

import { useState } from 'react';
import Header from '../base/header';
import ReservationCalendar from './calendar/ReservationCalendar';
import ReservationModal from '../reservation/modal';
import type { ViewType } from '@/constants/type';
import styles from './index.module.scss';
import UserInfo from './user';

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [currentView, setCurrentView] = useState<ViewType>('month');
  const [currentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
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
        onViewChange={setCurrentView}
        onLogout={onLogout}
      />
      <div className={styles.calendarContainer}>
        <div className={styles.view}>
          {currentView !== 'user' ? (
            <ReservationCalendar
              currentView={currentView}
              currentDate={currentDate}
              onDateClick={handleDateClick}
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
