'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import { fetchReservations } from '@/lib/api/reservations';
import FeedbackModal from '@/components/base/feedbackModal';
import { parseApiError } from '@/lib/api/error';
import {
  toApiDateTime,
  toDateInputValue,
  toTimeInputValue,
} from '@/lib/datetime';
import styles from './index.module.scss';

const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 22;
const TIME_STEP_MINUTES = 5;

const HOUR_OPTIONS = Array.from(
  { length: BUSINESS_END_HOUR - BUSINESS_START_HOUR + 1 },
  (_, i) => BUSINESS_START_HOUR + i,
);
const MINUTE_OPTIONS = Array.from(
  { length: 60 / TIME_STEP_MINUTES },
  (_, i) => i * TIME_STEP_MINUTES,
);

const pad2 = (value: number | string) => String(value).padStart(2, '0');

const roundTimeToStep = (time: string): string => {
  if (!time) return time;
  const [h, m] = time.split(':');
  const minute = Number.parseInt(m ?? '0', 10);
  const rounded = Math.round(minute / TIME_STEP_MINUTES) * TIME_STEP_MINUTES;
  if (rounded >= 60) {
    return `${pad2(Number.parseInt(h, 10) + 1)}:00`;
  }
  return `${pad2(h)}:${pad2(rounded)}`;
};

interface ReservationFormProps {
  selectedDate: Date | null;
  onClose: () => void;
  onSuccess: () => void;
}

const ReservationForm = ({
  selectedDate,
  onClose,
  onSuccess,
}: ReservationFormProps) => {
  // フォームデータの状態管理
  const [formData, setFormData] = useState({
    title: '面接',
    date: '',
    time: '',
    duration: '60',
    notes: '',
    addToGoogleCalendar: false,
  });
  const [feedback, setFeedback] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // selectedDateが変更されたら、フォームの日付と時刻を更新
  useEffect(() => {
    if (selectedDate) {
      setFormData((prev) => ({
        ...prev,
        date: toDateInputValue(selectedDate),
        time: roundTimeToStep(toTimeInputValue(selectedDate)),
      }));
    }
  }, [selectedDate]);

  // 入力変更をハンドルする関数
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    const nextValue =
      e.target instanceof HTMLInputElement && e.target.type === 'checkbox'
        ? e.target.checked
        : value;
    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
    }));
  };

  const [hourValue, minuteValue] = formData.time
    ? formData.time.split(':')
    : ['', ''];

  const handleTimeChange = (
    field: 'hour' | 'minute',
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const value = e.target.value;
    const nextHour = field === 'hour' ? value : hourValue || pad2(BUSINESS_START_HOUR);
    const nextMinute = field === 'minute' ? value : minuteValue || '00';
    setFormData((prev) => ({
      ...prev,
      time: `${pad2(nextHour)}:${pad2(nextMinute)}`,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const durationMinutes = Number.parseInt(formData.duration, 10);
    const start = new Date(`${formData.date}T${formData.time}:00`);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const now = new Date();
    const dayStart = new Date(start);
    dayStart.setHours(BUSINESS_START_HOUR, 0, 0, 0);
    const dayEnd = new Date(start);
    dayEnd.setHours(BUSINESS_END_HOUR, 0, 0, 0);

    if (!(end > start)) {
      setFeedback({
        title: '入力エラー',
        message: '開始時刻より後の終了時刻になるように設定してください。',
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
      const response = await fetchReservations({
        title: formData.title,
        start_time: toApiDateTime(formData.date, formData.time),
        end_time: toApiDateTime(toDateInputValue(end), toTimeInputValue(end)),
        notes: formData.notes,
        add_to_google_calendar: formData.addToGoogleCalendar,
      });

      let message = '予約が登録されました。';
      if (formData.addToGoogleCalendar) {
        if (response.google_calendar === 'added') {
          message = '予約を登録し、Google カレンダーに追加しました。';
        } else if (response.google_calendar === 'needs_relogin') {
          message =
            '予約は登録しました。Google カレンダーへの追加には、一度ログインし直してカレンダーへのアクセスを許可してください。';
        } else if (response.google_calendar === 'failed') {
          message =
            '予約は登録しましたが、Google カレンダーへの追加に失敗しました。';
        }
      }

      setFeedback({
        title: '予約登録',
        message,
        onConfirm: () => {
          setFeedback(null);
          onSuccess();
          onClose();
        },
      });
    } catch (err) {
      console.error('予約エラー:', err);
      const parsedError = parseApiError(err);
      setFeedback({
        title:
          parsedError.code === 'OVERLAPPING_RESERVATION'
            ? '時間の重複'
            : '予約エラー',
        message: parsedError.message,
        onConfirm: () => setFeedback(null),
      });
    }
  };
  return (
    <>
      <form className={styles.container} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="title">予約タイトル *</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
          />
          <p className={styles.fieldNote}>
            ※ 予約タイトルは他の方には表示されません。
          </p>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="date">日付 *</label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              min={toDateInputValue(new Date())}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="time-hour">時間 *</label>
            <div className={styles.timeSelectRow}>
              <select
                id="time-hour"
                name="time-hour"
                value={hourValue}
                onChange={(e) => handleTimeChange('hour', e)}
                required
                aria-label="時"
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={pad2(h)}>
                    {pad2(h)}
                  </option>
                ))}
              </select>
              <span className={styles.timeSeparator}>:</span>
              <select
                id="time-minute"
                name="time-minute"
                value={minuteValue}
                onChange={(e) => handleTimeChange('minute', e)}
                required
                aria-label="分"
              >
                {MINUTE_OPTIONS.map((m) => (
                  <option key={m} value={pad2(m)}>
                    {pad2(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="duration">所要時間</label>
          <select
            id="duration"
            name="duration"
            value={formData.duration}
            onChange={handleChange}
          >
            <option value="30">30分</option>
            <option value="60">1時間</option>
            <option value="90">1時間30分</option>
            <option value="120">2時間</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="notes">備考</label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
          />
        </div>

        <div className={styles.checkboxGroup}>
          <input
            type="checkbox"
            id="addToGoogleCalendar"
            name="addToGoogleCalendar"
            checked={formData.addToGoogleCalendar}
            onChange={handleChange}
          />
          <label htmlFor="addToGoogleCalendar">
            Google カレンダーに共有
          </label>
        </div>

        <div className={styles.formActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className={styles.submitBtn}>
            登録
          </button>
        </div>
      </form>
      <FeedbackModal
        isOpen={feedback !== null}
        title={feedback?.title ?? ''}
        message={feedback?.message ?? ''}
        onConfirm={feedback?.onConfirm ?? (() => {})}
      />
    </>
  );
};
export default ReservationForm;
