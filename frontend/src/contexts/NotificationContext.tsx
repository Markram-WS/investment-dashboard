import { createContext, useContext } from "react";

export interface Notification {
  id: string;
  message: string;
  type: "warning" | "danger" | "success";
  timestamp: number;
  read: boolean;
}

export interface NotificationContextValue {
  notifications: Notification[];
  notify: (message: string, type?: "warning" | "danger" | "success") => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  dismissLatest: () => void;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification must be used within NotificationProvider");
  return ctx;
}
