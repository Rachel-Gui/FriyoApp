import type { Metadata } from 'next';
import { AntdProvider }    from '@/providers/AntdProvider';
import { QueryProvider }   from '@/providers/QueryProvider';
import { SessionProvider } from '@/providers/SessionProvider';
import './globals.css';

export const metadata: Metadata = {
  title:       { template: '%s | Friyo Admin', default: 'Friyo Admin' },
  description: 'Friyo platform administration panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <QueryProvider>
            <AntdProvider>{children}</AntdProvider>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
