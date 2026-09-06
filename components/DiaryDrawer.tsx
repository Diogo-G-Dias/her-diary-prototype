'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDemo } from '@/lib/DemoContext';
import { committedLines, deletedLines, pageOf, pendingLines } from '@/lib/diaryStore';
import { isExpired, shortIso } from '@/lib/demoClock';
import type { DiaryLine, Rejected } from '@/lib/types';
import Typewriter from './Typewriter';
import styles from './DiaryDrawer.module.css';

const REASON: Record<Rejected['reason'], string> = {
  health: 'health',
  money: 'money',
  minor: 'a child',
  third_party: 'someone else',
};

export default function DiaryDrawer() {
  const { drawerOpen, toggleDrawer, diary, pendingRejected, consolidation, lastRun, markSeen, dayOffset, hydrated } = useDemo();
  const { shown, folded } = useMemo(() => pageOf(diary), [diary]);
  const pending = useMemo(() => pendingLines(diary), [diary]);
  const deleted = useMemo(() => deletedLines(diary), [diary]);
  const writtenCount = useMemo(() => committedLines(diary).length, [diary]);
  const [showFolded, setShowFolded] = useState(false);
  const [typedCount, setTypedCount] = useState(0);

  const freshIds = useMemo(() => shown.filter((l) => l.fresh).map((l) => l.id), [shown]);
  const noticedCount = pending.length + pendingRejected.filter((r) => r.state === 'pending').length;

  useEffect(() => {
    if (consolidation === 'running') setTypedCount(0);
  }, [consolidation]);

  useEffect(() => {
    if (freshIds.length > 0 && typedCount >= freshIds.length) markSeen();
  }, [freshIds.length, typedCount, markSeen]);

  // Pulses (a chip line, or a pending line that just firmed up) fade on their own.
  const hasPulse = shown.some((l) => l.pulse);
  useEffect(() => {
    if (!hasPulse || freshIds.length > 0) return;
    const t = setTimeout(markSeen, 2600);
    return () => clearTimeout(t);
  }, [hasPulse, freshIds.length, markSeen]);

  if (!hydrated) return null;

  const headline =
    consolidation === 'done' && lastRun
      ? lastRun.nothingNew
        ? 'Nothing new to note'
        : [
            `${lastRun.writtenIds.length} written`,
            lastRun.rejectedCount > 0 ? `${lastRun.rejectedCount} not kept` : null,
            lastRun.keptOut > 0 ? `${lastRun.keptOut} deleted, kept out` : null,
          ]
            .filter(Boolean)
            .join(' · ')
      : `${noticedCount} noticed · ${writtenCount} written`;

  return (
    <aside className={`${styles.drawer} ${drawerOpen ? styles.open : ''}`} aria-label="Her Diary" aria-hidden={!drawerOpen}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Her Diary</h2>
          <p className={styles.sub}>
            She notices things as you talk, then writes the page when the conversation ends. Edit, delete or pin any line. Yours she
            never touches.
          </p>
        </div>
        <button type="button" className={styles.close} onClick={toggleDrawer} aria-label="Close diary">
          ×
        </button>
      </div>

      <div className={styles.status} aria-live="polite">
        {consolidation === 'running' ? (
          <>
            <span className={styles.pulseDot} /> Writing the page from your own words...
          </>
        ) : (
          <b>{headline}</b>
        )}
      </div>

      <div className={styles.page}>
        {(pending.length > 0 || pendingRejected.length > 0) && (
          <section className={styles.pendingBlock} aria-label="Noticing">
            <header className={styles.groupHead}>
              <span>noticing</span>
              <span className={styles.groupNote}>free, not in her prompt yet</span>
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
          <p className={styles.emptyPage}>Nothing yet. Say something and she starts noticing. End the conversation and she writes the page.</p>
        )}

        {shown.length > 0 && (pending.length > 0 || pendingRejected.length > 0) && (
          <header className={styles.groupHead}>
            <span>her page</span>
            <span className={styles.groupNote}>rides every turn</span>
          </header>
        )}

        {shown.map((line) => {
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
        {folded.length > 0 && (
          <button type="button" className={styles.fold} onClick={() => setShowFolded((s) => !s)}>
            {showFolded ? 'hide' : 'show'} {folded.length} older {folded.length === 1 ? 'line' : 'lines'}
          </button>
        )}
        {showFolded && folded.map((line) => <Line key={line.id} line={line} state="static" dayOffset={dayOffset} folded />)}
      </div>

      {deleted.length > 0 && (
        <details className={styles.deleted}>
          <summary>Deleted (won&apos;t return) · {deleted.length}</summary>
          <p className={styles.deletedNote}>Shown for the demo. In the product these are gone; she only gets them as a do-not-write list.</p>
          {deleted.map((l) => (
            <div key={l.id} className={styles.deletedLine}>
              <s>{l.text}</s>
              <span className={styles.muted}>deleted {l.deletedAt} · won&apos;t come back</span>
            </div>
          ))}
        </details>
      )}

      <p className={styles.foot}>
        Every line of hers points at one of your messages. Taste stays until you change it; story and dated lines expire. The page is capped
        at 12 lines and rides every turn, so it never grows.
      </p>
    </aside>
  );
}

function PendingLine({ line }: { line: DiaryLine }) {
  return (
    <article className={`${styles.line} ${styles.pendingLine}`}>
      <header className={styles.lineHead}>
        <span className={`tag ${styles.noticing}`}>noticing…</span>
        <span className={`tag ${line.kind}`}>{line.kind === 'scene' ? 'story' : line.kind}</span>
      </header>
      <p className={styles.text}>{line.text}</p>
    </article>
  );
}

function RejectedLine({ r }: { r: Rejected }) {
  const rejecting = r.state === 'rejecting';
  return (
    <article className={`${styles.line} ${styles.pendingLine} ${rejecting ? styles.rejecting : ''}`} title={r.note}>
      <header className={styles.lineHead}>
        <span className={`tag ${styles.noticing}`}>{rejecting ? 'not kept' : 'noticing…'}</span>
        <span className={`tag ${styles.sensitive}`}>{rejecting ? REASON[r.reason] : 'sensitive?'}</span>
      </header>
      <p className={styles.text}>
        <span className={rejecting ? styles.struck : ''}>&ldquo;{r.fragment}&rdquo;</span>
        {rejecting && <span className={styles.reason}> · not kept: {REASON[r.reason]}. {r.note}</span>}
      </p>
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
  const { editLine, deleteLine, togglePin } = useDemo();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(line.text);
  const expired = isExpired(line.expiresAt, dayOffset);

  if (state === 'pending') return null;

  const save = () => {
    editLine(line.id, draft);
    setEditing(false);
  };

  return (
    <article
      className={`${styles.line} ${line.pinned ? styles.pinned : ''} ${expired ? styles.expired : ''} ${folded ? styles.foldedLine : ''} ${
        line.pulse ? styles.pulse : ''
      }`}
    >
      <header className={styles.lineHead}>
        <span className={styles.date}>{line.date}</span>
        <span className={`tag ${line.author === 'her' ? 'hers' : 'yours'}`}>{line.author === 'her' ? 'hers' : 'yours'}</span>
        <span className={`tag ${line.kind}`}>{line.kind === 'scene' ? 'story' : line.kind}</span>
        {line.expiresAt && <span className={styles.expiry}>{expired ? 'expired' : `expires ${shortIso(line.expiresAt)}`}</span>}
        {line.pinned && <span className={styles.pinMark}>pinned</span>}
      </header>
      {editing ? (
        <div className={styles.editBox}>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} aria-label="Edit line" autoFocus />
          <div className={styles.editActions}>
            <button type="button" onClick={save} className={styles.save}>
              Save as yours
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(line.text);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className={styles.text}>
          {state === 'typing' ? <Typewriter text={line.text} msPerChar={25} startDelay={250} onDone={onTyped} /> : line.text}
        </p>
      )}
      {state === 'static' && !editing && (
        <div className={styles.actions}>
          <button type="button" onClick={() => setEditing(true)} title="Edit: it becomes yours and she never rewrites it">
            edit
          </button>
          <button type="button" onClick={() => togglePin(line.id)} title="Pinned lines stay at the top and never fold">
            {line.pinned ? 'unpin' : 'pin'}
          </button>
          <button type="button" onClick={() => deleteLine(line.id)} className={styles.danger} title="Gone for good: she is told never to write it again">
            delete
          </button>
        </div>
      )}
    </article>
  );
}
