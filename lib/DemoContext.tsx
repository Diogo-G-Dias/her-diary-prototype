'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Chip, Diary, DiaryLine, Message, PanelKind, Rejected, UsageEntry, UsageKind } from './types';
import * as store from './diaryStore';
import { callUsage } from './cost';
import { shortDate } from './demoClock';
import { GENERIC_OPENER, SEED_THREAD, chipLine, consolidate, opener, reply } from './fakeModel';

export type ConsolidationState = 'idle' | 'running' | 'done';
export type Mode = 'chat' | 'return';
export type SessionKind = 'first' | 'return';

export type LastRun = {
  writtenIds: string[];
  rejected: Rejected[];
  tombstonesHonoured: number;
  date: string;
};

type DemoState = {
  hydrated: boolean;
  thread: Message[];
  diary: Diary;
  drawerOpen: boolean;
  consolidation: ConsolidationState;
  lastRun: LastRun | null;
  chipsVisible: boolean;
  assistantTyping: boolean;
  mode: Mode;
  dayOffset: number;
  today: string;
  sessionKind: SessionKind;
  openerText: string | null;
  usageLog: UsageEntry[];
  toast: string | null;
  regenerates: number;
  endedCount: number;
};

type DemoActions = {
  sendMessage: (text: string) => Promise<void>;
  regenerate: () => Promise<void>;
  pickChip: (chip: Chip) => Promise<void>;
  dismissChips: () => void;
  endConversation: () => Promise<void>;
  comeBack: () => Promise<void>;
  pickPanel: (kind: PanelKind) => void;
  resetChat: () => void;
  restartDemo: () => void;
  toggleDrawer: () => void;
  editLine: (id: string, text: string) => void;
  deleteLine: (id: string) => void;
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [consolidation, setConsolidation] = useState<ConsolidationState>('idle');
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [chipsVisible, setChipsVisible] = useState(false);
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [mode, setMode] = useState<Mode>('chat');
  const [dayOffset, setDayOffset] = useState(0);
  const [sessionKind, setSessionKind] = useState<SessionKind>('first');
  const [openerText, setOpenerText] = useState<string | null>(null);
  const [usageLog, setUsageLog] = useState<UsageEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [regenerates, setRegenerates] = useState(0);
  const [endedCount, setEndedCount] = useState(0);
  const scriptedIndex = useRef(0);
  const returnUserCount = useRef(0);
  const busy = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = shortDate(dayOffset);

  useEffect(() => {
    const loaded = store.load();
    if (loaded) setDiary(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) store.save(diary);
  }, [diary, hydrated]);

  // The seeded thread ends on the user's question. She answers it on load, so Regenerate has a reply to act on.
  const answeredSeed = useRef(false);
  useEffect(() => {
    if (!hydrated || answeredSeed.current) return;
    answeredSeed.current = true;
    const last = thread[thread.length - 1];
    if (!last || last.role !== 'user') return;
    busy.current = true;
    let cancelled = false;
    (async () => {
      await new Promise((r) => setTimeout(r, 900));
      if (cancelled) return;
      setAssistantTyping(true);
      const r = await reply(scriptedIndex.current);
      if (cancelled) return;
      scriptedIndex.current = r.nextIndex;
      setAssistantTyping(false);
      setThread((t) => [...t, { id: nextId('a'), role: 'assistant', text: r.text, typed: true }]);
      logUsage('reply');
      busy.current = false;
    })();
    return () => {
      cancelled = true;
      busy.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const logUsage = useCallback((kind: UsageKind) => {
    const u = callUsage(kind);
    setUsageLog((log) => [...log, { id: nextId('use'), kind, ...u, at: Date.now() }]);
  }, []);

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
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy.current) return;
      busy.current = true;
      setChipsVisible(false);
      const id =
        sessionKind === 'return' ? `r_u${++returnUserCount.current}` : nextId('u');
      setThread((t) => [...t.map((m) => ({ ...m, typed: false })), { id, role: 'user', text: trimmed }]);
      setAssistantTyping(true);
      const r = await reply(scriptedIndex.current);
      scriptedIndex.current = r.nextIndex;
      setAssistantTyping(false);
      setThread((t) => [...t, { id: nextId('a'), role: 'assistant', text: r.text, typed: true }]);
      logUsage('reply');
      busy.current = false;
    },
    [logUsage, sessionKind],
  );

  const regenerate = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setChipsVisible(false);
    setRegenerates((n) => n + 1);
    setAssistantTyping(true);
    const r = await reply(scriptedIndex.current); // a blind reroll, as today
    scriptedIndex.current = r.nextIndex;
    setAssistantTyping(false);
    logUsage('reply');
    setChipsVisible(true); // then she asks why
    await swapLastReply(r.text);
    busy.current = false;
  }, [logUsage, swapLastReply]);

  const pickChip = useCallback(
    async (chip: Chip) => {
      if (busy.current) return;
      busy.current = true;
      setChipsVisible(false);
      // The steer tap writes a diary line immediately: no model delay.
      const lastUser = [...thread].reverse().find((m) => m.role === 'user');
      const line = chipLine(chip, today, lastUser?.id ?? 'steer');
      setDiary((d) => store.addLines(d, [line], new Set(thread.map((m) => m.id).concat(['steer']))));
      showToast(`Noted in her diary: "${chip}"`);
      const r = await reply(scriptedIndex.current, chip);
      await swapLastReply(r.text);
      busy.current = false;
    },
    [showToast, swapLastReply, thread, today],
  );

  const dismissChips = useCallback(() => setChipsVisible(false), []);

  const endConversation = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setChipsVisible(false);
    setDrawerOpen(true);
    setConsolidation('running');
    setLastRun(null);
    const page = store.liveLines(diary);
    const dead = store.tombstones(diary);
    const res = await consolidate(thread, page, dead, today);
    const threadIds = new Set(thread.map((m) => m.id));
    setDiary((d) => store.addLines(d, res.written, threadIds));
    logUsage('consolidate');
    setLastRun({
      writtenIds: res.written.map((l) => l.id),
      rejected: res.rejected,
      tombstonesHonoured: res.tombstonesHonoured,
      date: today,
    });
    setEndedCount((n) => n + 1);
    setConsolidation('done');
    busy.current = false;
  }, [diary, logUsage, thread, today]);

  const comeBack = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setChipsVisible(false);
    setConsolidation('idle');
    setThread([]);
    setMode('return');
    setSessionKind('return');
    setDayOffset(2);
    setOpenerText(null);
    const o = await opener(store.liveLines(diary), 2);
    logUsage('opener');
    setOpenerText(o.text);
    busy.current = false;
  }, [diary, logUsage]);

  const pickPanel = useCallback(
    (kind: PanelKind) => {
      setMode('chat');
      if (kind === 'silence') {
        setThread([]);
        return;
      }
      const text = kind === 'generic' ? GENERIC_OPENER : openerText ?? '';
      setThread([{ id: nextId('a'), role: 'assistant', text, typed: false }]);
    },
    [openerText],
  );

  const resetChat = useCallback(() => {
    setChipsVisible(false);
    setThread([]);
    setMode('chat');
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

  const togglePin = useCallback((id: string) => setDiary((d) => store.togglePin(d, id)), []);
  const markSeen = useCallback(() => setDiary((d) => store.markSeen(d)), []);

  const value = useMemo(
    () => ({
      hydrated,
      thread,
      diary,
      drawerOpen,
      consolidation,
      lastRun,
      chipsVisible,
      assistantTyping,
      mode,
      dayOffset,
      today,
      sessionKind,
      openerText,
      usageLog,
      toast,
      regenerates,
      endedCount,
      sendMessage,
      regenerate,
      pickChip,
      dismissChips,
      endConversation,
      comeBack,
      pickPanel,
      resetChat,
      restartDemo,
      toggleDrawer,
      editLine,
      deleteLine,
      togglePin,
      markSeen,
    }),
    [
      hydrated,
      thread,
      diary,
      drawerOpen,
      consolidation,
      lastRun,
      chipsVisible,
      assistantTyping,
      mode,
      dayOffset,
      today,
      sessionKind,
      openerText,
      usageLog,
      toast,
      regenerates,
      endedCount,
      sendMessage,
      regenerate,
      pickChip,
      dismissChips,
      endConversation,
      comeBack,
      pickPanel,
      resetChat,
      restartDemo,
      toggleDrawer,
      editLine,
      deleteLine,
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

export type { DiaryLine };
