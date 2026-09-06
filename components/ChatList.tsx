'use client';

/* eslint-disable @next/next/no-img-element */
// The chat list holds one live conversation: Aria, in Candy's row markup.
import { CHARACTER } from '@/lib/fakeModel';
import { useDemo } from '@/lib/DemoContext';

export default function ChatList() {
  const { thread } = useDemo();
  const last = [...thread].reverse().find((m) => m.role === 'assistant');
  return (
    <div>
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        className="group w-full my-2 conversation-item rounded-[10px] inline-flex conversation-open p-1 bg-white/[0.08]"
      >
        <div className="w-full relative h-[59px] rounded-[10px] flex items-center gap-3 px-2">
          <img className="object-cover object-top rounded-full h-12 w-12 shrink-0" src={CHARACTER.avatar} alt="" />
          <div className="flex flex-col flex-1 min-w-0 justify-center gap-0.5">
            <div className="text-white text-sm font-medium leading-normal truncate">{CHARACTER.name}</div>
            <div className="w-full opacity-75 text-white text-xs truncate font-normal">{last ? last.text : 'Start a conversation'}</div>
          </div>
          <div className="opacity-75 text-white text-xs font-light shrink-0 self-start pt-2">now</div>
        </div>
      </a>
    </div>
  );
}
