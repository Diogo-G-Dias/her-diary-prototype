import type { Diary, DiaryLine } from './types';

const KEY = 'her-diary:v1';
export const CHARACTER_ID = 'aria';
export const PAGE_CAP = 12;

export function emptyDiary(): Diary {
  return { characterId: CHARACTER_ID, lines: [] };
}

export function load(): Diary | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Diary;
    if (!parsed || !Array.isArray(parsed.lines)) return null;
    return { ...parsed, lines: parsed.lines.map((l) => ({ ...l, fresh: false })) };
  } catch {
    return null;
  }
}

export function save(diary: Diary): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(diary));
  } catch {
    /* storage unavailable: the demo still works in memory */
  }
}

export function clearStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// Rule 2: a line with deletedAt is a tombstone and is never written again.
export function tombstones(diary: Diary): string[] {
  return diary.lines.filter((l) => l.deletedAt).map((l) => l.id);
}

export function liveLines(diary: Diary): DiaryLine[] {
  return diary.lines.filter((l) => !l.deletedAt);
}

export function deletedLines(diary: Diary): DiaryLine[] {
  return diary.lines.filter((l) => l.deletedAt);
}

// Rule 1 (belt and braces): her lines need a source message id that exists in the thread.
// Rule 2: tombstoned ids are refused. Duplicates are refused.
export function addLines(diary: Diary, incoming: DiaryLine[], threadIds: Set<string>): Diary {
  const dead = new Set(tombstones(diary));
  const present = new Set(diary.lines.map((l) => l.id));
  const accepted = incoming.filter((l) => {
    if (dead.has(l.id) || present.has(l.id)) return false;
    if (l.author === 'her' && (!l.sourceMsgId || !threadIds.has(l.sourceMsgId))) return false;
    return true;
  });
  return { ...diary, lines: [...diary.lines, ...accepted] };
}

export function editLine(diary: Diary, id: string, text: string): Diary {
  const trimmed = text.trim();
  return {
    ...diary,
    lines: diary.lines.map((l) =>
      l.id === id && trimmed.length > 0 && trimmed !== l.text ? { ...l, text: trimmed, author: 'you', fresh: false } : l,
    ),
  };
}

export function deleteLine(diary: Diary, id: string, when: string): Diary {
  return {
    ...diary,
    lines: diary.lines.map((l) => (l.id === id ? { ...l, deletedAt: when, pinned: false, fresh: false } : l)),
  };
}

export function togglePin(diary: Diary, id: string): Diary {
  return { ...diary, lines: diary.lines.map((l) => (l.id === id ? { ...l, pinned: !l.pinned, fresh: false } : l)) };
}

export function markSeen(diary: Diary): Diary {
  if (!diary.lines.some((l) => l.fresh)) return diary;
  return { ...diary, lines: diary.lines.map((l) => (l.fresh ? { ...l, fresh: false } : l)) };
}

// Rule 3: the visible page is at most PAGE_CAP live lines: pinned first, then newest.
// Older unpinned lines fold in behind "older lines".
export function pageOf(diary: Diary): { shown: DiaryLine[]; folded: DiaryLine[] } {
  const live = liveLines(diary);
  const pinned = live.filter((l) => l.pinned).sort((a, b) => b.createdAt - a.createdAt);
  const rest = live.filter((l) => !l.pinned).sort((a, b) => b.createdAt - a.createdAt);
  const room = Math.max(0, PAGE_CAP - pinned.length);
  return { shown: [...pinned, ...rest.slice(0, room)], folded: rest.slice(room) };
}
