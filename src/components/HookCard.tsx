"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  Check, ChevronDown, ChevronUp, ExternalLink, Sparkles, Trash2,
  ThumbsUp, ThumbsDown, MessageSquare, Flame, Send, X, Pencil, Loader2
} from "lucide-react";
import { cn, CAMPAIGN_COLORS } from "@/lib/utils";
import { FORMAT_COLORS, HOOK_FORMATS } from "@/types";
import type { Hook, Campaign, HookComment } from "@/types";
import MentionInput, { renderWithMentions } from "./MentionInput";
import UserAvatar from "./UserAvatar";

interface HookCardProps {
  hook: Hook;
  campaign: Campaign;
  onSelect?: (hookId: string, selected: boolean) => void;
  onDelete?: (hookId: string) => void;
  onEdit?: (hookId: string, updates: Partial<Hook>) => void;
  onGenerateCaption?: (hookId: string) => void;
  onViralToggle?: (hookId: string, wentViral: boolean) => void;
  showSubmitter?: boolean;
  selectable?: boolean;
  rank?: number;
  isAdmin?: boolean;
}

export default function HookCard({
  hook,
  campaign,
  onSelect,
  onDelete,
  onEdit,
  onGenerateCaption,
  onViralToggle,
  showSubmitter = true,
  selectable = false,
  rank,
  isAdmin = false,
}: HookCardProps) {
  const { data: session } = useSession();
  const [expanded, setExpanded] = useState(false);
  const [textExpanded, setTextExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<HookComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentCount, setCommentCount] = useState(hook.commentCount ?? 0);
  const [votes, setVotes] = useState(hook.votes ?? []);
  const [viralLoading, setViralLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    hookText: hook.hookText,
    format: hook.format,
    caption: hook.caption,
    referenceVideo: hook.referenceVideo ?? "",
    recordingNotes: hook.recordingNotes ?? "",
    requiresAppFootage: hook.requiresAppFootage,
    appFootageSource: hook.appFootageSource ?? "",
  });

  const colors = CAMPAIGN_COLORS[campaign.color] || CAMPAIGN_COLORS.blue;
  const formatColor = FORMAT_COLORS[hook.format] ?? "bg-slate-100 text-slate-600";

  const currentUserId = (session?.user as { id?: string })?.id;

  const voteScore = votes.reduce((sum, v) => sum + v.value, 0);
  const myVote = votes.find((v) => v.userId === currentUserId)?.value ?? 0;

  async function handleGenerateCaption() {
    if (!onGenerateCaption) return;
    setGenerating(true);
    await onGenerateCaption(hook.id);
    setGenerating(false);
  }

  async function handleVote(value: number) {
    const newValue = myVote === value ? 0 : value;
    // Optimistic update
    setVotes((prev) => {
      const without = prev.filter((v) => v.userId !== currentUserId);
      if (newValue === 0) return without;
      return [...without, { id: "temp", hookId: hook.id, userId: currentUserId!, value: newValue, createdAt: new Date().toISOString() }];
    });
    await fetch(`/api/hooks/${hook.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: newValue }),
    });
  }

  async function loadComments() {
    if (loadingComments) return;
    setLoadingComments(true);
    const data = await fetch(`/api/hooks/${hook.id}/comments`).then((r) => r.json());
    setComments(data);
    setLoadingComments(false);
  }

  function toggleComments() {
    if (!showComments && comments.length === 0) loadComments();
    setShowComments(!showComments);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    const res = await fetch(`/api/hooks/${hook.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: commentText.trim() }),
    });
    const newComment = await res.json();
    setComments((prev) => [...prev, newComment]);
    setCommentCount((n) => n + 1);
    setCommentText("");
    setSubmittingComment(false);
  }

  async function deleteComment(commentId: string) {
    await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setCommentCount((n) => Math.max(0, n - 1));
  }

  const isLongText = editForm.format === "Long text";

  function setEditField(field: string, value: string | boolean) {
    setEditForm((f) => ({ ...f, [field]: value }));
  }

  async function saveEdit() {
    setEditSaving(true);
    const payload = {
      ...editForm,
      referenceVideo: editForm.referenceVideo || null,
      recordingNotes: editForm.recordingNotes || null,
      requiresAppFootage: isLongText ? false : editForm.requiresAppFootage,
      appFootageSource: editForm.requiresAppFootage && !isLongText ? (editForm.appFootageSource || null) : null,
    };
    const res = await fetch(`/api/hooks/${hook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const updated = await res.json();
    onEdit?.(hook.id, updated);
    setEditing(false);
    setEditSaving(false);
  }

  async function handleViralToggle() {
    setViralLoading(true);
    const res = await fetch(`/api/hooks/${hook.id}/viral`, { method: "POST" });
    const data = await res.json();
    onViralToggle?.(hook.id, data.wentViral);
    setViralLoading(false);
  }

  return (
    <div
      className={cn(
        "card p-4 transition-all duration-200",
        hook.isSelected && "ring-2 ring-blue-500 bg-blue-50/30 shadow-md",
        hook.wentViral && !hook.isSelected && "ring-1 ring-orange-300",
        !hook.isSelected && selectable && "hover:shadow-md cursor-pointer"
      )}
      onClick={() => selectable && onSelect?.(hook.id, !hook.isSelected)}
    >
      <div className="flex items-start gap-3">
        {selectable && (
          <button
            onClick={(e) => { e.stopPropagation(); onSelect?.(hook.id, !hook.isSelected); }}
            className={cn(
              "flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 mt-0.5",
              hook.isSelected
                ? "bg-blue-600 border-blue-600 text-white scale-110 shadow-sm shadow-blue-200"
                : "border-slate-300 text-transparent hover:border-blue-400 hover:scale-105"
            )}
          >
            {rank ? (
              <span className="text-xs font-bold">{rank}</span>
            ) : (
              <Check className={cn("w-3.5 h-3.5 transition-all duration-200", hook.isSelected ? "opacity-100 scale-100" : "opacity-0 scale-75")} />
            )}
          </button>
        )}

        <div className="flex-1 min-w-0">
          {/* Format badge + viral badge + selected badge + actions */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn("badge text-xs", formatColor)}>{hook.format}</span>
              {hook.isSelected && (
                <span className="badge text-xs bg-emerald-100 text-emerald-700 flex items-center gap-1 animate-in fade-in slide-in-from-left-1 duration-200">
                  <Check className="w-3 h-3" /> Selected
                </span>
              )}
              {hook.wentViral && (
                <span className="badge text-xs bg-orange-100 text-orange-700 flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Viral
                </span>
              )}
            </div>
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
              {isAdmin && onViralToggle && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleViralToggle(); }}
                  disabled={viralLoading}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    hook.wentViral
                      ? "text-orange-500 bg-orange-50 hover:bg-orange-100"
                      : "text-slate-400 hover:text-orange-500 hover:bg-orange-50"
                  )}
                  title={hook.wentViral ? "Remove from validated" : "Mark as went viral"}
                >
                  <Flame className="w-3.5 h-3.5" />
                </button>
              )}
              {onEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); setEditing(true); setExpanded(false); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Edit hook"
                >
                  <Pencil className="w-3.5 h-3.5" />
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

          {/* Inline edit form */}
          {editing && (
            <div className="space-y-3 mt-1 mb-2" onClick={(e) => e.stopPropagation()}>
              <div>
                <label className="label">Hook text *</label>
                <textarea
                  className="textarea font-medium"
                  rows={2}
                  value={editForm.hookText}
                  onChange={(e) => setEditField("hookText", e.target.value)}
                  
                />
              </div>
              <div>
                <label className="label">Format *</label>
                <div className="flex gap-2 flex-wrap">
                  {HOOK_FORMATS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        setEditField("format", f);
                        if (f === "Short text") setEditField("requiresAppFootage", true);
                        else if (f === "Long text") { setEditField("requiresAppFootage", false); setEditField("appFootageSource", ""); }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                        editForm.format === f
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              {!isLongText && (
                <div className="space-y-2">
                  <label className={cn("flex items-center gap-2 select-none w-fit", editForm.format === "Short text" ? "cursor-not-allowed opacity-70" : "cursor-pointer")}>
                    <input
                      type="checkbox"
                      checked={editForm.requiresAppFootage}
                      disabled={editForm.format === "Short text"}
                      onChange={(e) => { setEditField("requiresAppFootage", e.target.checked); if (!e.target.checked) setEditField("appFootageSource", ""); }}
                      className="rounded border-slate-300 accent-slate-800"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Requires app footage{editForm.format === "Short text" && <span className="text-slate-400 font-normal ml-1">(always required)</span>}
                    </span>
                  </label>
                  {editForm.requiresAppFootage && (
                    <input
                      className="input"
                      placeholder="Link or description"
                      value={editForm.appFootageSource}
                      onChange={(e) => setEditField("appFootageSource", e.target.value)}
                    />
                  )}
                </div>
              )}
              <div>
                <label className="label">Caption *</label>
                <textarea className="textarea" rows={3} value={editForm.caption} onChange={(e) => setEditField("caption", e.target.value)}  />
              </div>
              <div>
                <label className="label">Reference video URL</label>
                <input className="input" type="url" placeholder="https://..." value={editForm.referenceVideo} onChange={(e) => setEditField("referenceVideo", e.target.value)} />
              </div>
              <div>
                <label className="label">Recording notes</label>
                <textarea className="textarea" rows={2} value={editForm.recordingNotes} onChange={(e) => setEditField("recordingNotes", e.target.value)}  />
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={editSaving || !editForm.hookText || !editForm.caption} className="btn-primary flex items-center gap-1.5 text-sm px-4 py-2">
                  {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Save
                </button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {/* Hook text */}
          {!editing && (
            <div className="mb-2">
              <p className={cn("font-semibold text-slate-900 text-sm leading-snug", !textExpanded && "line-clamp-3")}>
                {hook.hookText}
              </p>
              {hook.hookText.length > 120 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setTextExpanded(!textExpanded); }}
                  className="text-[11px] text-blue-500 hover:text-blue-700 font-medium mt-0.5 transition-colors"
                >
                  {textExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          )}

          {/* AI caption */}
          {!editing && hook.aiCaption && (
            <div className="mt-2 p-2.5 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-1 mb-1">
                <Sparkles className="w-3 h-3 text-blue-500" />
                <span className="text-xs font-semibold text-blue-600">AI Caption</span>
              </div>
              <p className="text-xs text-blue-900 leading-relaxed">{hook.aiCaption}</p>
            </div>
          )}

          {!editing && !hook.aiCaption && (
            <p className="text-slate-500 text-xs leading-relaxed line-clamp-2 mb-1">{hook.caption}</p>
          )}

          {/* Expand toggle */}
          {!editing && <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors mt-1"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "Less" : "Caption & notes"}
          </button>}

          {!editing && expanded && (
            <div className="mt-2 space-y-2">
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

          {/* Vote + comment bar */}
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {/* Upvote */}
            <button
              onClick={() => handleVote(1)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors",
                myVote === 1
                  ? "bg-emerald-100 text-emerald-700"
                  : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
              )}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>

            {/* Score */}
            <span className={cn(
              "text-xs font-semibold px-1 min-w-[20px] text-center",
              voteScore > 0 ? "text-emerald-600" : voteScore < 0 ? "text-red-500" : "text-slate-400"
            )}>
              {voteScore}
            </span>

            {/* Downvote */}
            <button
              onClick={() => handleVote(-1)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors",
                myVote === -1
                  ? "bg-red-100 text-red-600"
                  : "text-slate-400 hover:text-red-500 hover:bg-red-50"
              )}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>

            <div className="flex-1" />

            {/* Comments toggle */}
            <button
              onClick={toggleComments}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors",
                showComments ? "bg-slate-100 text-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {commentCount > 0 ? commentCount : ""}
            </button>

            {/* Submitter */}
            {showSubmitter && (
              <div className="flex items-center gap-1.5 ml-1" title={hook.submitterName}>
                <UserAvatar
                  name={hook.submitterName}
                  avatarUrl={hook.submitterAvatarUrl ?? null}
                  color="blue"
                  size="xs"
                />
                <span className="text-xs text-slate-500">{hook.submitterName.split(" ")[0]}</span>
              </div>
            )}
          </div>

          {/* Comments section */}
          {showComments && (
            <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
              {loadingComments && (
                <div className="text-xs text-slate-400 py-2">Loading...</div>
              )}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2 group">
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center mt-0.5">
                    <span className="text-xs font-medium text-slate-600">{c.user.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700">{c.user.name}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-400">
                          {new Date(c.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                        {(c.userId === currentUserId || isAdmin) && (
                          <button
                            onClick={() => deleteComment(c.id)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition-all"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{renderWithMentions(c.content)}</p>
                  </div>
                </div>
              ))}

              <form onSubmit={submitComment} className="flex gap-2 mt-2">
                <MentionInput
                  value={commentText}
                  onChange={setCommentText}
                  onSubmit={() => submitComment({ preventDefault: () => {} } as React.FormEvent)}
                  placeholder="Add a comment... (@ to mention)"
                  disabled={submittingComment}
                />
                <button
                  type="submit"
                  disabled={!commentText.trim() || submittingComment}
                  className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
