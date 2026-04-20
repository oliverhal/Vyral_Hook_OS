"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, ExternalLink, Sparkles, Trash2 } from "lucide-react";
import { cn, CAMPAIGN_COLORS } from "@/lib/utils";
import { FORMAT_COLORS } from "@/types";
import type { Hook, Campaign } from "@/types";

interface HookCardProps {
  hook: Hook;
  campaign: Campaign;
  onSelect?: (hookId: string, selected: boolean) => void;
  onDelete?: (hookId: string) => void;
  onGenerateCaption?: (hookId: string) => void;
  showSubmitter?: boolean;
  selectable?: boolean;
  rank?: number;
}

export default function HookCard({
  hook,
  campaign,
  onSelect,
  onDelete,
  onGenerateCaption,
  showSubmitter = true,
  selectable = false,
  rank,
}: HookCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const colors = CAMPAIGN_COLORS[campaign.color] || CAMPAIGN_COLORS.blue;
  const formatColor = FORMAT_COLORS[hook.format] ?? "bg-slate-100 text-slate-600";

  async function handleGenerateCaption() {
    if (!onGenerateCaption) return;
    setGenerating(true);
    await onGenerateCaption(hook.id);
    setGenerating(false);
  }

  return (
    <div
      className={cn(
        "card p-4 transition-all duration-200",
        hook.isSelected && "ring-2 ring-blue-500 shadow-md",
        !hook.isSelected && selectable && "hover:shadow-md cursor-pointer"
      )}
      onClick={() => selectable && onSelect?.(hook.id, !hook.isSelected)}
    >
      <div className="flex items-start gap-3">
        {/* Rank / Select indicator */}
        {selectable && (
          <button
            onClick={(e) => { e.stopPropagation(); onSelect?.(hook.id, !hook.isSelected); }}
            className={cn(
              "flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-150 mt-0.5",
              hook.isSelected
                ? "bg-blue-600 border-blue-600 text-white"
                : "border-slate-300 text-transparent hover:border-blue-400"
            )}
          >
            {rank ? (
              <span className="text-xs font-bold">{rank}</span>
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        <div className="flex-1 min-w-0">
          {/* Format badge + actions */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className={cn("badge text-xs", formatColor)}>{hook.format}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {hook.referenceVideo && (
                <a
                  href={hook.referenceVideo}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Reference video"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {onGenerateCaption && hook.isSelected && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleGenerateCaption(); }}
                  disabled={generating}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Generate AI caption"
                >
                  <Sparkles className={cn("w-3.5 h-3.5", generating && "animate-spin")} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(hook.id); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Hook text on screen — this is the main content */}
          <p className="font-semibold text-slate-900 text-sm leading-snug mb-2">{hook.hookText}</p>

          {/* AI caption (if generated) */}
          {hook.aiCaption && (
            <div className="mt-2 p-2.5 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-1 mb-1">
                <Sparkles className="w-3 h-3 text-blue-500" />
                <span className="text-xs font-semibold text-blue-600">AI Caption</span>
              </div>
              <p className="text-xs text-blue-900 leading-relaxed">{hook.aiCaption}</p>
            </div>
          )}

          {/* Caption preview (collapsed) */}
          {!hook.aiCaption && (
            <p className="text-slate-500 text-xs leading-relaxed line-clamp-2 mb-1">{hook.caption}</p>
          )}

          {/* Expand toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors mt-1"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "Less" : "Caption & notes"}
          </button>

          {expanded && (
            <div className="mt-2 space-y-2 animate-fade-in">
              <div className="p-3 bg-slate-50 rounded-xl">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Caption</div>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{hook.caption}</p>
              </div>
              {hook.recordingNotes && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Recording Notes</div>
                  <p className="text-sm text-amber-800 leading-relaxed">{hook.recordingNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Submitter */}
          {showSubmitter && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center">
                  <span className="text-xs font-medium text-slate-600">
                    {hook.submitterName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-slate-500">{hook.submitterName}</span>
              </div>
              <span className={cn("badge text-xs", colors.badge)}>
                {campaign.emoji} {campaign.name}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
