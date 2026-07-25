import { create } from 'zustand';

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface AppState {
  items: any[];
  loading: boolean;
  logs: LogEntry[];
  
  // Actions
  setItems: (items: any[]) => void;
  updateItemLocal: (id: string, updates: any) => void;
  setLoading: (loading: boolean) => void;
  addLog: (message: string, type?: LogEntry['type']) => void;
  clearLogs: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  items: [],
  loading: false,
  logs: [],

  setItems: (items) => set({ items }),
  
  updateItemLocal: (id, updates) => set((state) => ({
    items: state.items.map(item => item.id === id ? { ...item, ...updates } : item)
  })),

  setLoading: (loading) => set({ loading }),

  addLog: (message, type = 'info') => set((state) => ({
    logs: [...state.logs, {
      id: Date.now().toString() + Math.random().toString(),
      timestamp: Date.now(),
      message,
      type
    }].slice(-50)
  })),

  clearLogs: () => set({ logs: [] }),
}));
