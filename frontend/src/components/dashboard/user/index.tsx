import { useAtomValue } from 'jotai';
import { userAtom } from '@/store/user';
import { MdiAccount } from '@/constants/svgIcon';
import { fetchReservationsMe } from '@/lib/api/reservationsMe';
import ReservationCard from './card';
import { useState, useEffect } from 'react';

import styles from './index.module.scss';

interface Reservation {
  id: number;
  user_id: number;
  title: string;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
}

interface UserInfoProps {
  refreshKey: number;
}

const UserInfo = ({ refreshKey }: UserInfoProps) => {
  const user = useAtomValue(userAtom);

  const [reservations, setReservations] = useState<Reservation[]>([]);

  const loadReservations = async () => {
    try {
      const data = await fetchReservationsMe();
      const now = Date.now();
      const sorted = [...data]
        .filter(
          (reservation) => new Date(reservation.end_time).getTime() >= now,
        )
        .sort(
          (a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
        );
      setReservations(sorted);
    } catch (error) {
      console.error('予約の取得に失敗しました:', error);
    }
  };

  useEffect(() => {
    loadReservations();
  }, [refreshKey]);

  return (
    <div className={styles.pageContainer}>
      <div className={styles.userInfo}>
        <MdiAccount />
        <div className={styles.name}>{user?.name}</div>
        <div className={styles.email}>{user?.email}</div>
      </div>
      <div className={styles.reservationsGrid}>
        {reservations && reservations.length > 0 ? (
          reservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              onUpdate={loadReservations}
            />
          ))
        ) : (
          <p>今後のご予約はありません。</p>
        )}
      </div>
    </div>
  );
};

export default UserInfo;
