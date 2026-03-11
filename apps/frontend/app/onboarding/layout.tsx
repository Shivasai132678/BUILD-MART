import type { ReactNode } from 'react';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-6">
      {children}
    </div>
  );
}
