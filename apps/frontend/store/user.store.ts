import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type User = {
  id: string;
  phone: string;
  role: string;
  name?: string | null;
  displayName?: string | null;
  hasVendorProfile?: boolean;
  vendorApproved?: boolean;
} | null;

export interface UserState {
  user: User;
  setUser: (user: UserState['user'] | ((prev: UserState['user']) => UserState['user'])) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (userOrUpdater) =>
        set((state) => ({
          user:
            typeof userOrUpdater === 'function'
              ? userOrUpdater(state.user)
              : userOrUpdater,
        })),
      clearUser: () => set({ user: null }),
    }),
    {
      name: 'buildmart-user',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
