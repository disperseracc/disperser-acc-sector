import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '../api/supabase';

interface ConfigState {
  userId: string;
  groupId: string;
  apiKey: string;
  uploadTarget: 'user' | 'group';
  hasConfig: boolean;
  loadingConfig: boolean;

  // Actions
  setConfig: (userId: string, groupId: string, apiKey: string) => void;
  setUploadTarget: (target: 'user' | 'group') => void;
  clearConfig: () => void;
  restoreFromDB: (supabaseUserId: string) => Promise<void>;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      userId: '',
      groupId: '',
      apiKey: '',
      uploadTarget: 'user',
      hasConfig: false,
      loadingConfig: true,

      setConfig: (userId, groupId, apiKey) => {
        set((state) => ({
          userId,
          groupId,
          apiKey,
          uploadTarget: state.uploadTarget || (groupId && !userId ? 'group' : 'user'),
          hasConfig: !!((userId || groupId) && apiKey),
          loadingConfig: false
        }));
      },

      setUploadTarget: (target) => {
        set({ uploadTarget: target });
        localStorage.setItem('disperser_upload_target', target);
      },

      clearConfig: () => {
        set({ userId: '', groupId: '', apiKey: '', uploadTarget: 'user', hasConfig: false, loadingConfig: false });
      },

      restoreFromDB: async (supabaseUserId) => {
        set({ loadingConfig: true });
        try {
          const { data, error } = await supabase
            .from('users')
            .select('roblox_user_id, roblox_group_id, roblox_api_key')
            .eq('id', supabaseUserId)
            .single();

          const rUserId = data?.roblox_user_id || '';
          const rGroupId = data?.roblox_group_id || '';
          const rApiKey = data?.roblox_api_key || '';

          if ((rUserId || rGroupId) && rApiKey) {
            set((state) => ({
              userId: rUserId,
              groupId: rGroupId,
              apiKey: rApiKey,
              uploadTarget: state.uploadTarget || (rGroupId && !rUserId ? 'group' : 'user'),
              hasConfig: true,
              loadingConfig: false
            }));
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
      partialize: (state) => ({ userId: state.userId, groupId: state.groupId, apiKey: state.apiKey, uploadTarget: state.uploadTarget, hasConfig: state.hasConfig }), // only persist these
    }
  )
);
// test