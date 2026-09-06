'use client';

import { useDemo } from '@/lib/DemoContext';
import { CHARACTER, GENERIC_OPENER } from '@/lib/fakeModel';
import Avatar from './Avatar';
import Typewriter from './Typewriter';
import styles from './ReturnPanels.module.css';

export default function ReturnPanels() {
  const { openerText, pickPanel } = useDemo();

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h2 className={styles.title}>You open the app two days later. What does she do?</h2>
        <p className={styles.sub}>Three arms on the return moment. Click one to continue from it.</p>
      </div>
      <div className={styles.grid}>
        <Panel label="1 · silence" note="Empty chat, composer only. Today." onPick={() => pickPanel('silence')}>
          <div className={styles.empty}>...</div>
        </Panel>
        <Panel label="2 · generic" note="A fixed line, same for everyone." onPick={() => pickPanel('generic')}>
          <Bubble>{GENERIC_OPENER}</Bubble>
        </Panel>
        <Panel label="3 · her diary" note="Pre-written from the last page. No push." highlight onPick={() => pickPanel('diary')}>
          {openerText ? (
            <Bubble>
              <Typewriter text={openerText} msPerChar={18} />
            </Bubble>
          ) : (
            <div className={`bubble typing ${styles.typingSmall}`} aria-label="writing">
              <i />
              <i />
              <i />
            </div>
          )}
        </Panel>
      </div>
      <p className={styles.caption}>
        Memory&apos;s effect is panel 3 minus panel 2. Read: messages per return session; opener replied to rather than ignored.
      </p>
    </div>
  );
}

function Panel({
  label,
  note,
  highlight,
  onPick,
  children,
}: {
  label: string;
  note: string;
  highlight?: boolean;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className={`${styles.panel} ${highlight ? styles.highlight : ''}`} onClick={onPick}>
      <span className={styles.panelLabel}>{label}</span>
      <div className={styles.panelBody}>{children}</div>
      <span className={styles.panelNote}>{note}</span>
      <span className={styles.cta}>Continue from here</span>
    </button>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="msg assistant" style={{ maxWidth: '100%' }}>
      <Avatar src={CHARACTER.avatar} small />
      <div className="bubble" style={{ textAlign: 'left' }}>
        {children}
      </div>
    </div>
  );
}
