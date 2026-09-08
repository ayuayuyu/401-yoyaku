'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { userAtom } from '@/store/user';
import { fetchAdminUsers } from '@/lib/api/adminUsers';
import { updateUserRole } from '@/lib/api/adminUserRole';
import { fetchAdminReservations } from '@/lib/api/adminReservations';
import { parseApiError } from '@/lib/api/error';
import FeedbackModal from '@/components/base/feedbackModal';
import type { AdminReservation, AdminUser, RoleValue } from '@/types/admin';
import styles from './index.module.scss';

const pad2 = (value: number) => String(value).padStart(2, '0');

// 最終ログイン等の日時を "YYYY/M/D HH:MM" で表示する。
const formatDateTime = (value: string): string => {
  const d = new Date(value);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}`;
};

// 予約日時を "M/D HH:MM - HH:MM" で表示する。
const formatReservationRange = (start: string, end: string): string => {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.getMonth() + 1}/${s.getDate()} ${pad2(s.getHours())}:${pad2(
    s.getMinutes(),
  )} - ${pad2(e.getHours())}:${pad2(e.getMinutes())}`;
};

// 累計利用秒数を時間 (小数第1位) に整形する。
const formatHours = (totalSeconds: number): string => {
  const hours = totalSeconds / 3600;
  return `${hours.toFixed(1)} 時間`;
};

const AdminPanel = () => {
  const currentUser = useAtomValue(userAtom);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const loadUsers = useCallback(async () => {
    const data = await fetchAdminUsers();
    setUsers(data);
  }, []);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [userData, reservationData] = await Promise.all([
        fetchAdminUsers(),
        fetchAdminReservations(),
      ]);
      setUsers(userData);
      setReservations(reservationData);
    } catch (err) {
      setLoadError(parseApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleToggleRole = async (target: AdminUser) => {
    const nextRole: RoleValue = target.role === 'admin' ? 'user' : 'admin';
    setUpdatingId(target.id);
    try {
      await updateUserRole(target.id, nextRole);
      await loadUsers();
    } catch (err) {
      setFeedback({ title: '更新エラー', message: parseApiError(err).message });
    } finally {
      setUpdatingId(null);
    }
  };

  const summary = useMemo(() => {
    const adminCount = users.filter((u) => u.role === 'admin').length;
    const totalReservations = users.reduce(
      (acc, u) => acc + u.reservation_count,
      0,
    );
    const totalSeconds = users.reduce((acc, u) => acc + u.total_seconds, 0);
    return {
      userCount: users.length,
      adminCount,
      totalReservations,
      totalSeconds,
    };
  }, [users]);

  if (isLoading) {
    return (
      <div className={styles.pageContainer}>
        <p className={styles.statusText}>読み込み中…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.pageContainer}>
        <p className={styles.errorText}>{loadError}</p>
        <button
          type="button"
          className={styles.retryButton}
          onClick={loadAll}
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <h1 className={styles.pageTitle}>管理ページ</h1>

      <div className={styles.summaryGrid}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>ユーザー数</div>
          <div className={styles.cardValue}>{summary.userCount}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>管理者数</div>
          <div className={styles.cardValue}>{summary.adminCount}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>総予約数</div>
          <div className={styles.cardValue}>{summary.totalReservations}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>累計利用時間</div>
          <div className={styles.cardValue}>
            {formatHours(summary.totalSeconds)}
          </div>
        </div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>ユーザー一覧・利用状況</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>名前</th>
                <th>メール</th>
                <th>権限</th>
                <th>最終ログイン</th>
                <th className={styles.numCol}>予約数</th>
                <th className={styles.numCol}>利用時間</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = currentUser?.email === u.email;
                const isAdmin = u.role === 'admin';
                return (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td className={styles.emailCell}>{u.email}</td>
                    <td>
                      <span
                        className={`${styles.roleBadge} ${
                          isAdmin ? styles.roleAdmin : styles.roleUser
                        }`}
                      >
                        {isAdmin ? '管理者' : '一般'}
                      </span>
                    </td>
                    <td>
                      {u.last_login_at ? (
                        formatDateTime(u.last_login_at)
                      ) : (
                        <span className={styles.neverLogin}>未ログイン</span>
                      )}
                    </td>
                    <td className={styles.numCol}>{u.reservation_count}</td>
                    <td className={styles.numCol}>
                      {formatHours(u.total_seconds)}
                    </td>
                    <td>
                      {isSelf ? (
                        <span className={styles.selfLabel}>自分</span>
                      ) : (
                        <button
                          type="button"
                          className={`${styles.roleButton} ${
                            isAdmin ? styles.demote : styles.promote
                          }`}
                          onClick={() => handleToggleRole(u)}
                          disabled={updatingId === u.id}
                        >
                          {updatingId === u.id
                            ? '更新中…'
                            : isAdmin
                              ? '管理者を解除'
                              : '管理者にする'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>全員の予約</h2>
        {reservations.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>日時</th>
                  <th>予約者</th>
                  <th>タイトル</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {formatReservationRange(r.start_time, r.end_time)}
                    </td>
                    <td>{r.user_name}</td>
                    <td>{r.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.statusText}>予約はありません。</p>
        )}
      </section>

      <FeedbackModal
        isOpen={feedback !== null}
        title={feedback?.title ?? ''}
        message={feedback?.message ?? ''}
        onConfirm={() => setFeedback(null)}
      />
    </div>
  );
};

export default AdminPanel;
