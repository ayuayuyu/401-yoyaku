'use client';

import type React from 'react';

import { useState, useEffect } from 'react';
import ReservationForm from '../form';
import styles from './index.module.scss';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  onSuccess: () => void;
}

const ReservationModal = ({
  isOpen,
  onClose,
  selectedDate,
  onSuccess,
}: ReservationModalProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className={`${styles.modalBackdrop} ${isOpen ? styles.open : ''}`}
      onClick={handleBackdropClick}
    >
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>予約登録</h2>
          {/* <button className={styles.closeBtn} onClick={onClose}>
            キャンセル
          </button> */}
        </div>
        <div className={styles.modalBody}>
          <ReservationForm
            selectedDate={selectedDate}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        </div>
      </div>
    </div>
  );
};
export default ReservationModal;
