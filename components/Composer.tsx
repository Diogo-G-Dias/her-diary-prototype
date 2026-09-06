'use client';

import { useState } from 'react';
import { useDemo } from '@/lib/DemoContext';
import { CHIPS } from '@/lib/types';
import styles from './Composer.module.css';

export default function Composer() {
  const { sendMessage, assistantTyping, chipsVisible, pickChip, dismissChips } = useDemo();
  const [text, setText] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || assistantTyping) return;
    void sendMessage(text);
    setText('');
  };

  return (
    <div className="composer-wrap">
      {chipsVisible && (
        <div className={styles.chips} role="group" aria-label="Why regenerate?">
          <span className={styles.chipsLabel}>Not quite? Tell her why:</span>
          {CHIPS.map((c) => (
            <button key={c} type="button" className={styles.chip} onClick={() => void pickChip(c)}>
              {c}
            </button>
          ))}
          <button type="button" className={styles.dismiss} onClick={dismissChips} aria-label="Dismiss">
            skip
          </button>
        </div>
      )}
      <form className="composer" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          aria-label="Message"
          autoComplete="off"
        />
        <button className="send" type="submit" disabled={!text.trim() || assistantTyping} aria-label="Send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}
