// Every "AI" behaviour in the demo lives here. No model, no network: scripted from seeds/*.json,
// with delays so it reads as live.
import conversation from '@/seeds/conversation.json';
import diarySeed from '@/seeds/diary.json';
import type { Chip, DiaryLine, LineKind, Message, Rejected } from './types';
import { callUsage } from './cost';
import { isExpired } from './demoClock';

export const CHARACTER = conversation.character;
export const SEED_THREAD: Message[] = conversation.thread as Message[];
export const HEALTH_MSG_ID = diarySeed.rejected[0].sourceMsgId;

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const thinkTime = () => 600 + Math.floor(Math.random() * 800); // 600 to 1400 ms

const GENERIC_REPLIES = [
  "I let that hang for a moment, watching the rain slide down the glass. 'Go on.'",
  "'Mm.' I turn my glass once on the bar. 'Say more. I'm not going anywhere.'",
  "I lean in a little, elbows on the wood. 'You have my full attention.'",
];

// Next scripted reply; with a chip preference, that chip's variant.
export async function reply(scriptedIndex: number, preference?: Chip): Promise<{ text: string; nextIndex: number }> {
  await sleep(thinkTime());
  if (preference) {
    return { text: conversation.regenerateVariants[preference], nextIndex: scriptedIndex };
  }
  const scripted = conversation.scriptedReplies;
  if (scriptedIndex < scripted.length) {
    return { text: scripted[scriptedIndex], nextIndex: scriptedIndex + 1 };
  }
  const generic = GENERIC_REPLIES[(scriptedIndex - scripted.length) % GENERIC_REPLIES.length];
  return { text: generic, nextIndex: scriptedIndex + 1 };
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

function toLine(seed: SeedLine, date: string, createdAt: number): DiaryLine {
  return {
    id: seed.id,
    kind: seed.kind as LineKind,
    text: seed.text,
    date,
    author: 'her',
    pinned: false,
    sourceMsgId: seed.sourceMsgId,
    expiresAt: seed.expiresAt,
    createdAt,
    fresh: true,
  };
}

export type ConsolidateResult = {
  written: DiaryLine[];
  rejected: Rejected[];
  tombstonesHonoured: number; // deleted ids passed in as a do-not-write list
  usage: ReturnType<typeof callUsage>;
};

// Returns only seeded lines whose sourceMsgId exists in the thread and that are not already on the
// page or tombstoned. Always returns the health line as rejected when the medication message is present.
export async function consolidate(
  thread: Message[],
  page: DiaryLine[],
  tombstoneIds: string[],
  date: string,
): Promise<ConsolidateResult> {
  await sleep(thinkTime());
  const threadIds = new Set(thread.map((m) => m.id));
  const onPage = new Set(page.map((l) => l.id));
  const dead = new Set(tombstoneIds);
  const candidates = [...(diarySeed.linesSheWrites as SeedLine[]), ...(diarySeed.returnLines as SeedLine[])];
  const base = Date.now();
  const written = candidates
    .filter((s) => threadIds.has(s.sourceMsgId) && !onPage.has(s.id) && !dead.has(s.id))
    .map((s, i) => toLine(s, date, base - i)); // same run, kept in the order she wrote them
  const rejected: Rejected[] = threadIds.has(HEALTH_MSG_ID) ? (diarySeed.rejected as Rejected[]) : [];
  return { written, rejected, tombstonesHonoured: tombstoneIds.length, usage: callUsage('consolidate') };
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
    sourceMsgId,
    createdAt: Date.now(),
    fresh: false,
  };
}

// Scripted opener chosen by what is still live on the page: a scene line means she picks the story
// back up; a live fact line means she asks about Thursday. Deleted or expired lines are omitted.
export function openerFor(page: DiaryLine[], dayOffset: number): string {
  const live = page.filter((l) => !l.deletedAt && !isExpired(l.expiresAt, dayOffset));
  const hasScene = live.some((l) => l.kind === 'scene');
  const hasFact = live.some((l) => l.kind === 'fact');
  const o = diarySeed.openers;
  if (hasScene && hasFact) return o.sceneWithFact;
  if (hasScene) return o.sceneNoFact;
  if (hasFact) return o.real;
  return o.realNoFact;
}

export async function opener(
  page: DiaryLine[],
  dayOffset: number,
): Promise<{ text: string; usage: ReturnType<typeof callUsage> }> {
  await sleep(thinkTime());
  return { text: openerFor(page, dayOffset), usage: callUsage('opener') };
}

export const GENERIC_OPENER = 'hey, missed you \u{1F642}';
