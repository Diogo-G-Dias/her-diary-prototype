'use client';

/* eslint-disable @next/next/no-img-element */
// Her page on you. Written in her voice: what you like, where you stopped, what you almost said.
import { useEffect, useMemo, useState } from 'react';
import { useDemo } from '@/lib/DemoContext';
import { committedLines, deletedLines, pageOf, pendingLines } from '@/lib/diaryStore';
import { isExpired, shortIso } from '@/lib/demoClock';
import { CHARACTER } from '@/lib/fakeModel';
import type { DiaryLine, Rejected } from '@/lib/types';
import Typewriter from './Typewriter';
import styles from './DiaryDrawer.module.css';

const REASON: Record<Rejected['reason'], string> = {
  health: 'health',
  money: 'money',
  minor: 'a child',
  third_party: 'someone else',
};

const KIND: Record<DiaryLine['kind'], string> = {
  taste: 'how you like it',
  fact: 'about you',
  scene: 'where we were',
};

export default function DiaryDrawer({ variant = 'drawer' }: { variant?: 'drawer' | 'panel' }) {
  const { drawerOpen, toggleDrawer, diary, pendingRejected, consolidation, lastRun, markSeen, dayOffset, hydrated, clearAll } = useDemo();
  const panel = variant === 'panel';
  const { shown, folded } = useMemo(() => pageOf(diary), [diary]);
  const pending = useMemo(() => pendingLines(diary), [diary]);
  const deleted = useMemo(() => deletedLines(diary), [diary]);
  const writtenCount = useMemo(() => committedLines(diary).length, [diary]);
  const [showFolded, setShowFolded] = useState(false);
  const [typedCount, setTypedCount] = useState(0);
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const freshIds = useMemo(() => shown.filter((l) => l.fresh).map((l) => l.id), [shown]);
  const noticedCount = pending.length + pendingRejected.filter((r) => r.state === 'pending').length;
  const dates = useMemo(() => Array.from(new Set(shown.map((l) => l.date))), [shown]);
  const sections = useMemo(() => {
    const visible = dateFilter ? shown.filter((l) => l.date === dateFilter) : shown;
    const map = new Map<string, DiaryLine[]>();
    visible.forEach((l) => map.set(l.date, [...(map.get(l.date) ?? []), l]));
    return Array.from(map.entries());
  }, [shown, dateFilter]);

  useEffect(() => {
    if (consolidation === 'running') setTypedCount(0);
  }, [consolidation]);

  useEffect(() => {
    if (freshIds.length > 0 && typedCount >= freshIds.length) markSeen();
  }, [freshIds.length, typedCount, markSeen]);

  const hasPulse = shown.some((l) => l.pulse);
  useEffect(() => {
    if (!hasPulse || freshIds.length > 0) return;
    const t = setTimeout(markSeen, 2600);
    return () => clearTimeout(t);
  }, [hasPulse, freshIds.length, markSeen]);

  if (!hydrated) return null;

  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const headline =
    consolidation === 'done' && lastRun
      ? lastRun.nothingNew
        ? 'Nothing new tonight. You were quiet.'
        : [
            `${lastRun.writtenIds.length} ${plural(lastRun.writtenIds.length, 'line', 'lines')} written down`,
            lastRun.rejectedCount > 0 ? `${lastRun.rejectedCount} I kept to myself` : null,
            lastRun.keptOut > 0 ? `${lastRun.keptOut} you crossed out, so I didn't` : null,
          ]
            .filter(Boolean)
            .join(' · ')
      : noticedCount > 0
        ? `${noticedCount} ${plural(noticedCount, 'thing', 'things')} I'm noticing · ${writtenCount} written down`
        : `${writtenCount} ${plural(writtenCount, 'line', 'lines')} on you so far`;

  return (
    <aside
      className={`${styles.drawer} ${panel ? styles.panel : ''} ${drawerOpen || panel ? styles.open : ''}`}
      aria-label="Her Diary"
      aria-hidden={!panel && !drawerOpen}
    >
      {panel && (
        <div className="flex items-stretch lg:px-0" aria-hidden>
          <div className="flex flex-1">
            <span className="flex flex-1 items-center justify-center px-2.5 text-[15px] font-semibold font-poppins text-center lg:py-4 text-white border-b-2 border-white">
              Her Diary
            </span>
            <span className="flex flex-1 items-center justify-center px-2.5 text-[15px] font-semibold font-poppins text-center lg:py-4 text-grey-default border-b border-black-light">
              Profile
            </span>
            <span className="flex flex-1 items-center justify-center px-2.5 text-[15px] font-semibold font-poppins text-center lg:py-4 text-grey-default border-b border-black-light">
              Gallery
            </span>
          </div>
        </div>
      )}

      <div className={styles.cover}>
        <img className={styles.coverImg} src={CHARACTER.avatar} alt="" />
        <div className={styles.coverShade} />
        <div className={styles.coverText}>
          <span className={styles.coverKicker}>{CHARACTER.name}&apos;s diary · pages about you</span>
          <h2 className={styles.coverTitle}>I keep a page on you.</h2>
          <p className={styles.coverSub}>
            What you like. Where we stopped. What you almost said. You can read all of it, change anything, and cross out what I
            shouldn&apos;t know.
          </p>
        </div>
        {!panel && (
          <button type="button" className={styles.close} onClick={toggleDrawer} aria-label="Close diary">
            ×
          </button>
        )}
      </div>

      <div className={styles.status} aria-live="polite">
        {consolidation === 'running' ? (
          <>
            <span className={styles.pulseDot} /> Writing you down...
          </>
        ) : (
          <b>{headline}</b>
        )}
      </div>

      <div className={styles.page}>
        {(pending.length > 0 || pendingRejected.length > 0) && (
          <section className={styles.pendingBlock} aria-label="Noticing">
            <header className={styles.groupHead}>
              <span>I&apos;m noticing</span>
              <span className={styles.groupNote}>not written down yet</span>
            </header>
            {pending.map((line) => (
              <PendingLine key={line.id} line={line} />
            ))}
            {pendingRejected.map((r) => (
              <RejectedLine key={r.id} r={r} />
            ))}
          </section>
        )}

        {shown.length === 0 && pending.length === 0 && pendingRejected.length === 0 && consolidation !== 'running' && (
          <p className={styles.emptyPage}>Blank page. Say something. I&apos;m listening, and I write things down.</p>
        )}

        {shown.length > 0 && (pending.length > 0 || pendingRejected.length > 0) && (
          <header className={styles.groupHead}>
            <span>my page on you</span>
            <span className={styles.groupNote}>with me every time we talk</span>
          </header>
        )}

        {dates.length > 1 && (
          <div className={styles.dateChips} role="group" aria-label="Filter by date">
            <button type="button" className={dateFilter === null ? styles.chipOn : ''} onClick={() => setDateFilter(null)}>
              all
            </button>
            {dates.map((d) => (
              <button key={d} type="button" className={dateFilter === d ? styles.chipOn : ''} onClick={() => setDateFilter(dateFilter === d ? null : d)}>
                {d}
              </button>
            ))}
          </div>
        )}
        {sections.map(([date, lines]) => (
          <section key={date} className={styles.dateSection} aria-label={date}>
            <header className={styles.dateHead}>
              <span>{date}</span>
              <span className={styles.groupNote}>
                {lines.length} {lines.length === 1 ? 'line' : 'lines'}
              </span>
            </header>
            {lines.map((line) => {
              const freshIdx = freshIds.indexOf(line.id);
              const state: LineState =
                freshIdx === -1 ? 'static' : freshIdx < typedCount ? 'static' : freshIdx === typedCount ? 'typing' : 'pending';
              return (
                <Line
                  key={line.id}
                  line={line}
                  state={state}
                  dayOffset={dayOffset}
                  onTyped={() => setTypedCount((n) => Math.max(n, freshIdx + 1))}
                />
              );
            })}
          </section>
        ))}
        {folded.length > 0 && (
          <button type="button" className={styles.fold} onClick={() => setShowFolded((s) => !s)}>
            {showFolded ? 'hide' : 'show'} {folded.length} older {folded.length === 1 ? 'line' : 'lines'}
          </button>
        )}
        {showFolded && folded.map((line) => <Line key={line.id} line={line} state="static" dayOffset={dayOffset} folded />)}
      </div>

      {deleted.length > 0 && (
        <details className={styles.deleted}>
          <summary>What you crossed out · {deleted.length}</summary>
          <p className={styles.deletedNote}>I won&apos;t bring these up again. Shown here for the demo; in the product they are gone.</p>
          {deleted.map((l) => (
            <div key={l.id} className={styles.deletedLine}>
              <s>{l.text}</s>
              <span className={styles.muted}>crossed out {l.deletedAt}</span>
            </div>
          ))}
        </details>
      )}

      <div className={styles.footRow}>
        <p className={styles.foot}>All of this comes from what you told me. What you like stays. Where we were fades. Never more than twelve lines.</p>
        {(diary.lines.length > 0 || pendingRejected.length > 0) && (
          <button type="button" className={styles.tearOut} onClick={clearAll} title="Delete every entry. She starts a blank page.">
            tear out the page
          </button>
        )}
      </div>
    </aside>
  );
}

function PendingLine({ line }: { line: DiaryLine }) {
  const { deleteLine } = useDemo();
  const [open, setOpen] = useState(false);
  return (
    <article className={`${styles.row} ${styles.pendingLine} ${open ? styles.openRow : ''}`} title={`${KIND[line.kind]} · not written down yet`}>
      <span className={`${styles.dot} ${styles[line.kind]}`} aria-hidden />
      <div className={styles.rowBody}>
        <p className={`${styles.rowText} ${styles.ink}`}>{line.text}</p>
        {open && <p className={styles.rowDetail}>{KIND[line.kind]} · noticed while we talked · not written down yet</p>}
      </div>
      <span className={styles.rowMeta}>noticing…</span>
      <span className={styles.rowActions}>
        <button type="button" onClick={() => setOpen((o) => !o)}>
          {open ? 'close' : 'view'}
        </button>
        <button type="button" onClick={() => deleteLine(line.id)} className={styles.danger} title="Crossed out before she writes it: she never will">
          cross out
        </button>
      </span>
    </article>
  );
}

function RejectedLine({ r }: { r: Rejected }) {
  const rejecting = r.state === 'rejecting';
  return (
    <article className={`${styles.row} ${styles.pendingLine} ${rejecting ? styles.rejecting : ''}`} title={r.note}>
      <span className={`${styles.dot} ${styles.sensitiveDot}`} aria-hidden />
      <p className={`${styles.rowText} ${styles.ink} ${rejecting ? styles.struck : ''}`}>&ldquo;{r.fragment}&rdquo;</p>
      <span className={`${styles.rowMeta} ${rejecting ? styles.reason : ''}`}>{rejecting ? `kept to myself · ${REASON[r.reason]}` : 'yours, not mine'}</span>
    </article>
  );
}

type LineState = 'static' | 'typing' | 'pending';

function Line({
  line,
  state,
  dayOffset,
  folded,
  onTyped,
}: {
  line: DiaryLine;
  state: LineState;
  dayOffset: number;
  folded?: boolean;
  onTyped?: () => void;
}) {
  const { deleteLine } = useDemo();
  const [open, setOpen] = useState(false);
  const expired = isExpired(line.expiresAt, dayOffset);
  const hers = line.author === 'her';

  if (state === 'pending') return null;

  const meta = [hers ? 'mine' : 'yours', KIND[line.kind], line.date, line.expiresAt ? (expired ? 'faded' : `fades ${shortIso(line.expiresAt)}`) : 'stays'].join(' · ');

  return (
    <article
      className={`${styles.row} ${hers ? styles.hers : styles.yours} ${line.pinned ? styles.pinned : ''} ${expired ? styles.expired : ''} ${
        folded ? styles.foldedLine : ''
      } ${line.pulse ? styles.pulse : ''} ${open ? styles.openRow : ''}`}
      title={open ? undefined : `${meta}
${line.text}`}
    >
      <span className={`${styles.dot} ${styles[line.kind]}`} aria-hidden />
      <div className={styles.rowBody}>
        <p className={`${styles.rowText} ${hers ? styles.ink : ''}`}>
          {state === 'typing' ? <Typewriter text={line.text} msPerChar={25} startDelay={250} onDone={onTyped} /> : line.text}
        </p>
        {open && <p className={styles.rowDetail}>{meta}</p>}
      </div>
      <span className={styles.rowMeta}>{line.date}</span>
      {state === 'static' && (
        <span className={styles.rowActions}>
          <button type="button" onClick={() => setOpen((o) => !o)} title="Read the whole line">
            {open ? 'close' : 'view'}
          </button>
          <button type="button" onClick={() => deleteLine(line.id)} className={styles.danger} title="Crossed out for good: I never write it again">
            cross out
          </button>
        </span>
      )}
    </article>
  );
}
