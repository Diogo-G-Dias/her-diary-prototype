// Every "AI" behaviour in the demo lives here. No model, no network: scripted from seeds/*.json,
// with delays so it reads as live.
import conversation from '@/seeds/conversation.json';
import diarySeed from '@/seeds/diary.json';
import fallbackReplies from '@/seeds/fallbackReplies.json';
import type { Chip, Diary, DiaryLine, LineKind, Message, Rejected } from './types';
import { callUsage } from './cost';
import { isExpired } from './demoClock';
import { saysTheSame } from './notice';

export const CHARACTER = conversation.character;
export const SEED_THREAD: Message[] = conversation.thread as Message[];
export const MAX_PER_BOUNDARY = 2;

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const thinkTime = () => 600 + Math.floor(Math.random() * 800); // 600 to 1400 ms

// Next scripted reply; with a chip preference, that chip's variant. When the script runs out, a random
// in-character fallback. A user message is never left unanswered.
export async function reply(scriptedIndex: number, preference?: Chip): Promise<{ text: string; nextIndex: number }> {
  await sleep(thinkTime());
  if (preference) {
    return { text: conversation.regenerateVariants[preference], nextIndex: scriptedIndex };
  }
  const scripted = conversation.scriptedReplies;
  if (scriptedIndex < scripted.length) {
    return { text: scripted[scriptedIndex], nextIndex: scriptedIndex + 1 };
  }
  const pool = fallbackReplies as string[];
  return { text: pool[Math.floor(Math.random() * pool.length)], nextIndex: scriptedIndex + 1 };
}

type SeedLine = {
  id: string;
  kind: string;
  text: string;
  author: string;
  sourceMsgId: string;
  pinned: boolean;
  expiresAt?: string;
};

export type ConsolidateInput = {
  thread: Message[];
  diary: Diary;
  pendingRejected: Rejected[];
  date: string;
  aliases?: Record<string, string>; // seed source ids that stand for a message typed later, e.g. r_u1
};

export type ConsolidateResult = {
  converted: DiaryLine[]; // pending lines that become committed (same id, so the UI can firm them up in place)
  fresh: DiaryLine[]; // lines only the boundary job writes (story, where we left off)
  droppedPendingIds: string[]; // pending lines refused because they repeat something the user deleted
  rejectedIds: string[]; // sensitive candidates, struck out
  keptOut: number; // how many candidates the tombstone list stopped
  letGo: number; // candidates she chose not to write: the page stays short
  usage: ReturnType<typeof callUsage>;
};

// The one faked consolidation call per conversation boundary. Turns pending lines into committed ones,
// adds the story lines the boundary job alone writes, refuses anything sensitive or already deleted.
export async function consolidate(input: ConsolidateInput): Promise<ConsolidateResult> {
  await sleep(thinkTime());
  const { thread, diary, pendingRejected, date, aliases = {} } = input;
  const threadIds = new Set(thread.map((m) => m.id));
  const deleted = diary.lines.filter((l) => l.deletedAt);
  const committed = diary.lines.filter((l) => !l.deletedAt && l.status === 'committed');
  const pending = diary.lines.filter((l) => !l.deletedAt && l.status === 'pending');

  const isTombstoned = (id: string, text: string, sourceMsgId?: string) =>
    deleted.some((d) => d.id === id || (sourceMsgId && d.sourceMsgId === sourceMsgId) || saysTheSame(d.text, text));
  const alreadyCommitted = (id: string, text: string, sourceMsgId?: string, kind?: string) =>
    committed.some((c) => c.id === id || (sourceMsgId && c.sourceMsgId === sourceMsgId && c.kind === kind) || saysTheSame(c.text, text));

  const seeds: SeedLine[] = [...(diarySeed.linesSheWrites as SeedLine[]), ...(diarySeed.returnLines as SeedLine[])].map((s) => ({
    ...s,
    sourceMsgId: aliases[s.sourceMsgId] ?? s.sourceMsgId,
  }));
  const usedSeeds = new Set<string>();
  const base = Date.now();
  let keptOut = 0;

  const converted: DiaryLine[] = [];
  const droppedPendingIds: string[] = [];
  pending.forEach((p, i) => {
    if (isTombstoned(p.id, p.text, p.sourceMsgId)) {
      keptOut += 1;
      droppedPendingIds.push(p.id);
      return;
    }
    // The boundary job writes the line properly; if a seed has the polished version, use its words.
    const seed = seeds.find((s) => s.sourceMsgId === p.sourceMsgId && s.kind === p.kind && !usedSeeds.has(s.id));
    if (seed) usedSeeds.add(seed.id);
    converted.push({
      ...p,
      text: seed?.text ?? p.text,
      expiresAt: seed?.expiresAt ?? p.expiresAt,
      status: 'committed',
      date,
      createdAt: base + i, // written later, shown higher
      fresh: false,
      pulse: true,
    });
  });

  const fresh: DiaryLine[] = [];
  seeds.forEach((s, i) => {
    if (usedSeeds.has(s.id) || !threadIds.has(s.sourceMsgId)) return;
    if (alreadyCommitted(s.id, s.text, s.sourceMsgId, s.kind)) return;
    if (isTombstoned(s.id, s.text)) {
      keptOut += 1;
      return;
    }
    fresh.push({
      id: s.id,
      kind: s.kind as LineKind,
      text: s.text,
      date,
      author: 'her',
      pinned: false,
      status: 'committed',
      sourceMsgId: s.sourceMsgId,
      expiresAt: s.expiresAt,
      createdAt: base + pending.length + i,
      fresh: true,
    });
  });

  // She keeps the page short: at most MAX_PER_BOUNDARY lines per conversation, taste first, then the
  // scene, then facts. The rest she lets go.
  const rank = (l: DiaryLine) => (l.kind === 'taste' ? 0 : l.kind === 'scene' ? 1 : 2);
  const candidates = [...converted.map((l) => ({ l, from: 'pending' as const })), ...fresh.map((l) => ({ l, from: 'fresh' as const }))];
  candidates.sort((a, b) => rank(a.l) - rank(b.l) || a.l.createdAt - b.l.createdAt);
  const keep = new Set(candidates.slice(0, MAX_PER_BOUNDARY).map((c) => c.l.id));
  const letGo = candidates.length - keep.size;
  const keptConverted = converted.filter((l) => keep.has(l.id)).map((l, i) => ({ ...l, createdAt: base + i }));
  const keptFresh = fresh.filter((l) => keep.has(l.id)).map((l, i) => ({ ...l, createdAt: base + keptConverted.length + i }));
  const dropped = [...droppedPendingIds, ...converted.filter((l) => !keep.has(l.id)).map((l) => l.id)];

  return {
    converted: keptConverted,
    fresh: keptFresh,
    droppedPendingIds: dropped,
    rejectedIds: pendingRejected.filter((r) => r.state === 'pending').map((r) => r.id),
    keptOut,
    letGo,
    usage: callUsage('consolidate'),
  };
}

export function chipLine(chip: Chip, date: string, sourceMsgId: string): DiaryLine {
  const c = diarySeed.chipLines[chip];
  return {
    id: `d_chip_${chip.replace(/\s+/g, '_')}_${Date.now()}`,
    kind: c.kind as LineKind,
    text: c.text,
    date,
    author: 'her',
    pinned: false,
    status: 'committed',
    sourceMsgId,
    createdAt: Date.now(),
    fresh: false,
    pulse: true,
  };
}

// Scripted opener chosen by what is still live on the committed page: a scene line means she picks the
// story back up; a live fact line means she asks about Thursday. Deleted or expired lines are omitted.
export function openerFor(diary: Diary, dayOffset: number): string {
  const live = diary.lines.filter((l) => !l.deletedAt && l.status === 'committed' && !isExpired(l.expiresAt, dayOffset));
  const hasScene = live.some((l) => l.kind === 'scene');
  const hasFact = live.some((l) => l.kind === 'fact');
  const o = diarySeed.openers;
  if (hasScene && hasFact) return o.sceneWithFact;
  if (hasScene) return o.sceneNoFact;
  if (hasFact) return o.real;
  return o.realNoFact;
}

export async function opener(diary: Diary, dayOffset: number): Promise<{ text: string; usage: ReturnType<typeof callUsage> }> {
  await sleep(thinkTime());
  return { text: openerFor(diary, dayOffset), usage: callUsage('opener') };
}

export const GENERIC_OPENER = 'hey, missed you \u{1F642}';
