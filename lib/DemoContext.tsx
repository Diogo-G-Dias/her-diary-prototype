'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Chip, Diary, DiaryLine, Message, Rejected, UsageEntry, UsageKind } from './types';
import * as store from './diaryStore';
import { callUsage } from './cost';
import { isoAt, shortDate } from './demoClock';
import { SEED_THREAD, chipLine, consolidate, opener, reply, sleep, thinkTime } from './fakeModel';
import { notice } from './notice';

export type ConsolidationState = 'idle' | 'running' | 'done';
export type SessionKind = 'first' | 'return';

export type LastRun = {
  writtenIds: string[];
  rejectedCount: number;
  keptOut: number;
  letGo: number;
  date: string;
  nothingNew: boolean;
};

type DemoState = {
  hydrated: boolean;
  thread: Message[];
  diary: Diary;
  pendingRejected: Rejected[];
  drawerOpen: boolean;
  consolidation: ConsolidationState;
  lastRun: LastRun | null;
  chipsVisible: boolean;
  assistantTyping: boolean;
  dayOffset: number;
  today: string;
  sessionKind: SessionKind;
  openerText: string | null;
  usageLog: UsageEntry[];
  toast: string | null;
  regenerates: number;
  endedCount: number;
  wasReset: boolean;
};

type DemoActions = {
  sendMessage: (text: string, scriptedReply?: string) => void;
  regenerate: () => void;
  pickChip: (chip: Chip) => void;
  dismissChips: () => void;
  endConversation: () => void;
  comeBack: () => void;
  resetChat: () => void;
  restartDemo: () => void;
  toggleDrawer: () => void;
  editLine: (id: string, text: string) => void;
  deleteLine: (id: string) => void;
  clearAll: () => void;
  togglePin: (id: string) => void;
  markSeen: () => void;
};

const Ctx = createContext<(DemoState & DemoActions) | null>(null);

let uid = 0;
const nextId = (prefix: string) => `${prefix}${++uid}_${Date.now().toString(36)}`;

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [thread, setThread] = useState<Message[]>(SEED_THREAD);
  const [diary, setDiary] = useState<Diary>(store.emptyDiary());
  const [pendingRejected, setPendingRejected] = useState<Rejected[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [consolidation, setConsolidation] = useState<ConsolidationState>('idle');
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [chipsVisible, setChipsVisible] = useState(false);
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [dayOffset, setDayOffset] = useState(0);
  const [sessionKind, setSessionKind] = useState<SessionKind>('first');
  const [openerText, setOpenerText] = useState<string | null>(null);
  const [usageLog, setUsageLog] = useState<UsageEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [regenerates, setRegenerates] = useState(0);
  const [endedCount, setEndedCount] = useState(0);
  const [wasReset, setWasReset] = useState(false);

  const scriptedIndex = useRef(0);
  const userCount = useRef(0);
  const returnFirstUserId = useRef<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Every model-shaped action runs through one queue, so nothing is ever dropped while she is typing.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const threadRef = useRef(thread);
  const diaryRef = useRef(diary);
  const rejectedRef = useRef(pendingRejected);
  threadRef.current = thread;
  diaryRef.current = diary;
  rejectedRef.current = pendingRejected;

  const today = shortDate(dayOffset);

  const enqueue = useCallback((fn: () => Promise<void>) => {
    const run = chain.current.then(fn, fn);
    chain.current = run.catch(() => undefined);
  }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const logUsage = useCallback((kind: UsageKind) => {
    const u = callUsage(kind);
    setUsageLog((log) => [...log, { id: nextId('use'), kind, ...u, at: Date.now() }]);
  }, []);

  // The free noticer: after a user message, maybe one pending line and maybe one flagged candidate.
  const noticeMessage = useCallback((text: string, msgId: string) => {
    const n = notice(text, msgId, shortDate(dayOffset), isoAt(dayOffset));
    const threadIds = new Set(threadRef.current.map((m) => m.id).concat([msgId]));
    if (n.candidate) setDiary((d) => store.addLines(d, [n.candidate as DiaryLine], threadIds));
    if (n.rejected) {
      const r = n.rejected;
      setPendingRejected((list) => (list.some((x) => x.id === r.id) ? list : [...list, r]));
    }
  }, [dayOffset]);

  useEffect(() => {
    const loaded = store.load();
    if (loaded) setDiary(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) store.save(diary);
  }, [diary, hydrated]);

  // On load: she has been "noticing" the seeded conversation, and she answers its last question.
  useEffect(() => {
    if (!hydrated) return;
    SEED_THREAD.filter((m) => m.role === 'user').forEach((m) => noticeMessage(m.text, m.id));
    const last = SEED_THREAD[SEED_THREAD.length - 1];
    if (!last || last.role !== 'user') return;
    const t = setTimeout(() => {
      enqueue(async () => {
        setAssistantTyping(true);
        const r = await reply(scriptedIndex.current);
        scriptedIndex.current = r.nextIndex;
        setAssistantTyping(false);
        setThread((th) => [...th, { id: nextId('a'), role: 'assistant', text: r.text, typed: true }]);
        logUsage('reply');
      });
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const swapLastReply = useCallback(async (text: string) => {
    // Old and new reply shown stacked for about 2 s, then the old one collapses.
    // Only the last message can be regenerated, and only if it is hers.
    let oldId: string | null = null;
    setThread((t) => {
      const last = t[t.length - 1];
      if (!last || last.role !== 'assistant') return [...t, { id: nextId('a'), role: 'assistant', text, typed: true }];
      oldId = last.id;
      return [...t.slice(0, -1), { ...last, replaced: true, typed: false }, { id: nextId('a'), role: 'assistant', text, typed: true }];
    });
    await new Promise((r) => setTimeout(r, 2000));
    if (oldId) setThread((t) => t.filter((m) => m.id !== oldId));
  }, []);

  const sendMessage = useCallback(
    (text: string, scriptedReply?: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setChipsVisible(false);
      const id = `u_${++userCount.current}`;
      if (sessionKind === 'return' && !returnFirstUserId.current) returnFirstUserId.current = id;
      // The bubble renders at once; her reply queues behind whatever she is doing.
      setThread((t) => [...t.map((m) => ({ ...m, typed: false })), { id, role: 'user', text: trimmed }]);
      noticeMessage(trimmed, id);
      enqueue(async () => {
        setAssistantTyping(true);
        let text: string;
        if (scriptedReply) {
          await sleep(thinkTime());
          text = scriptedReply;
        } else {
          const r = await reply(scriptedIndex.current);
          scriptedIndex.current = r.nextIndex;
          text = r.text;
        }
        setAssistantTyping(false);
        setThread((t) => [...t, { id: nextId('a'), role: 'assistant', text, typed: true }]);
        logUsage('reply');
      });
    },
    [enqueue, logUsage, noticeMessage, sessionKind],
  );

  const regenerate = useCallback(() => {
    setChipsVisible(false);
    setRegenerates((n) => n + 1);
    enqueue(async () => {
      setAssistantTyping(true);
      const r = await reply(scriptedIndex.current); // a blind reroll, as today
      scriptedIndex.current = r.nextIndex;
      setAssistantTyping(false);
      logUsage('reply');
      setChipsVisible(true); // then she asks why
      await swapLastReply(r.text);
    });
  }, [enqueue, logUsage, swapLastReply]);

  const pickChip = useCallback(
    (chip: Chip) => {
      setChipsVisible(false);
      // An explicit correction writes a committed line at once: no boundary, no model call.
      const th = threadRef.current;
      const lastUser = [...th].reverse().find((m) => m.role === 'user');
      const line = chipLine(chip, today, lastUser?.id ?? 'steer');
      setDiary((d) => store.addLines(d, [line], new Set(th.map((m) => m.id).concat(['steer']))));
      setDrawerOpen(true);
      setConsolidation('idle'); // the header goes back to live counts
      showToast(`Noted in her diary: "${chip}"`);
      enqueue(async () => {
        const r = await reply(scriptedIndex.current, chip);
        logUsage('reply');
        await swapLastReply(r.text);
      });
    },
    [enqueue, logUsage, showToast, swapLastReply, today],
  );

  const dismissChips = useCallback(() => setChipsVisible(false), []);

  const endConversation = useCallback(() => {
    setChipsVisible(false);
    setDrawerOpen(true);
    enqueue(async () => {
      setConsolidation('running');
      setLastRun(null);
      const aliases: Record<string, string> = {};
      if (returnFirstUserId.current) aliases.r_u1 = returnFirstUserId.current;
      const res = await consolidate({
        thread: threadRef.current,
        diary: diaryRef.current,
        pendingRejected: rejectedRef.current,
        date: today,
        aliases,
      });
      setDiary((d) => store.commit(d, res.converted, res.fresh, res.droppedPendingIds));
      const rejectedIds = new Set(res.rejectedIds);
      setPendingRejected((list) => list.map((r) => (rejectedIds.has(r.id) ? { ...r, state: 'rejecting' } : r)));
      logUsage('consolidate');
      const writtenIds = [...res.converted.map((l) => l.id), ...res.fresh.map((l) => l.id)];
      setLastRun({
        writtenIds,
        rejectedCount: res.rejectedIds.length,
        keptOut: res.keptOut,
        letGo: res.letGo,
        date: today,
        nothingNew: writtenIds.length === 0 && res.rejectedIds.length === 0,
      });
      setEndedCount((n) => n + 1);
      setConsolidation('done');
      // The struck-out candidates stay visible long enough to read, then fade out.
      await new Promise((r) => setTimeout(r, 2400));
      setPendingRejected((list) => list.filter((r) => !rejectedIds.has(r.id)));
    });
  }, [enqueue, logUsage, today]);

  const comeBack = useCallback(() => {
    setChipsVisible(false);
    setConsolidation('idle');
    setWasReset(false);
    setThread([]);
    setDiary((d) => store.clearPending(d)); // noticed but never committed: the conversation is over
    setPendingRejected([]);
    setSessionKind('return');
    setDayOffset(2);
    enqueue(async () => {
      // Two days later you open the app and she speaks first, from the page.
      setAssistantTyping(true);
      const o = await opener(diaryRef.current, 2);
      setAssistantTyping(false);
      logUsage('opener');
      setOpenerText(o.text);
      setThread([{ id: nextId('a'), role: 'assistant', text: o.text, typed: true }]);
    });
  }, [enqueue, logUsage]);

  const resetChat = useCallback(() => {
    setChipsVisible(false);
    setThread([]);
    setDiary((d) => store.clearPending(d));
    setPendingRejected([]);
    setWasReset(true);
    setConsolidation('idle');
    showToast('Chat reset. Her diary is untouched.');
  }, [showToast]);

  const restartDemo = useCallback(() => {
    store.clearStorage();
    if (typeof window !== 'undefined') window.location.reload();
  }, []);

  const toggleDrawer = useCallback(() => setDrawerOpen((o) => !o), []);

  const editLine = useCallback((id: string, text: string) => {
    setDiary((d) => store.editLine(d, id, text));
  }, []);

  const deleteLine = useCallback(
    (id: string) => {
      setDiary((d) => store.deleteLine(d, id, today));
      showToast("Deleted. It won't come back: she is told never to write it again.");
    },
    [showToast, today],
  );

  const clearAll = useCallback(() => {
    // Tear the page out: nothing kept, nothing blocked. She can start noticing again.
    setDiary(store.emptyDiary());
    setPendingRejected([]);
    setLastRun(null);
    setConsolidation('idle');
    showToast('Page torn out. Nothing kept, nothing blocked.');
  }, [showToast]);

  const togglePin = useCallback((id: string) => setDiary((d) => store.togglePin(d, id)), []);
  const markSeen = useCallback(() => setDiary((d) => store.markSeen(d)), []);

  const value = useMemo(
    () => ({
      hydrated,
      thread,
      diary,
      pendingRejected,
      drawerOpen,
      consolidation,
      lastRun,
      chipsVisible,
      assistantTyping,
      dayOffset,
      today,
      sessionKind,
      openerText,
      usageLog,
      toast,
      regenerates,
      endedCount,
      wasReset,
      sendMessage,
      regenerate,
      pickChip,
      dismissChips,
      endConversation,
      comeBack,
      resetChat,
      restartDemo,
      toggleDrawer,
      editLine,
      deleteLine,
      clearAll,
      togglePin,
      markSeen,
    }),
    [
      hydrated,
      thread,
      diary,
      pendingRejected,
      drawerOpen,
      consolidation,
      lastRun,
      chipsVisible,
      assistantTyping,
      dayOffset,
      today,
      sessionKind,
      openerText,
      usageLog,
      toast,
      regenerates,
      endedCount,
      wasReset,
      sendMessage,
      regenerate,
      pickChip,
      dismissChips,
      endConversation,
      comeBack,
      resetChat,
      restartDemo,
      toggleDrawer,
      editLine,
      deleteLine,
      clearAll,
      togglePin,
      markSeen,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDemo outside DemoProvider');
  return v;
}
