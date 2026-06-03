"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarDays, BarChart2, Plus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarClient } from "./types";
import GanttView from "./GanttView";
import CalendarGridView from "./CalendarGridView";
import ChatPanel from "./ChatPanel";
import AddClientModal from "./AddClientModal";
import EditClientModal from "./EditClientModal";

type ViewMode = "gantt" | "calendar";

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>("gantt");
  const [clients, setClients] = useState<CalendarClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editClient, setEditClient] = useState<CalendarClient | null>(null);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar/clients");
      const data = await res.json();
      setClients(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return (
    <div className="min-h-screen bg-[#080e1a] text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0f1629]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Client Calendar</h1>
          <p className="text-slate-400 text-xs mt-0.5">Contract timelines and active clients</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10">
            <button
              onClick={() => setView("gantt")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
                view === "gantt"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Gantt
            </button>
            <button
              onClick={() => setView("calendar")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
                view === "calendar"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Calendar
            </button>
          </div>

          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors duration-150"
          >
            <Plus className="w-4 h-4" />
            Add Client
          </button>

          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 border",
              chatOpen
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                : "bg-white/5 text-slate-300 hover:text-white border-white/10 hover:bg-white/10"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            AI Chat
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <div className={cn("flex-1 overflow-hidden transition-all duration-300", chatOpen ? "mr-[350px]" : "")}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-slate-400 text-sm">Loading clients...</div>
            </div>
          ) : view === "gantt" ? (
            <GanttView clients={clients} onEditClient={setEditClient} />
          ) : (
            <CalendarGridView clients={clients} onEditClient={setEditClient} />
          )}
        </div>

        {/* Chat panel */}
        <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      </div>

      {/* Modals */}
      {addOpen && (
        <AddClientModal
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            fetchClients();
          }}
        />
      )}

      {editClient && (
        <EditClientModal
          client={editClient}
          onClose={() => setEditClient(null)}
          onSaved={() => {
            setEditClient(null);
            fetchClients();
          }}
          onDeleted={() => {
            setEditClient(null);
            fetchClients();
          }}
        />
      )}
    </div>
  );
}
