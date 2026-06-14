export type CampaignColor = "violet" | "blue" | "emerald" | "orange" | "pink" | "yellow" | "teal" | "slate";

export type WeekStatus = "open" | "reviewing" | "finalized";
export type WeekMode = "mixed" | "bulk";

export type HookStatus = "submitted" | "selected" | "rejected";

export type HookFormat = "Faceless" | "Snapchat" | "Talking head" | "Voiceover" | "Text-only" | "Long text" | "Short text" | "Other";

export const HOOK_FORMATS: HookFormat[] = ["Faceless", "Snapchat", "Talking head", "Voiceover", "Text-only", "Long text", "Short text", "Other"];

export const FORMAT_COLORS: Record<string, string> = {
  Faceless: "bg-amber-100 text-amber-800 border-amber-300",
  Snapchat: "bg-lime-100 text-lime-800 border-lime-300",
  "Talking head": "bg-blue-100 text-blue-800 border-blue-300",
  Voiceover: "bg-violet-100 text-violet-800 border-violet-300",
  "Text-only": "bg-slate-100 text-slate-700 border-slate-300",
  "Long text": "bg-rose-100 text-rose-800 border-rose-300",
  "Short text": "bg-cyan-100 text-cyan-800 border-cyan-300",
  Other: "bg-orange-100 text-orange-800 border-orange-300",
};

export interface CampaignMember {
  id: string;
  campaignId: string;
  userId: string;
  role: "owner" | "supporter";
  user: { id: string; name: string; color: string; avatarUrl: string | null };
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  clientName: string;
  description: string | null;
  color: string;
  emoji: string;
  active: boolean;
  hooksTarget: number;
  validatedTarget: number;
  hashtags: string | null;
  validatedSheetUrl: string | null;
  logoUrl: string | null;
  members?: CampaignMember[];
  createdAt: string;
  updatedAt: string;
}

export interface Week {
  id: string;
  campaignId: string;
  campaign?: Campaign;
  weekStart: string;
  deadline: string;
  status: WeekStatus;
  mode: WeekMode;
  notes: string | null;
  newHooksSheetUrl: string | null;
  hooks?: Hook[];
  selectedValidated?: WeekValidatedHook[];
  createdAt: string;
  updatedAt: string;
}

export interface HookVote {
  id: string;
  hookId: string;
  userId: string;
  value: number;
  createdAt: string;
}

export interface HookComment {
  id: string;
  hookId: string;
  userId: string;
  user: { id: string; name: string; color: string; avatarUrl: string | null };
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Hook {
  id: string;
  weekId: string;
  week?: Week;
  submittedById: string | null;
  submitterName: string;
  submitterAvatarUrl?: string | null;
  hookText: string;
  format: HookFormat;
  caption: string;
  referenceVideo: string | null;
  recordingNotes: string | null;
  requiresAppFootage: boolean;
  appFootageSource: string | null;
  status: HookStatus;
  isSelected: boolean;
  selectedOrder: number | null;
  aiCaption: string | null;
  wentViral: boolean;
  votes?: HookVote[];
  commentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ValidatedHook {
  id: string;
  campaignId: string;
  campaign?: Campaign;
  hookText: string;
  format: string;
  caption: string;
  referenceVideo: string | null;
  recordingNotes: string | null;
  sourceHookId: string | null;
  addedById: string | null;
  addedBy?: { id: string; name: string } | null;
  notes: string | null;
  lastUsedAt: string | null;
  timesUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface WeekValidatedHook {
  id: string;
  weekId: string;
  validatedHookId: string;
  validatedHook: ValidatedHook;
  selectedOrder: number | null;
  createdAt: string;
}

export interface CampaignWithWeeks extends Campaign {
  weeks: Week[];
}

export interface WeekWithHooks extends Week {
  campaign: Campaign;
  hooks: Hook[];
  selectedValidated: WeekValidatedHook[];
}
