'use client';

// Message list in Candy's own markup, mounted inside the shell's scroll area.
import { useEffect, useRef } from 'react';
import { useDemo } from '@/lib/DemoContext';
import { weekday } from '@/lib/demoClock';
import Typewriter from './Typewriter';

function stamp(index: number, dayOffset: number): string {
  const minutes = 21 * 60 + 12 + index * 2;
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const t = `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}${h >= 12 ? 'PM' : 'AM'}`;
  return dayOffset > 0 ? `${weekday(dayOffset)}, ${t}` : t;
}

export default function Thread() {
  const { thread, assistantTyping, regenerate, chipsVisible, sessionKind, wasReset, dayOffset } = useDemo();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = ref.current?.closest('.overflow-y-auto') as HTMLElement | null;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [thread, assistantTyping]);

  const last = thread[thread.length - 1];
  const lastAssistant = last && last.role === 'assistant' && !last.replaced ? last : null;

  return (
    <div ref={ref} className="relative px-3 md:px-2 pb-4 pt-3 w-full md:max-w-[774px] md:mx-auto">
      {thread.length === 0 && !assistantTyping && (
        <p className="text-center text-white/40 text-[13px] py-16">
          {sessionKind === 'return' && !wasReset ? 'Silence. She waits for you to speak first.' : 'Chat reset. Her diary is untouched. Say something.'}
        </p>
      )}
      {thread.map((m, i) =>
        m.role === 'assistant' ? (
          <div key={m.id} className="user-response relative mt-4 mb-1 overflow-visible">
            <div className="inline-flex flex-col items-start w-auto max-w-[75vw] md:max-w-[75%] relative overflow-visible">
              <div
                className={`px-4 py-2 bg-black-medium rounded-tl-3xl rounded-tr-3xl rounded-br-3xl rounded-bl-[4px] inline-flex flex-wrap items-end gap-x-2 select-none ${
                  m.replaced ? 'opacity-40 line-through' : ''
                }`}
              >
                <div className="font-roboto text-grey-medium text-[15px] font-normal">
                  <p>{m.typed ? <Typewriter text={m.text} msPerChar={15} /> : m.text}</p>
                </div>
                <span className="text-[11px] text-white/30 whitespace-nowrap ml-auto leading-[20px] shrink-0">{stamp(i, dayOffset)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div key={m.id} className="relative mt-4 mb-1 flex justify-end overflow-visible">
            <div className="inline-flex flex-col items-end w-auto max-w-[75vw] md:max-w-[75%] relative overflow-visible">
              <div className="px-4 py-2 bg-gradient-to-r from-[#4346e6] to-[#6143e6] rounded-tl-3xl rounded-tr-3xl rounded-bl-3xl rounded-br-[4px] inline-flex flex-wrap items-end gap-x-2 select-none">
                <div className="font-roboto text-white text-[15px] font-normal">
                  <p>{m.text}</p>
                </div>
                <span className="text-[11px] text-white/60 whitespace-nowrap ml-auto leading-[20px] shrink-0 inline-flex items-center gap-1">
                  {stamp(i, dayOffset)}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                    <path d="M2 12l5 5L17 7" />
                    <path d="M9 17l2 2L22 8" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        ),
      )}
      {assistantTyping && (
        <div className="user-response relative mt-4 mb-1 overflow-visible">
          <div className="inline-flex flex-col items-start w-auto relative">
            <div className="px-4 py-3 bg-black-medium rounded-tl-3xl rounded-tr-3xl rounded-br-3xl rounded-bl-[4px] inline-flex">
              <span className="typing" aria-label="typing">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        </div>
      )}
      {lastAssistant && !assistantTyping && !chipsVisible && (
        <button
          type="button"
          onClick={regenerate}
          className="mt-1 ml-1 inline-flex items-center gap-1.5 text-[12px] text-white/50 hover:text-white transition-colors"
          aria-label="Regenerate reply"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
          Regenerate
        </button>
      )}
    </div>
  );
}
