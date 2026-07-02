import { useAtom } from 'jotai';
import { userAtom } from '@/store/user';
import { MdiAccount, MdiCalendar } from '@/constants/svgIcon';
import { fetchReservationsMe } from '@/lib/api/reservationsMe';
import { updateCurrentUserName } from '@/lib/api/auth';
import { parseApiError } from '@/lib/api/error';
import FeedbackModal from '@/components/base/feedbackModal';
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
  const [user, setUser] = useAtom(userAtom);

  const [activeReservations, setActiveReservations] = useState<
    ReservationWithStatus[]
  >([]);
  const [endedReservations, setEndedReservations] = useState<
    ReservationWithStatus[]
  >([]);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [feedback, setFeedback] = useState<{
    title: string;
    message: string;
  } | null>(null);

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

  const handleStartEditName = () => {
    setNameDraft(user?.name ?? '');
    setIsEditingName(true);
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setNameDraft('');
  };

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setFeedback({
        title: '入力エラー',
        message: '表示名を入力してください。',
      });
      return;
    }
    if (trimmed === user?.name) {
      handleCancelEditName();
      return;
    }
    setIsSavingName(true);
    try {
      const updated = await updateCurrentUserName(trimmed);
      setUser(updated);
      setIsEditingName(false);
      setNameDraft('');
    } catch (err) {
      const parsed = parseApiError(err);
      setFeedback({
        title: '更新エラー',
        message: parsed.message,
      });
    } finally {
      setIsSavingName(false);
    }
  };

  const hasAnyReservation =
    activeReservations.length > 0 || endedReservations.length > 0;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.userInfo}>
        <MdiAccount />
        <div className={styles.userMain}>
          {isEditingName ? (
            <div className={styles.nameEditRow}>
              <input
                className={styles.nameInput}
                type="text"
                value={nameDraft}
                maxLength={50}
                onChange={(e) => setNameDraft(e.target.value)}
                disabled={isSavingName}
                aria-label="表示名"
              />
              <div className={styles.nameEditActions}>
                <button
                  type="button"
                  className={styles.nameSaveButton}
                  onClick={handleSaveName}
                  disabled={isSavingName}
                >
                  {isSavingName ? '保存中…' : '保存'}
                </button>
                <button
                  type="button"
                  className={styles.nameCancelButton}
                  onClick={handleCancelEditName}
                  disabled={isSavingName}
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.nameRow}>
              <div className={styles.name}>{user?.name}</div>
              <button
                type="button"
                className={styles.nameEditButton}
                onClick={handleStartEditName}
              >
                編集
              </button>
            </div>
          )}
          <div className={styles.email}>{user?.email}</div>
        </div>
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
      <FeedbackModal
        isOpen={feedback !== null}
        title={feedback?.title ?? ''}
        message={feedback?.message ?? ''}
        onConfirm={() => setFeedback(null)}
      />
    </div>
  );
};

export default UserInfo;
