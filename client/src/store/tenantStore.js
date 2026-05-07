import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * tenantStore
 * Holds the active restaurant and branch context for the current session.
 * Populated from the login response and persisted to localStorage.
 */
const useTenantStore = create(
  persist(
    (set, get) => ({
      restaurant: null,  // { id, name, slug, plan, features }
      branch: null,      // { id, name } — active branch
      branches: [],      // all branches the user can access

      setRestaurant: (restaurant) => set({ restaurant }),
      setBranch: (branch) => set({ branch }),
      setBranches: (branches) => set({ branches }),

      // Called on login — sets restaurant from the login response
      setFromLogin: (restaurant, user) => {
        set({
          restaurant,
          branch: user?.branch ? { id: user.branch } : null,
        });
      },

      // Check if a feature is enabled on the current plan
      hasFeature: (feature) => {
        const { restaurant } = get();
        return restaurant?.features?.[feature] ?? false;
      },

      clear: () => set({ restaurant: null, branch: null, branches: [] }),
    }),
    {
      name: 'rms-tenant',
      partialize: (state) => ({
        restaurant: state.restaurant,
        branch: state.branch,
      }),
    }
  )
);

export default useTenantStore;
