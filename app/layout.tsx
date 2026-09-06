import type { Metadata } from 'next';
import '../shell/candy.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Her Diary: prototype',
  description:
    'A fully scripted demo of Her Diary, a memory feature for a companion app. No model, no keys, no personal data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
