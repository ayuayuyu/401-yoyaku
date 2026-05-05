import { useState } from 'react';
import { updateReservation } from '@/lib/api/reservationsEdit';
import FeedbackModal from '@/components/base/feedbackModal';
import { parseApiError } from '@/lib/api/error';
import {
  toApiDateTimeFromLocalInput,
  toDateTimeLocalInputValue,
} from '@/lib/datetime';
import styles from './index.module.scss';

const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 22;

interface Props {
  reservation: {
    id: number;
    title: string;
    start_time: string;
    end_time: string;
  };
  onClose: () => void;
  onUpdated: () => void;
}

const formatDateTimeLocal = (value: string) => {
  return toDateTimeLocalInputValue(value);
};

const EditReservationModal = ({ reservation, onClose, onUpdated }: Props) => {
  const [form, setForm] = useState({
    title: reservation.title,
    start_time: formatDateTimeLocal(reservation.start_time),
    end_time: formatDateTimeLocal(reservation.end_time),
  });
  const [feedback, setFeedback] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleUpdate = async () => {
    const start = new Date(form.start_time);
    const end = new Date(form.end_time);
    const now = new Date();
    const dayStart = new Date(start);
    dayStart.setHours(BUSINESS_START_HOUR, 0, 0, 0);
    const dayEnd = new Date(start);
    dayEnd.setHours(BUSINESS_END_HOUR, 0, 0, 0);

    if (end <= start) {
      setFeedback({
        title: '入力エラー',
        message: '開始時刻より後の終了時刻を指定してください。',
        onConfirm: () => setFeedback(null),
      });
      return;
    }

    if (start <= now || end <= now) {
      setFeedback({
        title: '入力エラー',
        message:
          '期日が過ぎています。現在時刻より未来の時間を指定してください。',
        onConfirm: () => setFeedback(null),
      });
      return;
    }

    if (start < dayStart || end > dayEnd) {
      setFeedback({
        title: '入力エラー',
        message: '予約可能時間は9:00から22:00までです。',
        onConfirm: () => setFeedback(null),
      });
      return;
    }

    try {
      await updateReservation(String(reservation.id), {
        title: form.title,
        start_time: toApiDateTimeFromLocalInput(form.start_time),
        end_time: toApiDateTimeFromLocalInput(form.end_time),
      });
      setFeedback({
        title: '更新完了',
        message: '予約を更新しました。',
        onConfirm: () => {
          setFeedback(null);
          onUpdated();
          onClose();
        },
      });
    } catch (err) {
      console.error(err);
      const parsedError = parseApiError(err);
      setFeedback({
        title:
          parsedError.code === 'OVERLAPPING_RESERVATION'
            ? '時間の重複'
            : '更新エラー',
        message: parsedError.message,
        onConfirm: () => setFeedback(null),
      });
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>予約の編集</h2>
        <label>
          タイトル:
          <input name="title" value={form.title} onChange={handleChange} />
        </label>
        <label>
          開始時間:
          <input
            name="start_time"
            type="datetime-local"
            value={form.start_time}
            onChange={handleChange}
          />
        </label>
        <label>
          終了時間:
          <input
            name="end_time"
            type="datetime-local"
            value={form.end_time}
            onChange={handleChange}
          />
        </label>
        <div className={styles.modalActions}>
          <button onClick={handleUpdate}>更新</button>
          <button onClick={onClose}>キャンセル</button>
        </div>
      </div>
      <FeedbackModal
        isOpen={feedback !== null}
        title={feedback?.title ?? ''}
        message={feedback?.message ?? ''}
        onConfirm={feedback?.onConfirm ?? (() => {})}
      />
    </div>
  );
};

export default EditReservationModal;
