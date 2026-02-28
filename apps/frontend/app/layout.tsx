import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/Toaster';
import { AppProviders } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'BuildMart — Construction Materials Procurement',
  description:
    'The smarter way to source construction materials. Create RFQs, compare vendor quotes, and track orders in real-time.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
        <Toaster />
      </body>
    </html>
  );
}
