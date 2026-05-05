import { atom } from 'jotai';

interface userProps {
  name: string;
  email: string;
  picture: string;
}

export const userAtom = atom<userProps | null>(null);
