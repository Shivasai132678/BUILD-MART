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
          background: '#0F1011',
          border: '1px solid rgba(255,255,255,0.10)',
          color: 'rgba(255,255,255,0.95)',
        },
      }}
    />
  );
}
