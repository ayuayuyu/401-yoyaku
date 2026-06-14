import Image from 'next/image';
import { useAtomValue } from 'jotai';
import { userAtom } from '@/store/user';
import styles from './index.module.scss';

interface UserIconProps {
  onClick: () => void;
  expanded?: boolean;
}

const UserIcon = ({ onClick, expanded }: UserIconProps) => {
  const user = useAtomValue(userAtom);

  return (
    <button
      type="button"
      className={styles.trigger}
      onClick={onClick}
      aria-haspopup="menu"
      aria-expanded={expanded}
      aria-label="ユーザーメニュー"
    >
      {user?.picture ? (
        <Image
          src={user.picture ?? ''}
          alt=""
          width={40}
          height={40}
          className={styles.icon}
        />
      ) : (
        <span className={styles.iconPlaceholder}>
          {user?.name?.charAt(0) || 'U'}
        </span>
      )}
    </button>
  );
};

export default UserIcon;
