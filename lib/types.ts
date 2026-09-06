export type LineKind = 'taste' | 'fact' | 'scene';
export type Author = 'her' | 'you';
export type LineStatus = 'pending' | 'committed';

export type DiaryLine = {
  id: string;
  kind: LineKind; // taste persists, fact is dated, scene expires
  text: string; // her voice, second person
  date: string; // "6 Sep"
  author: Author; // yours she never touches; editing hers makes it yours
  pinned: boolean;
  status: LineStatus; // pending: noticed live, free, not in the prompt block. committed: written at the boundary
  sourceMsgId?: string; // her lines always point at a user message
  expiresAt?: string; // scene and fact lines only, ISO date
  deletedAt?: string; // tombstone: never rewritten
  createdAt: number; // insertion order for "newest first"
  fresh?: boolean; // UI only: type this line out when it appears
  pulse?: boolean; // UI only: highlight briefly (just committed, or written from a chip)
};

export type Diary = { characterId: string; lines: DiaryLine[] };

export type Role = 'assistant' | 'user';
export type Message = {
  id: string;
  role: Role;
  text: string;
  typed?: boolean; // UI only: animate this reply
  replaced?: boolean; // UI only: the old reply shown stacked before it collapses
};

export type Chip = 'slower' | 'more direct' | 'less talking' | 'somewhere else';
export const CHIPS: Chip[] = ['slower', 'more direct', 'less talking', 'somewhere else'];

// A candidate the filter will refuse. Surfaced while you talk, struck out at the boundary.
export type Rejected = {
  id: string;
  sourceMsgId: string;
  reason: 'health' | 'money' | 'minor' | 'third_party';
  note: string;
  fragment: string; // the user's own words, shortened
  state: 'pending' | 'rejecting';
};

export type UsageKind = 'consolidate' | 'opener' | 'reply';
export type UsageEntry = {
  id: string;
  kind: UsageKind;
  tokensIn: number;
  tokensOut: number;
  usd: number;
  at: number;
};

export type PanelKind = 'silence' | 'generic' | 'diary';
