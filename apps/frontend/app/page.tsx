import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BuildMart — Construction Materials Procurement',
  description:
    'Construction materials procurement platform for Hyderabad contractors. Create RFQs, compare vendor quotes, and track orders.',
};

const roles = [
  {
    icon: '🏗️',
    title: 'I need materials',
    label: 'Buyer',
    description:
      'Create RFQs, compare vendor quotes, and track your orders',
    cta: 'Login as Buyer',
    gradient: 'from-blue-600 to-indigo-600',
    hoverGradient: 'hover:from-blue-500 hover:to-indigo-500',
    bgGlow: 'bg-blue-500/10',
    borderColor: 'border-blue-200',
    iconBg: 'bg-blue-100',
  },
  {
    icon: '🏪',
    title: 'I supply materials',
    label: 'Vendor',
    description:
      'Browse RFQs matching your catalog, submit quotes, grow your business',
    cta: 'Login as Vendor',
    gradient: 'from-emerald-600 to-teal-600',
    hoverGradient: 'hover:from-emerald-500 hover:to-teal-500',
    bgGlow: 'bg-emerald-500/10',
    borderColor: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
  },
  {
    icon: '⚙️',
    title: 'Platform Admin',
    label: 'Admin',
    description:
      'Manage vendors, monitor metrics, maintain platform quality',
    cta: 'Admin Login',
    gradient: 'from-slate-700 to-slate-900',
    hoverGradient: 'hover:from-slate-600 hover:to-slate-800',
    bgGlow: 'bg-slate-500/10',
    borderColor: 'border-slate-300',
    iconBg: 'bg-slate-200',
  },
] as const;

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* ━━━ HEADER ━━━ */}
      <header className="px-6 pb-2 pt-10 text-center sm:pt-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Now serving Hyderabad
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Build<span className="text-blue-600">Mart</span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Construction materials procurement for Hyderabad contractors.
            <br className="hidden sm:block" />
            Source smarter. Build faster.
          </p>
        </div>
      </header>

      {/* ━━━ ROLE CARDS ━━━ */}
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-16">
        <div className="grid w-full max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <div
              key={role.label}
              className={`group relative flex flex-col overflow-hidden rounded-2xl border ${role.borderColor} bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}
            >
              {/* Subtle glow */}
              <div
                className={`pointer-events-none absolute -top-20 right-0 h-40 w-40 rounded-full ${role.bgGlow} opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100`}
              />

              <div className="relative flex flex-1 flex-col p-6">
                <div
                  className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${role.iconBg} text-2xl`}
                >
                  {role.icon}
                </div>

                <span className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {role.label}
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  {role.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                  {role.description}
                </p>

                <Link
                  href="/login"
                  className={`mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r ${role.gradient} ${role.hoverGradient} px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200`}
                  id={`login-${role.label.toLowerCase()}`}
                >
                  {role.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ━━━ FOOTER ━━━ */}
      <footer className="py-6 text-center text-xs text-slate-400">
        BuildMart &bull; Hyderabad &bull; 2026
      </footer>
    </div>
  );
}
