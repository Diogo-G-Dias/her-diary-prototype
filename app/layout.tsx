import type { Metadata } from 'next';
import '../shell/candy-purged.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Her Diary: prototype',
  description:
    'A fully scripted demo of Her Diary, a memory feature for a companion app. No model, no keys, no personal data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Roboto:wght@300;400;500;700&family=Cormorant+Garamond:ital,wght@1,500;1,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-main-v2 conversations show">{children}</body>
    </html>
  );
}
