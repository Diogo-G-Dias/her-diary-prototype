'use client';

// The static, scrubbed Candy conversation screen as the frame. Our React components portal into the
// slots the build script left: thread, composer, chatlist, drawer, controls, cost.
// The frame is written into the host element imperatively, once, so React never re-applies it and the
// slot elements the portals target stay the ones in the document.
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SHELL_HTML } from '@/lib/shellHtml';

type Slots = Record<string, HTMLElement>;

export default function CandyShell({ slots }: { slots: Record<string, React.ReactNode> }) {
  const host = useRef<HTMLDivElement>(null);
  const [targets, setTargets] = useState<Slots | null>(null);

  useLayoutEffect(() => {
    const root = host.current;
    if (!root) return;
    if (!root.firstElementChild) root.innerHTML = SHELL_HTML;
    const found: Slots = {};
    root.querySelectorAll<HTMLElement>('[data-slot]').forEach((el) => {
      found[el.dataset.slot as string] = el;
    });
    setTargets(found);
  }, []);

  return (
    <>
      <div ref={host} className="contents" />
      {targets &&
        Object.entries(slots).map(([name, node]) =>
          targets[name] && targets[name].isConnected ? createPortal(node, targets[name], name) : null,
        )}
    </>
  );
}
