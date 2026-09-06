'use client';

import { DemoProvider, useDemo } from '@/lib/DemoContext';
import { Header, Sidebar } from '@/components/Shell';
import Thread from '@/components/Thread';
import Composer from '@/components/Composer';
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
    <div className="shell">
      <Sidebar />
      <main className="center">
        <Header />
        <DemoControls />
        {mode === 'return' ? (
          <ReturnPanels />
        ) : (
          <>
            <Thread />
            <Composer />
          </>
        )}
        <CostFooter />
        <DiaryDrawer />
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}
