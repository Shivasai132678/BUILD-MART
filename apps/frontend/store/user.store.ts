import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type User = {
  id: string;
  phone: string;
  role: string;
  name?: string;
} | null;

export interface UserState {
  user: User;
  setUser: (user: UserState['user']) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
    }),
    {
      name: 'buildmart-user',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
