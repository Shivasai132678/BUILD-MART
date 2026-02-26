import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
