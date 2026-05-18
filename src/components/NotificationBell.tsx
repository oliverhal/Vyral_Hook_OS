"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, MessageCircle, AtSign } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  fromName: string;
  hookText: string;
  weekId: string | null;
  type: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  async function fetchNotifications() {
    try {
      const data = await fetch("/api/notifications").then((r) => r.json());
      if (Array.isArray(data)) setNotifications(data);
    } catch {}
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleOpen() {
    setOpen((o) => !o);
    if (!open && unread > 0) markAllRead();
  }

  function timeAgo(date: string) {
    const diff = (Date.now() - new Date(date).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 w-full relative",
          open ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/10"
        )}
      >
        <Bell className="w-4 h-4 flex-shrink-0" />
        <span>Notifications</span>
        {unread > 0 && (
          <span className="absolute left-5 top-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full ml-2 top-0 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-bold text-slate-800">Notifications</span>
            {notifications.some((n) => !n.read) && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const inner = (
                  <div className={cn(
                    "px-4 py-3 flex items-start gap-3 transition-colors hover:bg-slate-50",
                    !n.read && "bg-blue-50 hover:bg-blue-100/70"
                  )}>
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                      n.type === "mention" ? "bg-violet-100" : "bg-blue-100"
                    )}>
                      {n.type === "mention"
                        ? <AtSign className="w-3.5 h-3.5 text-violet-600" />
                        : <MessageCircle className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 leading-snug">
                        <span className="font-semibold">{n.fromName}</span>{" "}
                        {n.type === "mention" ? "mentioned you" : "replied to a thread you're on"}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-snug">
                        "{n.hookText}"
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />}
                  </div>
                );

                return n.weekId ? (
                  <Link key={n.id} href={`/weeks/${n.weekId}`} onClick={() => setOpen(false)}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
