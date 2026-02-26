import { create } from 'zustand';

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

export const useUserStore = create<UserState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));
