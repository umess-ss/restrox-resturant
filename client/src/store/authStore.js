import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/axios.js';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        set({ user: data.user, accessToken: data.accessToken });
      },

      logout: async () => {
        try { await api.post('/auth/logout'); } catch { /* ignore */ }
        set({ user: null, accessToken: null });
      },

      // Called by the axios interceptor when a 401 is received
      refreshToken: async () => {
        const { data } = await api.post('/auth/refresh');
        set({ user: data.user, accessToken: data.accessToken });
        return data.accessToken;
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'rms-auth',
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
    }
  )
);

export default useAuthStore;
