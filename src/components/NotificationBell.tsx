"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, MessageCircle, AtSign, Wand2, X } from "lucide-react";
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
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Panel — fixed so it's never clipped by sidebar */}
          <div className="fixed left-64 bottom-4 z-50 w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[70vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-900">Notifications</span>
                {unread > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">{unread}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {notifications.some((n) => !n.read) && (
                  <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
              {notifications.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <Bell className="w-7 h-7 text-slate-200 mx-auto mb-2.5" />
                  <p className="text-sm font-medium text-slate-400">No notifications yet</p>
                  <p className="text-xs text-slate-300 mt-0.5">You'll see mentions and replies here</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const isSuggestion = n.type === "suggestion";
                  const inner = (
                    <div className={cn(
                      "px-5 py-4 flex items-start gap-3.5 transition-colors hover:bg-slate-50",
                      !n.read && isSuggestion && "bg-amber-50 hover:bg-amber-50/80",
                      !n.read && !isSuggestion && "bg-blue-50 hover:bg-blue-50/80"
                    )}>
                      {/* Icon */}
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                        n.type === "mention" && "bg-violet-100",
                        n.type === "reply" && "bg-blue-100",
                        isSuggestion && "bg-amber-100"
                      )}>
                        {n.type === "mention" && <AtSign className="w-4 h-4 text-violet-600" />}
                        {n.type === "reply" && <MessageCircle className="w-4 h-4 text-blue-600" />}
                        {isSuggestion && <Wand2 className="w-4 h-4 text-amber-600" />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 leading-snug">
                          <span className="font-semibold">{n.fromName}</span>{" "}
                          <span className="text-slate-500">
                            {n.type === "mention" && "mentioned you in a comment"}
                            {n.type === "reply" && "replied to a thread you're on"}
                            {isSuggestion && "suggested a rewording of your hook"}
                          </span>
                        </p>

                        {/* Full hook text — no clipping */}
                        <div className={cn(
                          "mt-2 px-3 py-2 rounded-lg text-sm text-slate-700 leading-relaxed",
                          !n.read && isSuggestion ? "bg-white border border-amber-100" :
                          !n.read ? "bg-white border border-blue-100" :
                          "bg-slate-50 border border-slate-100"
                        )}>
                          {n.hookText}
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-xs text-slate-400">{timeAgo(n.createdAt)}</p>
                          {n.weekId && (
                            <>
                              <span className="text-slate-200">·</span>
                              <span className={cn(
                                "text-xs font-medium",
                                isSuggestion ? "text-amber-500" : "text-blue-500"
                              )}>Click to view week →</span>
                            </>
                          )}
                        </div>
                      </div>

                      {!n.read && (
                        <div className={cn(
                          "w-2 h-2 rounded-full flex-shrink-0 mt-2",
                          isSuggestion ? "bg-amber-500" : "bg-blue-500"
                        )} />
                      )}
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
        </>
      )}
    </div>
  );
}
