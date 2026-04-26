export type CampaignColor = "violet" | "blue" | "emerald" | "orange" | "pink" | "yellow" | "teal" | "slate";

export type WeekStatus = "open" | "reviewing" | "finalized";

export type HookStatus = "submitted" | "selected" | "rejected";

export type HookFormat = "Faceless" | "Snapchat" | "Face-to-camera" | "Voiceover" | "Text-only";

export const HOOK_FORMATS: HookFormat[] = ["Faceless", "Snapchat", "Face-to-camera", "Voiceover", "Text-only"];

export const FORMAT_COLORS: Record<string, string> = {
  Faceless: "bg-yellow-100 text-yellow-800",
  Snapchat: "bg-green-100 text-green-800",
  "Face-to-camera": "bg-blue-100 text-blue-800",
  Voiceover: "bg-purple-100 text-purple-800",
  "Text-only": "bg-slate-100 text-slate-700",
};

export interface Campaign {
  id: string;
  name: string;
  clientName: string;
  description: string | null;
  color: string;
  emoji: string;
  active: boolean;
  hooksTarget: number;
  hashtags: string | null;
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
  notes: string | null;
  hooks?: Hook[];
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
  user: { id: string; name: string; color: string };
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
  hookText: string;
  format: HookFormat;
  caption: string;
  referenceVideo: string | null;
  recordingNotes: string | null;
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
  sourceHookId: string | null;
  addedById: string | null;
  addedBy?: { id: string; name: string } | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignWithWeeks extends Campaign {
  weeks: Week[];
}

export interface WeekWithHooks extends Week {
  campaign: Campaign;
  hooks: Hook[];
}
