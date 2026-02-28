'use client';

import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
  ShoppingCart, Store, Shield, CheckCircle2, ArrowRight,
  FileText, ArrowLeftRight,
} from 'lucide-react';

/* ── Animation Variants ── */
const pageVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } },
};
const slideRight = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } },
};

/* ── Count-Up Hook ── */
function useCountUp(target: number, duration = 1.5) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, { once: true });

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target, duration]);

  return { ref, display };
}

/* ── Stat Component ── */
function AnimatedStat({ value, suffix = '', label }: { value: number; suffix?: string; label: string }) {
  const { ref, display } = useCountUp(value);
  return (
    <div className="text-center">
      <p className="text-3xl font-bold text-text-primary">
        <span ref={ref}>{display.toLocaleString('en-IN')}</span>{suffix}
      </p>
      <p className="mt-1 text-sm text-text-tertiary">{label}</p>
    </div>
  );
}

/* ── Role Cards Data ── */
const roles = [
  {
    icon: ShoppingCart, title: 'Buyer', headline: 'I need materials',
    description: 'Create RFQs, compare vendor quotes, and track your orders in real-time.',
    cta: 'Start sourcing →', borderColor: 'border-t-orange/60',
    iconBg: 'bg-orange/10 text-orange',
  },
  {
    icon: Store, title: 'Vendor', headline: 'I supply materials',
    description: 'Browse RFQs matching your catalog, submit competitive quotes, grow your business.',
    cta: 'Start selling →', borderColor: 'border-t-purple/60',
    iconBg: 'bg-purple/10 text-purple',
  },
  {
    icon: Shield, title: 'Admin', headline: 'Platform Admin',
    description: 'Manage vendors, monitor platform metrics, maintain quality standards.',
    cta: 'Manage platform →', borderColor: 'border-t-border-strong',
    iconBg: 'bg-elevated text-text-secondary',
  },
] as const;

const steps = [
  { num: '01', icon: FileText, title: 'Post an RFQ', desc: 'List what you need with quantities, delivery location, and deadline.' },
  { num: '02', icon: ArrowLeftRight, title: 'Get Competing Quotes', desc: 'Local verified vendors send you their best prices within 24 hours.' },
  { num: '03', icon: CheckCircle2, title: 'Confirm & Track', desc: 'Accept the best quote, pay online, and track delivery in real-time.' },
];

/* ══════════════════════════════════════════════════ */

export default function HomePage() {
  return (
    <motion.div
      className="min-h-screen bg-base relative overflow-hidden"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Atmospheric Layers ── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        {/* Blue blob — top right */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px]"
          style={{ background: 'radial-gradient(circle at 80% 10%, rgba(59,130,246,0.12) 0%, transparent 60%)' }}
        />
        {/* Purple blob — bottom left */}
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px]"
          style={{ background: 'radial-gradient(circle at 10% 90%, rgba(167,139,250,0.08) 0%, transparent 50%)' }}
        />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-50" />
      </div>

      {/* ═══ HERO ═══ */}
      <section className="relative z-10 min-h-screen flex items-center">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — Copy */}
            <div className="max-w-2xl">
              <motion.div variants={fadeUp}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-elevated text-sm text-text-secondary mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-glow" />
                  Now serving Hyderabad
                </div>
              </motion.div>

              <motion.h1
                className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05]"
                variants={fadeUp}
              >
                <span className="gradient-text">Source materials.</span>
                <br />
                <span className="gradient-text-blue">Close deals faster.</span>
              </motion.h1>

              <motion.p
                className="text-lg text-text-secondary max-w-md leading-relaxed mt-5"
                variants={fadeUp}
              >
                BuildMart connects construction buyers with verified local vendors.
                Post an RFQ, get competing quotes, confirm orders — all in one place.
              </motion.p>

              <motion.div className="mt-8 flex flex-wrap gap-3" variants={fadeUp}>
                <Link href="/login">
                  <button className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-full px-6 py-3 text-sm font-semibold btn-glow transition-all group">
                    Get Started
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </Link>
                <a href="#roles">
                  <button className="glass inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-text-primary border border-border hover:border-border-strong transition-all">
                    Learn More
                  </button>
                </a>
              </motion.div>

              <motion.div className="mt-8 flex flex-wrap gap-5" variants={fadeUp}>
                {['Verified Vendors', 'Instant Quotes', 'Real-time Orders'].map((pill) => (
                  <div key={pill} className="flex items-center gap-1.5 text-sm text-text-secondary">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    {pill}
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right — Floating Glass Cards */}
            <div className="relative hidden lg:flex items-center justify-center">
              <div className="relative w-80 h-80">
                {[
                  { top: '0px', left: '16px', delay: 0.4, anim: 'animate-float', dot: 'bg-accent', title: 'RFQ Sent', sub: '2 minutes ago' },
                  { top: '100px', left: '48px', delay: 0.55, anim: 'animate-float-delayed', dot: 'bg-warning', title: '3 Quotes Received', sub: 'Best price: ₹45,000' },
                  { top: '200px', left: '24px', delay: 0.7, anim: 'animate-float-slow', dot: 'bg-success', title: 'Order Confirmed', sub: 'Delivery in 3 days' },
                ].map((card) => (
                  <motion.div
                    key={card.title}
                    className={`absolute w-72 glass rounded-2xl p-4 shadow-inner-glow shadow-glow-sm ${card.anim}`}
                    style={{ top: card.top, left: card.left }}
                    variants={slideRight}
                    custom={card.delay}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full ${card.dot}/20 flex items-center justify-center`}>
                        <div className={`h-3 w-3 rounded-full ${card.dot}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{card.title}</p>
                        <p className="text-xs text-text-tertiary">{card.sub}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="relative z-10 border-y border-border-subtle bg-elevated/50 backdrop-blur-sm py-8">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <AnimatedStat value={500} suffix="+" label="Verified Vendors" />
            <AnimatedStat value={10000} suffix="+" label="Products Listed" />
            <AnimatedStat value={200} suffix="+" label="Orders Processed" />
            <AnimatedStat value={24} suffix="hr" label="Average Quote Time" />
          </div>
        </div>
      </section>

      {/* ═══ ROLE CARDS ═══ */}
      <section id="roles" className="relative z-10 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            className="text-center mb-14"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          >
            <motion.p variants={fadeUp} className="text-xs font-semibold tracking-widest text-accent/70 uppercase mb-2">
              Platform
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-4xl font-bold gradient-text">
              Built for every stakeholder
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-3 text-text-secondary max-w-md mx-auto">
              Whether you&apos;re buying materials, supplying them, or managing the platform — we&apos;ve got you covered.
            </motion.p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          >
            {roles.map((role) => (
              <motion.div key={role.title} variants={fadeUp}>
                <div className={`card border-t-2 ${role.borderColor} p-6 group`}>
                  <div className={`inline-flex rounded-xl p-3 ${role.iconBg}`}>
                    <role.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-text-primary">{role.headline}</h3>
                  <p className="mt-2 text-sm text-text-secondary leading-relaxed">{role.description}</p>
                  <Link
                    href="/login"
                    className="mt-5 inline-flex items-center text-sm font-medium text-accent hover:text-accent-hover transition-colors"
                  >
                    {role.cta}
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="relative z-10 py-24 border-t border-border-subtle">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            className="text-center mb-14"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          >
            <motion.p variants={fadeUp} className="text-xs font-semibold tracking-widest text-accent/70 uppercase mb-2">
              How it works
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-4xl font-bold gradient-text">
              Three steps to your first order
            </motion.h2>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 relative"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
          >
            {/* Connector line — desktop only */}
            <div className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-px border-t border-dashed border-border-strong" />

            {steps.map((step) => (
              <motion.div key={step.num} variants={fadeUp} className="text-center relative">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent text-sm font-bold mb-4 ring-4 ring-base">
                  {step.num}
                </div>
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-elevated text-text-secondary mb-3">
                  <step.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-text-primary">{step.title}</h3>
                <p className="mt-1 text-sm text-text-secondary max-w-xs mx-auto">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative z-10 border-t border-border-subtle bg-surface py-8">
        <div className="mx-auto max-w-7xl px-6 flex flex-wrap items-center justify-between gap-4">
          <div className="text-lg font-bold">
            <span className="text-text-primary">Build</span>
            <span className="text-accent">Mart</span>
          </div>
          <p className="text-sm text-text-tertiary">
            © 2025 BuildMart. All rights reserved.
          </p>
        </div>
      </footer>
    </motion.div>
  );
}
