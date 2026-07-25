import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '../api/supabase';

interface ConfigState {
  userId: string;
  apiKey: string;
  hasConfig: boolean;
  loadingConfig: boolean;
  
  // Actions
  setConfig: (userId: string, apiKey: string) => void;
  clearConfig: () => void;
  restoreFromDB: (supabaseUserId: string) => Promise<void>;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      userId: '',
      apiKey: '',
      hasConfig: false,
      loadingConfig: true,

      setConfig: (userId, apiKey) => {
        set({ 
          userId, 
          apiKey, 
          hasConfig: !!(userId && apiKey),
          loadingConfig: false 
        });
      },

      clearConfig: () => {
        set({ userId: '', apiKey: '', hasConfig: false, loadingConfig: false });
      },

      restoreFromDB: async (supabaseUserId) => {
        set({ loadingConfig: true });
        try {
          const { data, error } = await supabase
            .from('users')
            .select('roblox_user_id, roblox_api_key')
            .eq('id', supabaseUserId)
            .single();

          if (data?.roblox_user_id && data?.roblox_api_key) {
            set({ 
              userId: data.roblox_user_id, 
              apiKey: data.roblox_api_key, 
              hasConfig: true,
              loadingConfig: false 
            });
          } else {
            set({ loadingConfig: false });
          }
        } catch (error) {
          console.error('Failed to restore config:', error);
          set({ loadingConfig: false });
        }
      },
    }),
    {
      name: 'disperser-config', // unique name for localStorage
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ userId: state.userId, apiKey: state.apiKey, hasConfig: state.hasConfig }), // only persist these
    }
  )
);
