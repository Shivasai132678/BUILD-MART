import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-base relative overflow-hidden">
      {/* Atmospheric */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 right-0 w-[600px] h-[600px]"
          style={{ background: 'radial-gradient(circle at 80% 20%, rgba(59,130,246,0.12) 0%, transparent 60%)' }}
        />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px]"
          style={{ background: 'radial-gradient(circle at 20% 80%, rgba(167,139,250,0.08) 0%, transparent 50%)' }}
        />
        <div className="absolute inset-0 bg-grid-pattern opacity-40" />
      </div>

      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] relative z-10 flex-col items-center justify-center p-12 border-r border-border-subtle"
        style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, var(--color-base) 50%, rgba(167,139,250,0.05) 100%)' }}
      >
        <div className="max-w-sm text-center space-y-6">
          <h1 className="text-5xl font-bold tracking-tight">
            <span className="text-text-primary">Build</span>
            <span className="text-accent">Mart</span>
          </h1>
          <p className="text-text-secondary text-lg leading-relaxed">
            The smarter way to source construction materials for your next project.
          </p>
          <div className="space-y-3 pt-4">
            {['Verified vendor network', 'Instant competitive quotes', 'Real-time order tracking'].map((feature) => (
              <div key={feature} className="flex items-center gap-2.5 text-sm text-text-secondary">
                <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                {feature}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 relative z-10">
        <div className="w-full max-w-sm">
          <div className="card p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
