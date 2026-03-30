import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/lib/providers';
import { Header } from '@/components/layout/Header';

export const metadata: Metadata = {
  title: 'PreOp Intel — Perioperative Risk Intelligence',
  description: 'Multi-agent AI system for pre-operative surgical risk assessment',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Providers>
          <Header />
          <main className="min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
