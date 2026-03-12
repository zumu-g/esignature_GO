import { create } from 'zustand';
import { api } from '../lib/api';
import type { User } from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updateCredits: (credits: number) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  loading: true,

  login: async (email, password) => {
    const { token, user } = await api.login({ email, password });
    localStorage.setItem('token', token);
    set({ token, user, loading: false });
  },

  register: async (email, password, firstName, lastName) => {
    const { token, user } = await api.register({ email, password, firstName, lastName });
    localStorage.setItem('token', token);
    set({ token, user, loading: false });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null, loading: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ loading: false });
      return;
    }
    try {
      const user = await api.getMe();
      set({ user, token, loading: false });
    } catch {
      localStorage.removeItem('token');
      set({ token: null, user: null, loading: false });
    }
  },

  updateCredits: (credits) => {
    set((state) => state.user ? { user: { ...state.user, credits } } : {});
  },
}));

// Listen for auth expiry events from API layer
if (typeof window !== 'undefined') {
  window.addEventListener('auth:expired', () => {
    useAuthStore.getState().logout();
  });
}
