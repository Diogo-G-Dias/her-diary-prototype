'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  text: string;
  msPerChar?: number;
  startDelay?: number;
  onDone?: () => void;
  className?: string;
};

// Types text out at a fixed pace. Used for her replies (15 ms/char) and diary lines (25 ms/char).
export default function Typewriter({ text, msPerChar = 20, startDelay = 0, onDone, className }: Props) {
  const [shown, setShown] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    setShown(0);
    done.current = false;
    let i = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
      timer = setInterval(() => {
        i += 1;
        setShown(i);
        if (i >= text.length) {
          if (timer) clearInterval(timer);
          if (!done.current) {
            done.current = true;
            onDone?.();
          }
        }
      }, msPerChar);
    }, startDelay);
    return () => {
      clearTimeout(start);
      if (timer) clearInterval(timer);
    };
    // onDone intentionally excluded: callers pass stable or inline callbacks, and restarting on
    // every render would stutter the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, msPerChar, startDelay]);

  const typing = shown < text.length;
  return (
    <span className={`${className ?? ''} ${typing ? 'caret' : ''}`.trim()} aria-label={text}>
      {text.slice(0, shown)}
    </span>
  );
}
