'use client';

// Candy's composer markup with our input behind it. Sending is never blocked: the bubble renders now
// and her reply queues behind whatever she is doing.
import { useState } from 'react';
import { useDemo } from '@/lib/DemoContext';
import { CHIPS } from '@/lib/types';
import styles from './Composer.module.css';

export default function Composer() {
  const { sendMessage, chipsVisible, pickChip, dismissChips } = useDemo();
  const [text, setText] = useState('');

  const submit = () => {
    if (!text.trim()) return;
    sendMessage(text);
    setText('');
  };

  return (
    <div className="w-full">
      {chipsVisible && (
        <div className={styles.chips} role="group" aria-label="Why regenerate?">
          <span className={styles.chipsLabel}>Not quite? Tell her why:</span>
          {CHIPS.map((c) => (
            <button key={c} type="button" className={styles.chip} onClick={() => pickChip(c)}>
              {c}
            </button>
          ))}
          <button type="button" className={styles.dismiss} onClick={dismissChips} aria-label="Dismiss">
            skip
          </button>
        </div>
      )}
      <form
        className="new_message"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="border-t border-white/[0.14] backdrop-blur-[12.5px] bg-gradient-to-b from-[#262626e6] to-[#2e2e2ee6] rounded-[26px] shadow-[0px_4px_24px_0px_rgba(0,0,0,0.15)] py-3 md:py-4 px-3 md:px-4">
          <div className="flex items-center gap-3">
            <textarea
              aria-label="Chat message"
              autoComplete="off"
              className="flex-1 min-h-[21px] md:max-h-[100px] max-h-[84px] !overflow-y-auto scrollbar bg-transparent border-none outline-none text-[15px] md:text-base text-[#e1e1e1] placeholder-[#616162] font-roboto font-normal leading-[18px] focus:outline-none focus:ring-0 resize-none py-0"
              maxLength={3000}
              placeholder="Write a message..."
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <div className="shrink-0">
              <button
                type="submit"
                disabled={!text.trim()}
                aria-label="Send"
                className="shrink-0 w-10 h-10 md:w-10 md:h-10 rounded-full bg-gradient-to-r from-[#4346e6] to-[#6143e6] border border-white/[0.18] flex items-center justify-center disabled:opacity-30 transition-all duration-300 ease-out hover:from-[#3a3dd9] hover:to-[#5239d9] relative"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-white" aria-hidden>
                  <path d="M3.4 20.4l17.4-7.5c.8-.4.8-1.5 0-1.8L3.4 3.6c-.7-.3-1.4.3-1.3 1l1.2 5.6c.1.4.4.6.8.7l8.4 1.1-8.4 1.1c-.4.1-.7.3-.8.7l-1.2 5.6c-.1.7.6 1.3 1.3 1z" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-5 mt-3 px-1 text-white/45" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="8" width="18" height="13" rx="2" />
              <path d="M12 8v13M3 12h18M12 8c-2-3-5-3-5-1s3 1 5 1zm0 0c2-3 5-3 5-1s-3 1-5 1z" />
            </svg>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="8" cy="17" r="2" />
            </svg>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3v7M8 6l4-3 4 3M5 21h14l-2-8H7z" />
            </svg>
          </div>
        </div>
      </form>
    </div>
  );
}
