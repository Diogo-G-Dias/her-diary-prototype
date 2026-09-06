'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDemo } from '@/lib/DemoContext';
import { deletedLines, pageOf } from '@/lib/diaryStore';
import { isExpired, shortIso } from '@/lib/demoClock';
import type { DiaryLine } from '@/lib/types';
import Typewriter from './Typewriter';
import styles from './DiaryDrawer.module.css';

export default function DiaryDrawer() {
  const { drawerOpen, toggleDrawer, diary, consolidation, lastRun, markSeen, dayOffset, hydrated } = useDemo();
  const { shown, folded } = useMemo(() => pageOf(diary), [diary]);
  const deleted = useMemo(() => deletedLines(diary), [diary]);
  const [showFolded, setShowFolded] = useState(false);
  const [typedCount, setTypedCount] = useState(0);
  const [showNote, setShowNote] = useState(false);

  const freshIds = useMemo(() => shown.filter((l) => l.fresh).map((l) => l.id), [shown]);

  useEffect(() => {
    if (consolidation === 'running') {
      setTypedCount(0);
      setShowNote(false);
    }
  }, [consolidation]);

  useEffect(() => {
    if (freshIds.length > 0 && typedCount >= freshIds.length) markSeen();
  }, [freshIds.length, typedCount, markSeen]);

  if (!hydrated) return null;

  return (
    <aside className={`${styles.drawer} ${drawerOpen ? styles.open : ''}`} aria-label="Her Diary" aria-hidden={!drawerOpen}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Her Diary</h2>
          <p className={styles.sub}>She writes a few lines after each conversation. Edit, delete or pin any of them. Yours she never touches.</p>
        </div>
        <button type="button" className={styles.close} onClick={toggleDrawer} aria-label="Close diary">
          ×
        </button>
      </div>

      {consolidation === 'running' && (
        <div className={styles.status}>
          <span className={styles.pulse} /> Writing today&apos;s page from your own words...
        </div>
      )}

      {consolidation === 'done' && lastRun && (
        <div className={styles.status}>
          <span>
            <b>{lastRun.writtenIds.length}</b> {lastRun.writtenIds.length === 1 ? 'line' : 'lines'} written
          </span>
          {lastRun.rejected.length > 0 && (
            <button type="button" className={styles.notWritten} onClick={() => setShowNote((s) => !s)} title={lastRun.rejected[0].note}>
              {lastRun.rejected.length} line not written
            </button>
          )}
          {lastRun.tombstonesHonoured > 0 && (
            <span className={styles.muted}>
              {lastRun.tombstonesHonoured} deleted {lastRun.tombstonesHonoured === 1 ? 'line' : 'lines'} kept out
            </span>
          )}
        </div>
      )}
      {showNote && lastRun?.rejected[0] && (
        <div className={styles.note}>
          <b>Health mention.</b> {lastRun.rejected[0].note} The filter drops anything about health, minors, or third parties, and
          anything not traceable to your own message.
        </div>
      )}

      <div className={styles.page}>
        {shown.length === 0 && consolidation !== 'running' && (
          <p className={styles.emptyPage}>
            Nothing yet. End the conversation and she writes the first page.
          </p>
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
          <summary>
            deleted ({deleted.length}) · shown for the demo; in the product these are gone
          </summary>
          {deleted.map((l) => (
            <div key={l.id} className={styles.deletedLine}>
              <s>{l.text}</s>
              <span className={styles.muted}>
                deleted {l.deletedAt} · passed to her as &quot;never write this again&quot;
              </span>
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
    <article className={`${styles.line} ${line.pinned ? styles.pinned : ''} ${expired ? styles.expired : ''} ${folded ? styles.foldedLine : ''}`}>
      <header className={styles.lineHead}>
        <span className={styles.date}>{line.date}</span>
        <span className={`tag ${line.author === 'her' ? 'hers' : 'yours'}`}>{line.author === 'her' ? 'hers' : 'yours'}</span>
        <span className={`tag ${line.kind}`}>{line.kind === 'scene' ? 'story' : line.kind}</span>
        {line.expiresAt && (
          <span className={styles.expiry}>{expired ? 'expired' : `expires ${shortIso(line.expiresAt)}`}</span>
        )}
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
