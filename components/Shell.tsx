'use client';

import { CHARACTER } from '@/lib/fakeModel';
import { useDemo } from '@/lib/DemoContext';

const OTHERS = [
  { name: 'Nova', preview: 'Same time tomorrow?', hue: 'hue-2' },
  { name: 'Elena', preview: 'I kept the table by the window.', hue: 'hue-3' },
  { name: 'Mia', preview: 'You never told me how it ended.', hue: 'hue-4' },
  { name: 'June', preview: 'Rain again. Thinking of you.', hue: '' },
];

export function Sidebar() {
  const { thread } = useDemo();
  const last = [...thread].reverse().find((m) => m.role === 'assistant');
  return (
    <aside className="sidebar" aria-label="Characters">
      <div className="wordmark">
        <span className="dot" />
        <span>candy</span>
      </div>
      <div className="search">Search</div>
      <nav className="charlist">
        <button className="charrow active" type="button">
          <span className="avatar" />
          <span>
            <span className="name">{CHARACTER.name}</span>
            <br />
            <span className="preview">{last ? last.text : 'Start a conversation'}</span>
          </span>
        </button>
        {OTHERS.map((c) => (
          <button className="charrow" type="button" key={c.name} disabled aria-disabled>
            <span className={`avatar ${c.hue}`} />
            <span>
              <span className="name">{c.name}</span>
              <br />
              <span className="preview">{c.preview}</span>
            </span>
          </button>
        ))}
      </nav>
      <p
        className="sidebar-note"
        title="This screen is a static lookalike of the conversation page, built for the demo. No Candy assets, scripts or data. Everything the character does is scripted; see the README."
      >
        About this demo <span aria-hidden>?</span>
      </p>
    </aside>
  );
}

export function Header() {
  const { toggleDrawer, drawerOpen, diary } = useDemo();
  const live = diary.lines.filter((l) => !l.deletedAt && l.status === 'committed').length;
  return (
    <header className="header">
      <span className="avatar sm" />
      <div className="who">
        <span className="name">{CHARACTER.name}</span>
        <span className="status">online</span>
      </div>
      <span className="spacer" />
      <button
        type="button"
        onClick={toggleDrawer}
        className="icon-btn"
        aria-pressed={drawerOpen}
        aria-label="Toggle Her Diary"
        title="Her Diary"
        style={{ width: 'auto', padding: '0 12px', borderRadius: 999, gap: 8, color: drawerOpen ? 'var(--text)' : undefined }}
      >
        <BookIcon />
        <span style={{ fontSize: 13 }}>Her Diary{live ? ` · ${live}` : ''}</span>
      </button>
    </header>
  );
}

function BookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    </svg>
  );
}
