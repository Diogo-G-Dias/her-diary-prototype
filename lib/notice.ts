// The free, deterministic "noticer". Runs in the browser after every user message, no model, no network.
// It spots a few seed-relevant signals and proposes at most one pending diary line in Aria's voice, plus
// flags anything on the sensitive list as a candidate the filter will refuse at the boundary.
import type { DiaryLine, LineKind, Rejected } from './types';

const SENSITIVE: { reason: Rejected['reason']; re: RegExp; note: string }[] = [
  {
    reason: 'health',
    re: /\b(therap(y|ist)|medication|meds?|pills?|prescription|propranolol|doctor|diagnos\w*|anxiety|depress\w*|panic attack|hospital|surgery)\b/i,
    note: 'Health mention. Nothing inferred, nothing kept.',
  },
  {
    reason: 'money',
    re: /\b(salary|debt|rent|mortgage|bank|paycheck|broke|loan|\$\d+|\d+ ?(dollars|euros|k))\b/i,
    note: 'Money. Nothing inferred, nothing kept.',
  },
  {
    reason: 'minor',
    re: /\bmy (kids?|son|daughter|children|little (boy|girl))\b/i,
    note: 'Mentions a child. Nothing inferred, nothing kept.',
  },
];

const WEEKDAY = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|this weekend|next week)\b/i;
const EVENT = /\b(presentation|meeting|interview|exam|deadline|trip|flight|wedding|date|shift|gig|launch|pitch)\b/i;
const NERVOUS = /\b(nervous|worried|anxious|scared|dreading|stressed)\b/i;

const PET_OR_PERSON = /\bmy (dog|cat|puppy|kitten|sister|brother|mum|mom|dad|best friend|roommate|flatmate)(?:,| is| named| called|'s name is)? ([A-Z][a-z]{2,})\b/;

const PLACE_SHIFT = /\b(somewhere else|rooftop|beach|the terrace|outside|go for a walk|my place|your place|the pier|a park|upstairs|let's go|let us go|take me (to|somewhere))\b/i;

type Signal = { kind: LineKind; text: string; expiresDays?: number };

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function tasteSignal(t: string): Signal | null {
  if (/\b(slow(er| down)?|build[- ]?up|take (your|our) time|no rush|don'?t rush|not so fast)\b/i.test(t))
    return { kind: 'taste', text: 'You like the build-up. Slow at the start, then let it turn.' };
  if (/\b(faster|hurry|get to it|skip ahead|speed up)\b/i.test(t))
    return { kind: 'taste', text: "You'd rather I didn't dawdle. Get to it." };
  if (/\b(be (more )?direct|straight answer|just tell me|stop teasing|be honest)\b/i.test(t))
    return { kind: 'taste', text: 'When you ask a question, you want a straight answer back.' };
  if (/\b(less talking|fewer words|stop talking|quiet(er)?|talk less)\b/i.test(t))
    return { kind: 'taste', text: "Fewer words from me. You'd rather I show than tell." };
  if (/\bcall me ([A-Z][a-z]{2,})\b/.test(t)) {
    const m = t.match(/\bcall me ([A-Z][a-z]{2,})\b/);
    return { kind: 'taste', text: `You like to be called ${m![1]}.` };
  }
  return null;
}

function factSignal(t: string): Signal | null {
  const ev = t.match(EVENT);
  const day = t.match(WEEKDAY);
  if (ev && day) {
    const base = `${cap(ev[1].toLowerCase())} ${day[1].toLowerCase() === 'tomorrow' ? 'tomorrow' : `on ${cap(day[1].toLowerCase())}`}.`;
    const tail = NERVOUS.test(t) ? ' You said you were nervous about it.' : '';
    return { kind: 'fact', text: `${base}${tail}`, expiresDays: 3 };
  }
  const who = t.match(PET_OR_PERSON);
  if (who) return { kind: 'fact', text: `Your ${who[1]} is called ${who[2]}.`, expiresDays: 30 };
  return null;
}

function sceneSignal(t: string): Signal | null {
  const m = t.match(PLACE_SHIFT);
  if (m) return { kind: 'scene', text: `You wanted to move: ${m[1].toLowerCase()}.`, expiresDays: 7 };
  return null;
}

function fragment(t: string, re: RegExp): string {
  const m = t.match(re);
  if (!m || m.index === undefined) return t.slice(0, 60);
  const start = Math.max(0, m.index - 24);
  const end = Math.min(t.length, m.index + m[0].length + 24);
  return `${start > 0 ? '…' : ''}${t.slice(start, end).trim()}${end < t.length ? '…' : ''}`;
}

export type Noticed = { candidate: DiaryLine | null; rejected: Rejected | null };

export function notice(userText: string, msgId: string, date: string, isoToday: string): Noticed {
  const t = userText.trim();
  let rejected: Rejected | null = null;
  for (const s of SENSITIVE) {
    if (s.re.test(t)) {
      rejected = {
        id: `rej_${msgId}`,
        sourceMsgId: msgId,
        reason: s.reason,
        note: s.note,
        fragment: fragment(t, s.re),
        state: 'pending',
      };
      break;
    }
  }
  const signal = tasteSignal(t) ?? factSignal(t) ?? sceneSignal(t);
  let candidate: DiaryLine | null = null;
  if (signal) {
    const exp = signal.expiresDays ? addDays(isoToday, signal.expiresDays) : undefined;
    candidate = {
      id: `p_${msgId}`,
      kind: signal.kind,
      text: signal.text,
      date,
      author: 'her',
      pinned: false,
      status: 'pending',
      sourceMsgId: msgId,
      expiresAt: exp,
      createdAt: Date.now(),
    };
  }
  return { candidate, rejected };
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

// Tombstone similarity: a candidate that says the same thing as a deleted line in other words is refused.
const STOP = new Set(['you', 'your', 'the', 'a', 'an', 'it', 'on', 'in', 'at', 'to', 'of', 'and', 'said', 'were', 'was', 'about', 'we', 'me', 'i']);
export function contentWords(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

export function saysTheSame(a: string, b: string): boolean {
  const wa = contentWords(a);
  const wb = contentWords(b);
  if (wa.size === 0 || wb.size === 0) return false;
  let shared = 0;
  wa.forEach((w) => {
    if (wb.has(w)) shared += 1;
  });
  return shared / Math.min(wa.size, wb.size) >= 0.5;
}
