'use client';

import { DemoProvider, useDemo } from '@/lib/DemoContext';
import CandyShell from '@/components/CandyShell';
import Thread from '@/components/Thread';
import Composer from '@/components/Composer';
import ChatList from '@/components/ChatList';
import DiaryDrawer from '@/components/DiaryDrawer';
import ReturnPanels from '@/components/ReturnPanels';
import CostFooter from '@/components/CostFooter';
import DemoControls from '@/components/DemoControls';

export default function Page() {
  return (
    <DemoProvider>
      <App />
    </DemoProvider>
  );
}

function App() {
  const { mode, toast } = useDemo();
  return (
    <>
      <CandyShell
        slots={{
          thread: mode === 'return' ? <ReturnPanels /> : <Thread />,
          composer: mode === 'return' ? null : <Composer />,
          chatlist: <ChatList />,
          drawer: <DiaryDrawer variant="panel" />,
          controls: <DemoControls />,
          cost: <CostFooter />,
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
