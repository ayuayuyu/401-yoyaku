'use client';

import type { ReactNode } from 'react';
import styles from './index.module.scss';

type FeedbackModalProps = {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

const FeedbackModal = ({
  isOpen,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'キャンセル',
  onConfirm,
  onCancel,
}: FeedbackModalProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.backdrop} onClick={onCancel} role="presentation">
      <div
        className={styles.content}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3>{title}</h3>
        <p>{message}</p>
        <div className={styles.actions}>
          {onCancel && (
            <button
              type="button"
              className={styles.secondary}
              onClick={onCancel}
            >
              {cancelText}
            </button>
          )}
          <button type="button" className={styles.primary} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
