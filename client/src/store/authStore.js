import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/axios.js';
import useTenantStore from './tenantStore.js';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        set({ user: data.user, accessToken: data.accessToken });
        // Populate tenant context from login response
        if (data.restaurant) {
          useTenantStore.getState().setFromLogin(data.restaurant, data.user);
        }
      },

      logout: async () => {
        // Always clear local state first — never let a failed API call block logout
        set({ user: null, accessToken: null });
        useTenantStore.getState().clear();
        try { await api.post('/auth/logout'); } catch { /* server-side cleanup best-effort */ }
      },

      refreshToken: async () => {
        const { data } = await api.post('/auth/refresh');
        set({ user: data.user, accessToken: data.accessToken });
        if (data.restaurant) {
          useTenantStore.getState().setFromLogin(data.restaurant, data.user);
        }
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
