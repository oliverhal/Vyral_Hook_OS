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

  useEffect(() => { fetchClients(); }, [fetchClients]);

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header — matches rest of Hook OS */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 bg-white flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Client Calendar</h1>
          <p className="text-slate-500 text-sm mt-0.5">Contract timelines and active clients</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
            <button
              onClick={() => setView("gantt")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
                view === "gantt" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Gantt
            </button>
            <button
              onClick={() => setView("calendar")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
                view === "calendar" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Calendar
            </button>
          </div>

          <button
            onClick={() => setAddOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Client
          </button>

          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border",
              chatOpen
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            AI Chat
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        <div className={cn("flex-1 overflow-hidden transition-all duration-300", chatOpen ? "mr-[380px]" : "")}>
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

        <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      </div>

      {addOpen && (
        <AddClientModal onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); fetchClients(); }} />
      )}
      {editClient && (
        <EditClientModal
          client={editClient}
          onClose={() => setEditClient(null)}
          onSaved={() => { setEditClient(null); fetchClients(); }}
          onDeleted={() => { setEditClient(null); fetchClients(); }}
        />
      )}
    </div>
  );
}
