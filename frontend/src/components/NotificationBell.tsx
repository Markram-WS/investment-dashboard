import { useState, useRef, useEffect, useCallback } from "react";
import { IconBell, IconX, IconCheck, IconAlertTriangle, IconCircle } from "./icons";
import { useNotification, type Notification } from "../contexts/NotificationContext";

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

const typeIcons: Record<string, React.ReactNode> = {
  success: <IconCheck className="w-3.5 h-3.5 text-green-600 shrink-0" />,
  warning: <IconAlertTriangle className="w-3.5 h-3.5 text-yellow-600 shrink-0" />,
  danger: <IconX className="w-3.5 h-3.5 text-red-600 shrink-0" />,
};

export default function NotificationBell() {
  const { notifications, markRead, markAllRead, clearAll } = useNotification();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClickOutside]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        className="relative w-10 h-10 flex items-center justify-center bg-transparent border border-hairline rounded-full cursor-pointer"
      >
        <IconBell className="w-5 h-5 nav-icon-hover" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-1 leading-none shadow">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-canvas border border-hairline rounded-xl shadow-lg overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
            <span className="text-sm font-semibold text-ink">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] font-bold uppercase tracking-wider text-brand-teal bg-transparent border-none cursor-pointer hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-[11px] text-slate/60">No notifications</div>
            ) : (
              notifications.map((n: Notification) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-hairline last:border-b-0 transition-colors ${n.read ? 'opacity-60' : 'bg-surface/30'}`}
                >
                  {/* Unread dot */}
                  <div className="w-4 shrink-0 flex items-center justify-center pt-0.5">
                    {n.read ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-transparent" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-teal" />
                    )}
                  </div>

                  {/* Icon */}
                  <div className="w-4 shrink-0 flex items-center justify-center pt-0.5">
                    {typeIcons[n.type]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-ink leading-snug">{n.message}</div>
                    <div className="text-[9px] text-slate/50 mt-0.5">{timeAgo(n.timestamp)}</div>
                  </div>

                  {/* Dismiss */}
                  <button
                    onClick={() => markRead(n.id)}
                    className="w-5 h-5 shrink-0 flex items-center justify-center bg-transparent border-none text-slate/30 hover:text-slate cursor-pointer rounded"
                  >
                    <IconX className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-hairline px-4 py-2">
              <button
                onClick={clearAll}
                className="w-full text-[10px] font-bold uppercase tracking-wider text-slate/50 bg-transparent border-none cursor-pointer hover:text-slate transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
