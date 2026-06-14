import { useState } from 'react';
import { MdiCalendar, MdiClockOutline, MdiHistory } from '@/constants/svgIcon';
import { cancelReservation } from '@/lib/api/reservationsCancel';
import { parseApiError } from '@/lib/api/error';
import FeedbackModal from '@/components/base/feedbackModal';
import EditReservationModal from '../editModal';
import styles from './index.module.scss';

// 予約の時間的な状態。開始前 → 進行中 → 終了 と遷移する。
export type ReservationStatus = 'upcoming' | 'ongoing' | 'ended';

const STATUS_LABEL: Record<ReservationStatus, string> = {
  upcoming: '開始前',
  ongoing: '進行中',
  ended: '終了',
};

const STATUS_CLASS: Record<ReservationStatus, string> = {
  upcoming: styles.statusUpcoming,
  ongoing: styles.statusOngoing,
  ended: styles.statusEnded,
};

// 予約オブジェクトの型
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
// Props型（ReservationCardが受け取るprops全体の型）
interface ReservationCardProps {
  reservation: Reservation;
  onUpdate: () => void;
  status: ReservationStatus;
}
const ReservationCard = ({
  reservation,
  onUpdate,
  status,
}: ReservationCardProps) => {
  const isEnded = status === 'ended';
  const startDate = new Date(reservation.start_time);
  const endDate = new Date(reservation.end_time);
  const creationDate = new Date(reservation.created_at);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [resultModal, setResultModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  //日付と時刻をフォーマット
  const displayDate = startDate.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const startTime = startDate.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const endTime = endDate.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const displayTime = `${startTime} - ${endTime}`;

  const displayCreatedAt = creationDate.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleEdit = () => {
    console.log(`Edit reservation ${reservation.id}`);
    setIsEditing(true);
  };

  const handleCancele = async () => {
    try {
      await cancelReservation(reservation.id);
      setResultModal({
        title: 'キャンセル完了',
        message: '予約をキャンセルしました。',
      });
      onUpdate(); // 親の更新関数を実行して再レンダリングをトリガー
    } catch (error) {
      console.error('キャンセル処理に失敗しました:', error);
      const parsedError = parseApiError(error);
      setResultModal({
        title: 'キャンセル失敗',
        message: parsedError.message,
      });
    }
  };

  return (
    <div>
      <div className={`${styles.card}${isEnded ? ` ${styles.ended}` : ''}`}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>{reservation.title}</div>
          <span className={`${styles.statusBadge} ${STATUS_CLASS[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>
        <div className={styles.cardInfo}>
          <MdiCalendar />
          <span>{displayDate}</span>
        </div>
        <div className={styles.cardInfo}>
          <MdiClockOutline />
          <span>{displayTime}</span>
        </div>
        <div className={styles.cardInfo}>
          <MdiHistory />
          <span>予約作成日: {displayCreatedAt}</span>
        </div>
        {reservation.notes?.trim() && (
          <div className={styles.cardNotes}>{reservation.notes}</div>
        )}
        {!isEnded && (
          <div className={styles.cardActions}>
            <button onClick={handleEdit} className={styles.editButton}>
              編集
            </button>
            <button
              onClick={() => setConfirmCancelOpen(true)}
              className={styles.deleteButton}
            >
              キャンセル
            </button>
          </div>
        )}
      </div>
      {isEditing && (
        <EditReservationModal
          reservation={reservation}
          onClose={handleCancelEdit}
          onUpdated={onUpdate}
        />
      )}
      <FeedbackModal
        isOpen={confirmCancelOpen}
        title="予約キャンセル"
        message="この予約をキャンセルします。よろしいですか？"
        confirmText="キャンセルする"
        cancelText="戻る"
        onConfirm={() => {
          setConfirmCancelOpen(false);
          void handleCancele();
        }}
        onCancel={() => setConfirmCancelOpen(false)}
      />
      <FeedbackModal
        isOpen={resultModal !== null}
        title={resultModal?.title ?? ''}
        message={resultModal?.message ?? ''}
        onConfirm={() => setResultModal(null)}
      />
    </div>
  );
};

export default ReservationCard;
