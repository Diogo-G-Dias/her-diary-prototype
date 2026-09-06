'use client';

import { useEffect, useRef } from 'react';
import { useDemo } from '@/lib/DemoContext';
import Typewriter from './Typewriter';

export default function Thread() {
  const { thread, assistantTyping, regenerate, chipsVisible, sessionKind, wasReset } = useDemo();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread, assistantTyping]);

  const last = thread[thread.length - 1];
  const lastAssistant = last && last.role === 'assistant' && !last.replaced ? last : null;

  return (
    <div className="thread" ref={ref}>
      <div className="thread-inner">
        {thread.length === 0 && !assistantTyping && (
          <p className="empty-chat">
            {sessionKind === 'return' && !wasReset ? 'Silence. She waits for you to speak first.' : 'Chat reset. Her diary is untouched. Say something.'}
          </p>
        )}
        {thread.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            {m.role === 'assistant' && <span className="avatar sm" aria-hidden />}
            <div className={`bubble ${m.replaced ? 'replaced' : ''}`}>
              {m.typed ? <Typewriter text={m.text} msPerChar={15} /> : m.text}
            </div>
          </div>
        ))}
        {assistantTyping && (
          <div className="msg assistant">
            <span className="avatar sm" aria-hidden />
            <div className="bubble typing" aria-label="typing">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
        {lastAssistant && !assistantTyping && !chipsVisible && (
          <div className="msg-tools">
            <button className="icon-btn" type="button" onClick={regenerate} title="Regenerate" aria-label="Regenerate reply">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
            </button>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Regenerate</span>
          </div>
        )}
      </div>
    </div>
  );
}
