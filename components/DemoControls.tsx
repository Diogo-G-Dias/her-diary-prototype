'use client';

import { useDemo } from '@/lib/DemoContext';
import { weekday } from '@/lib/demoClock';
import styles from './DemoControls.module.css';

export default function DemoControls() {
  const { endConversation, comeBack, resetChat, restartDemo, consolidation, dayOffset, today, thread, endedCount } = useDemo();
  const busy = consolidation === 'running';
  const canEnd = thread.some((m) => m.role === 'user') && !busy;

  return (
    <div className={styles.bar} aria-label="Demo controls">
      <span className={styles.label}>Demo</span>
      <span className={styles.day} title="Fictional calendar for the demo">
        {weekday(dayOffset)} {today}
        {dayOffset > 0 && <span className={styles.dayNote}> · {dayOffset} days later</span>}
      </span>
      <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={() => void endConversation()} disabled={!canEnd}>
        End conversation
        <small>{endedCount === 0 ? 'stands in for the inactivity trigger' : 'again: she writes only what is new'}</small>
      </button>
      <button type="button" className={styles.btn} onClick={() => void comeBack()} disabled={busy || dayOffset > 0}>
        Come back in 2 days
      </button>
      <button type="button" className={styles.btn} onClick={resetChat} disabled={busy}>
        Reset chat
      </button>
      <button type="button" className={styles.ghost} onClick={restartDemo} title="Clears the saved diary and reloads">
        Restart demo
      </button>
    </div>
  );
}
