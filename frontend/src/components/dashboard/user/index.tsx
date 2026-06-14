import { useAtomValue } from 'jotai';
import { userAtom } from '@/store/user';
import { MdiAccount, MdiCalendar } from '@/constants/svgIcon';
import { fetchReservationsMe } from '@/lib/api/reservationsMe';
import ReservationCard, { type ReservationStatus } from './card';
import { useState, useEffect } from 'react';

import styles from './index.module.scss';

interface Reservation {
  id: number;
  user_id: number;
  title: string;
  start_time: string;
  end_time: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface UserInfoProps {
  refreshKey: number;
}

// 現在時刻を基準に予約の状態を判定する。
const getReservationStatus = (
  reservation: Reservation,
  now: number,
): ReservationStatus => {
  const start = new Date(reservation.start_time).getTime();
  const end = new Date(reservation.end_time).getTime();
  if (end <= now) return 'ended';
  if (start <= now) return 'ongoing';
  return 'upcoming';
};

type ReservationWithStatus = {
  reservation: Reservation;
  status: ReservationStatus;
};

const UserInfo = ({ refreshKey }: UserInfoProps) => {
  const user = useAtomValue(userAtom);

  const [activeReservations, setActiveReservations] = useState<
    ReservationWithStatus[]
  >([]);
  const [endedReservations, setEndedReservations] = useState<
    ReservationWithStatus[]
  >([]);

  const loadReservations = async () => {
    try {
      const data = await fetchReservationsMe();
      const now = Date.now();
      const withStatus = data.map<ReservationWithStatus>((reservation) => ({
        reservation,
        status: getReservationStatus(reservation, now),
      }));

      // 現在・今後: 開始が近い順 (進行中が先頭に来る)。終了済み: 直近に終わった順。
      const active = withStatus
        .filter((item) => item.status !== 'ended')
        .sort(
          (a, b) =>
            new Date(a.reservation.start_time).getTime() -
            new Date(b.reservation.start_time).getTime(),
        );
      const ended = withStatus
        .filter((item) => item.status === 'ended')
        .sort(
          (a, b) =>
            new Date(b.reservation.start_time).getTime() -
            new Date(a.reservation.start_time).getTime(),
        );

      setActiveReservations(active);
      setEndedReservations(ended);
    } catch (error) {
      console.error('予約の取得に失敗しました:', error);
    }
  };

  useEffect(() => {
    loadReservations();
  }, [refreshKey]);

  const hasAnyReservation =
    activeReservations.length > 0 || endedReservations.length > 0;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.userInfo}>
        <MdiAccount />
        <div className={styles.name}>{user?.name}</div>
        <div className={styles.email}>{user?.email}</div>
      </div>
      {hasAnyReservation ? (
        <>
          <section className={styles.section}>
            <h2 className={styles.reservationsTitle}>現在・今後の予約</h2>
            {activeReservations.length > 0 ? (
              <div className={styles.reservationsGrid}>
                {activeReservations.map((item) => (
                  <ReservationCard
                    key={item.reservation.id}
                    reservation={item.reservation}
                    status={item.status}
                    onUpdate={loadReservations}
                  />
                ))}
              </div>
            ) : (
              <p className={styles.sectionEmpty}>
                現在・今後のご予約はありません。
              </p>
            )}
          </section>

          {endedReservations.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.reservationsTitle}>終了した予約</h2>
              <div className={styles.reservationsGrid}>
                {endedReservations.map((item) => (
                  <ReservationCard
                    key={item.reservation.id}
                    reservation={item.reservation}
                    status={item.status}
                    onUpdate={loadReservations}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className={styles.emptyState}>
          <MdiCalendar />
          <p>ご予約はありません。</p>
        </div>
      )}
    </div>
  );
};

export default UserInfo;
