import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/axios.js';

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        set({ user: data.user, token: data.token });
      },
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'rms-auth' }
  )
);

export default useAuthStore;
