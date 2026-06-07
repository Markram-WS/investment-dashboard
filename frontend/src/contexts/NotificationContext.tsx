import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";

export interface Notification {
  id: string;
  message: string;
  type: "warning" | "danger" | "success";
  timestamp: number;
  read: boolean;
}

interface NotificationContextValue {
  notifications: Notification[];
  notify: (message: string, type?: "warning" | "danger" | "success") => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  dismissLatest: () => void;
}

const STORAGE_KEY = "app_notifications";
const MAX_NOTIFICATIONS = 50;

function loadPersisted(): Notification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const typeStyles: Record<string, string> = {
  warning: "bg-yellow-50 border-yellow-400 text-yellow-800",
  danger: "bg-red-50 border-red-400 text-red-800",
  success: "bg-green-50 border-green-400 text-green-800",
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(loadPersisted);
  const [toast, setToast] = useState<Notification | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  const notify = useCallback((message: string, type: "warning" | "danger" | "success" = "warning") => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const n: Notification = { id, message, type, timestamp: Date.now(), read: false };

    setNotifications(prev => [n, ...prev].slice(0, MAX_NOTIFICATIONS));
    setToast(n);

    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const dismissLatest = useCallback(() => {
    setToast(null);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, notify, markRead, markAllRead, clearAll, dismissLatest }}>
      {children}

      {/* Toast overlay */}
      {toast && (
        <div className={`fixed top-20 right-6 z-[9999] w-full max-w-sm border-l-2 rounded-md px-4 py-3 shadow-2xl ${typeStyles[toast.type]}`}>
          <div className="flex items-start gap-2">
            <span className="text-sm flex-1">{toast.message}</span>
            <button onClick={dismissLatest} className="text-current opacity-50 hover:opacity-100 text-lg leading-none">&times;</button>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification must be used within NotificationProvider");
  return ctx;
}
