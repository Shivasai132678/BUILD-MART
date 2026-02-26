'use client';

export function Toaster() {
  return (
    <div
      id="toast-root"
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 top-3 z-50 mx-auto w-full max-w-md px-3"
    />
  );
}

