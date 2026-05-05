import Image from 'next/image';
import { useAtomValue } from 'jotai';
import { userAtom } from '@/store/user';
import styles from './index.module.scss';

interface UserIconProps {
  onClick: () => void;
}

const UserIcon = ({ onClick }: UserIconProps) => {
  const user = useAtomValue(userAtom);

  return user?.picture ? (
    <Image
      src={user.picture ?? ''}
      alt="アイコン"
      width={40}
      height={40}
      className={styles.icon}
      onClick={onClick}
    />
  ) : (
    <div className={styles.iconPlaceholder} onClick={onClick}>
      {user?.name?.charAt(0) || 'U'}
    </div>
  );
};

export default UserIcon;
