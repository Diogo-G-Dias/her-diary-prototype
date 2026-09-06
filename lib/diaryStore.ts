import type { Diary, DiaryLine } from './types';

const KEY = 'her-diary:v2';
export const CHARACTER_ID = 'aria';
export const PAGE_CAP = 12;

export function emptyDiary(): Diary {
  return { characterId: CHARACTER_ID, lines: [] };
}

// Pending lines belong to the conversation that produced them, so they are not restored across reloads.
export function load(): Diary | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Diary;
    if (!parsed || !Array.isArray(parsed.lines)) return null;
    return {
      ...parsed,
      lines: parsed.lines
        .map((l) => ({ ...l, status: l.status ?? 'committed', fresh: false, pulse: false }))
        .filter((l) => l.status === 'committed'),
    };
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

export function committedLines(diary: Diary): DiaryLine[] {
  return diary.lines.filter((l) => !l.deletedAt && l.status === 'committed');
}

export function pendingLines(diary: Diary): DiaryLine[] {
  return diary.lines.filter((l) => !l.deletedAt && l.status === 'pending').sort((a, b) => b.createdAt - a.createdAt);
}

export function deletedLines(diary: Diary): DiaryLine[] {
  return diary.lines.filter((l) => l.deletedAt);
}

// Rule 1 (belt and braces): her lines need a source message id that exists in the thread.
// Rule 2: tombstoned ids are refused. Duplicates are refused. A pending line is refused if a committed or
// deleted line already covers the same message.
export function addLines(diary: Diary, incoming: DiaryLine[], threadIds: Set<string>): Diary {
  const dead = new Set(tombstones(diary));
  const present = new Set(diary.lines.map((l) => l.id));
  const coveredSources = new Set(
    diary.lines.filter((l) => l.status === 'committed' || l.deletedAt).map((l) => l.sourceMsgId).filter(Boolean),
  );
  const accepted = incoming.filter((l) => {
    if (dead.has(l.id) || present.has(l.id)) return false;
    if (l.author === 'her' && (!l.sourceMsgId || !threadIds.has(l.sourceMsgId))) return false;
    if (l.status === 'pending' && l.sourceMsgId && coveredSources.has(l.sourceMsgId)) return false;
    return true;
  });
  return { ...diary, lines: [...diary.lines, ...accepted] };
}

// The boundary: pending lines firm up in place (same id), the job's own lines are added, refused pending
// lines disappear (they were never written).
export function commit(diary: Diary, converted: DiaryLine[], fresh: DiaryLine[], droppedPendingIds: string[]): Diary {
  const byId = new Map(converted.map((l) => [l.id, l]));
  const dropped = new Set(droppedPendingIds);
  const present = new Set(diary.lines.map((l) => l.id));
  const lines = diary.lines
    .filter((l) => !dropped.has(l.id))
    .map((l) => byId.get(l.id) ?? l);
  return { ...diary, lines: [...lines, ...fresh.filter((f) => !present.has(f.id))] };
}

// She writes a line mid-conversation: it replaces whatever she was still noticing about the same message.
export function writeNow(diary: Diary, line: DiaryLine): Diary {
  const dead = new Set(tombstones(diary));
  if (dead.has(line.id) || diary.lines.some((l) => l.deletedAt && l.sourceMsgId && l.sourceMsgId === line.sourceMsgId)) return diary;
  const lines = diary.lines.filter((l) => !(l.status === 'pending' && !l.deletedAt && l.sourceMsgId === line.sourceMsgId && l.kind === line.kind));
  return { ...diary, lines: [...lines, line] };
}

export function clearPending(diary: Diary): Diary {
  if (!diary.lines.some((l) => l.status === 'pending' && !l.deletedAt)) return diary;
  return { ...diary, lines: diary.lines.filter((l) => l.status !== 'pending' || l.deletedAt) };
}

export function editLine(diary: Diary, id: string, text: string): Diary {
  const trimmed = text.trim();
  return {
    ...diary,
    lines: diary.lines.map((l) =>
      l.id === id && trimmed.length > 0 && trimmed !== l.text ? { ...l, text: trimmed, author: 'you', fresh: false, pulse: false } : l,
    ),
  };
}

export function deleteLine(diary: Diary, id: string, when: string): Diary {
  return {
    ...diary,
    lines: diary.lines.map((l) => (l.id === id ? { ...l, deletedAt: when, pinned: false, fresh: false, pulse: false } : l)),
  };
}

export function togglePin(diary: Diary, id: string): Diary {
  return { ...diary, lines: diary.lines.map((l) => (l.id === id ? { ...l, pinned: !l.pinned, fresh: false, pulse: false } : l)) };
}

export function markSeen(diary: Diary): Diary {
  if (!diary.lines.some((l) => l.fresh || l.pulse)) return diary;
  return { ...diary, lines: diary.lines.map((l) => (l.fresh || l.pulse ? { ...l, fresh: false, pulse: false } : l)) };
}

// Rule 3: the visible page is at most PAGE_CAP committed lines: pinned first, then newest.
// Older unpinned lines fold in behind "older lines".
export function pageOf(diary: Diary): { shown: DiaryLine[]; folded: DiaryLine[] } {
  const live = committedLines(diary);
  const pinned = live.filter((l) => l.pinned).sort((a, b) => b.createdAt - a.createdAt);
  const rest = live.filter((l) => !l.pinned).sort((a, b) => b.createdAt - a.createdAt);
  const room = Math.max(0, PAGE_CAP - pinned.length);
  return { shown: [...pinned, ...rest.slice(0, room)], folded: rest.slice(room) };
}
