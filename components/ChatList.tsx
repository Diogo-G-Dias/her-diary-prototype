'use client';

/* eslint-disable @next/next/no-img-element */
// Chat list rows in Candy's row markup, with our portraits. Only Aria's row is live.
import { CHARACTER } from '@/lib/fakeModel';
import { useDemo } from '@/lib/DemoContext';

const OTHERS = [
  { name: 'Nova', preview: 'Same time tomorrow?', time: '4:21PM', src: '/avatars/nova.jpg' },
  { name: 'Elena', preview: 'I kept the table by the window.', time: '2:00PM', src: '/avatars/elena.jpg' },
  { name: 'Mia', preview: 'You never told me how it ended.', time: 'Saturday', src: '/avatars/mia.jpg' },
  { name: 'June', preview: 'Rain again. Thinking of you.', time: 'Friday', src: '/avatars/june.jpg' },
];

export default function ChatList() {
  const { thread } = useDemo();
  const last = [...thread].reverse().find((m) => m.role === 'assistant');
  return (
    <div>
      <Row name={CHARACTER.name} preview={last ? last.text : 'Start a conversation'} time="now" src={CHARACTER.avatar} active />
      {OTHERS.map((c) => (
        <Row key={c.name} {...c} />
      ))}
    </div>
  );
}

function Row({ name, preview, time, src, active }: { name: string; preview: string; time: string; src: string; active?: boolean }) {
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      className={`group w-full my-2 conversation-item rounded-[10px] justify-start items-start gap-4 inline-flex conversation-open p-1 ${
        active ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'
      }`}
    >
      <div className="w-full relative h-[59px] rounded-[10px] justify-start items-center gap-1 inline-flex px-2">
        <div className="w-1/5 h-10 justify-start items-center flex shrink">
          <img className="object-cover object-top rounded-full h-12 w-12" src={src} alt="" />
        </div>
        <div className="flex-col w-3/5 justify-start items-start gap-0.5 inline-flex">
          <div className="justify-start w-[100%] items-center inline-flex gap-1">
            <div className="text-white text-sm font-medium leading-normal truncate">{name}</div>
          </div>
          <div className="w-full opacity-75 text-white text-xs break-words truncate font-normal">{preview}</div>
        </div>
        <div className="flex-col w-1/5 justify-between flex h-full py-2">
          <div className="opacity-75 text-white text-xs font-light flex justify-end">{time}</div>
        </div>
      </div>
    </a>
  );
}
