'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors
      closeButton
      theme="dark"
      toastOptions={{
        style: {
          fontFamily: "'Inter var', 'Inter', system-ui, sans-serif",
          borderRadius: '12px',
          background: '#1A1714',
          border: '1px solid #2A251F',
          color: '#F5F0E8',
        },
      }}
    />
  );
}
