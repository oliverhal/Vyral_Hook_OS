"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TeamMember { id: string; name: string; color: string }

interface MentionInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function MentionInput({ value, onChange, onSubmit, placeholder, disabled }: MentionInputProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [dropdown, setDropdown] = useState<{ query: string; start: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/team-members").then((r) => r.json()).then(setMembers).catch(() => {});
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    onChange(text);

    const cursor = e.target.selectionStart ?? text.length;
    const beforeCursor = text.slice(0, cursor);
    const atMatch = beforeCursor.match(/@([\w]*)$/);
    if (atMatch) {
      setDropdown({ query: atMatch[1], start: beforeCursor.lastIndexOf("@") });
    } else {
      setDropdown(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey && !dropdown) {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === "Escape") setDropdown(null);
  }

  function selectMember(name: string) {
    if (!dropdown) return;
    const before = value.slice(0, dropdown.start);
    const after = value.slice((inputRef.current?.selectionStart ?? value.length));
    const newVal = `${before}@${name} ${after}`;
    onChange(newVal);
    setDropdown(null);
    setTimeout(() => {
      if (inputRef.current) {
        const pos = before.length + name.length + 2;
        inputRef.current.setSelectionRange(pos, pos);
        inputRef.current.focus();
      }
    }, 0);
  }

  const filtered = dropdown
    ? members.filter((m) => m.name.toLowerCase().startsWith(dropdown.query.toLowerCase()))
    : [];

  return (
    <div ref={containerRef} className="relative flex-1">
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Add a comment... (@ to mention)"}
        disabled={disabled}
        className={cn(
          "w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:bg-white transition-colors",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
      {dropdown && filtered.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 min-w-[140px] overflow-hidden">
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); selectMember(m.name); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 transition-colors text-left"
            >
              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-blue-700">{m.name.charAt(0)}</span>
              </div>
              <span className="font-medium text-slate-700">{m.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function renderWithMentions(text: string): React.ReactNode {
  const parts = text.split(/(@\w+(?:\s\w+)?)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-blue-600 font-semibold">{part}</span>
    ) : (
      part
    )
  );
}
