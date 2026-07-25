import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';
import { api } from '../api/api';
import { useAppStore } from '../store/useAppStore';
import { useConfigStore } from '../store/useConfigStore';

interface PollContextType {
  startPoll: (id: string, opPath: string) => void;
  refresh: (silent?: boolean) => Promise<any[]>;
}

const PollContext = createContext<PollContextType | null>(null);

export const usePollContext = () => {
  const ctx = useContext(PollContext);
  if (!ctx) throw new Error('usePollContext must be used within PollProvider');
  return ctx;
};

export const PollProvider = ({ children }: { children: React.ReactNode }) => {
  const { setItems, setLoading, updateItemLocal, addLog } = useAppStore();
  const { restoreFromDB } = useConfigStore();
  const polls = useRef<Record<string, any>>({});

  const refresh = useCallback(async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getQueue();
      setItems(data);
      return data;
    } catch (error: any) {
      addLog(`Failed to fetch queue: ${error.message}`, 'error');
      return [];
    } finally {
      if (!silent) setLoading(false);
    }
  }, [setItems, setLoading, addLog]);

  const startPoll = useCallback((id: string, opPath: string) => {
    if (polls.current[id]) clearInterval(polls.current[id]);
    
    const resourceId = opPath.split('/').pop();
    addLog(`[Item:${id}] Monitoring asset status...`, 'info');

    polls.current[id] = setInterval(async () => {
      try {
        const res = await api.checkOperation(resourceId!);

        if (!res.success) {
          addLog(`[Item:${id}] Polling stopped: ${res.error}`, 'error');
          clearInterval(polls.current[id]);
          delete polls.current[id];
          
          await api.updateItem(id, { status: 'error', errorMessage: res.error || 'Invalid API Key or Operation Error' });
          updateItemLocal(id, { status: 'error', errorMessage: res.error || 'Invalid API Key or Operation Error' });
          return;
        }

        const op = res.operation;
        if (op.done) {
          clearInterval(polls.current[id]);
          delete polls.current[id];

          if (op.response) {
            const assetId = op.response.assetId;
            addLog(`[Item:${id}] Roblox approved transfer. Asset ID: ${assetId}`, 'success');
            await api.updateItem(id, { status: 'reviewing', assetId });
            updateItemLocal(id, { status: 'reviewing', assetId });
            startModerationCheck(id, assetId);
          } else if (op.error) {
            const msg = op.error.message || 'Roblox rejected the file';
            addLog(`[Item:${id}] Roblox Error: ${msg}`, 'error');
            await api.updateItem(id, { status: 'error', errorMessage: msg });
            updateItemLocal(id, { status: 'error', errorMessage: msg });
          }
        }
      } catch (err: any) {
        addLog(`[Item:${id}] Connection error during polling. Retrying...`, 'warning');
      }
    }, 20000);
  }, [addLog, updateItemLocal]);

  const startModerationCheck = useCallback((id: string, assetId: string) => {
    if (polls.current[id]) clearInterval(polls.current[id]);

    polls.current[id] = setInterval(async () => {
      try {
        addLog(`[Item:${id}] Checking moderation status for asset: ${assetId}`, 'info');
        const metaRes = await api.getAssetMeta(assetId!);

        if (metaRes && metaRes.success === false) {
          addLog(`[Item:${id}] Asset metadata check failed: ${metaRes.error}`, 'error');
          clearInterval(polls.current[id]);
          delete polls.current[id];
          
          await api.updateItem(id, { status: 'error', errorMessage: metaRes.error || 'Failed to check asset moderation' });
          updateItemLocal(id, { status: 'error', errorMessage: metaRes.error || 'Failed to check asset moderation' });
          return;
        }

        const robloxData = metaRes?.metadata || metaRes?.data || metaRes;
        const moderationResult = robloxData?.moderationResult || robloxData?.moderation_result;
        const moderationState = (moderationResult?.moderationState || moderationResult?.moderation_state || '').trim().toLowerCase();

        if (moderationState === 'approved' || moderationState === 'moderation_state_approved') {
          clearInterval(polls.current[id]);
          delete polls.current[id];
          addLog(`[Item:${id}] Moderation PASSED! Asset is live.`, 'success');
          await api.updateItem(id, { status: 'success' });
          updateItemLocal(id, { status: 'success' });
        } else if (moderationState === 'rejected' || moderationState === 'moderation_state_rejected') {
          clearInterval(polls.current[id]);
          delete polls.current[id];
          addLog(`[Item:${id}] Moderation REJECTED by Roblox.`, 'error');
          await api.updateItem(id, { status: 'rejected' });
          updateItemLocal(id, { status: 'rejected' });
        }
      } catch (err) {
        // Silent retry for meta
      }
    }, 30000);
  }, [addLog, updateItemLocal]);

  useEffect(() => {
    const init = async () => {
      const storedUser = localStorage.getItem('disperser_user');
      if (storedUser) {
        const { id } = JSON.parse(storedUser);
        await restoreFromDB(id);
      }

      const data = await refresh();
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          if ((item.status === 'processing' || item.status === 'reviewing') && item.operationPath) {
            if (item.status === 'processing') startPoll(item.id, item.operationPath);
            else if (item.assetId) startModerationCheck(item.id, item.assetId);
          }
        });
      }
    };
    init();

    const interval = setInterval(() => refresh(true), 30000);
    return () => clearInterval(interval);
  }, [refresh, startPoll, startModerationCheck, restoreFromDB]);

  return (
    <PollContext.Provider value={{ startPoll, refresh }}>
      {children}
    </PollContext.Provider>
  );
};
