"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, { color: string; bg: string }> = {
  task_assigned: { color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" },
  task_comment: { color: "text-sky-600", bg: "bg-sky-100 dark:bg-sky-900/30" },
  task_mention: { color: "text-violet-600", bg: "bg-violet-100 dark:bg-violet-900/30" },
  ticket_assigned: { color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/30" },
  ticket_update: { color: "text-indigo-600", bg: "bg-indigo-100 dark:bg-indigo-900/30" },
  ticket_mention: { color: "text-fuchsia-600", bg: "bg-fuchsia-100 dark:bg-fuchsia-900/30" },
  briefing_new: { color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30" },
  briefing_completed: { color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  editorial_plan: { color: "text-teal-600", bg: "bg-teal-100 dark:bg-teal-900/30" },
  content_review: { color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/30" },
  revision_request: { color: "text-yellow-600", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
  recheck_ready: { color: "text-violet-600", bg: "bg-violet-100 dark:bg-violet-900/30" },
  new_content: { color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30" },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std.`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `vor ${diffD} Tag${diffD > 1 ? "en" : ""}`;
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleMarkAllRead() {
    setLoading(true);
    try {
      await fetch("/api/notifications/mark-all-read", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function handleClick(notification: Notification) {
    if (!notification.read) {
      try {
        await fetch(`/api/notifications/${notification.id}`, { method: "PATCH" });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // silent
      }
    }
    if (notification.link) {
      setOpen(false);
      router.push(notification.link);
    }
  }

  const style = (type: string) => TYPE_ICONS[type] || { color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-700" };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        aria-label="Benachrichtigungen"
      >
        <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[480px] rounded-lg bg-white dark:bg-slate-800 shadow-xl ring-1 ring-slate-200 dark:ring-slate-600 flex flex-col z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Benachrichtigungen
              {unreadCount > 0 && (
                <span className="ml-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                  {unreadCount} neu
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium disabled:opacity-50"
              >
                Alle gelesen
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <svg className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-sm text-slate-500 dark:text-slate-400">Keine Benachrichtigungen</p>
              </div>
            ) : (
              notifications.map((n) => {
                const s = style(n.type);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0 ${
                      !n.read ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                    }`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full ${s.bg} flex items-center justify-center mt-0.5`}>
                      <div className={`w-2 h-2 rounded-full ${!n.read ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${!n.read ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {n.message}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
