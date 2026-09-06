'use client';

import { DemoProvider, useDemo } from '@/lib/DemoContext';
import CandyShell from '@/components/CandyShell';
import Thread from '@/components/Thread';
import Composer from '@/components/Composer';
import ChatList from '@/components/ChatList';
import DiaryDrawer from '@/components/DiaryDrawer';
import DemoControls from '@/components/DemoControls';

export default function Page() {
  return (
    <DemoProvider>
      <App />
    </DemoProvider>
  );
}

function App() {
  const { toast } = useDemo();
  return (
    <>
      <CandyShell
        slots={{
          thread: <Thread />,
          composer: <Composer />,
          chatlist: <ChatList />,
          drawer: <DiaryDrawer variant="panel" />,
          controls: <DemoControls />,
        }}
      />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
