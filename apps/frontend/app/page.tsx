'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
  ShoppingCart, Store, Shield, CheckCircle2, ArrowRight,
  FileText, ArrowLeftRight, Zap, TrendingUp, Clock, Star,
  Phone, Mail, MapPin, Facebook, Twitter, Linkedin, Menu, X,
} from 'lucide-react';
import { fadeUp, slideRight, pageVariants, viewportOnce, staggerContainer, staggerItem } from '@/lib/motion';

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

function AnimatedStat({ value, suffix = '', label }: { value: number; suffix?: string; label: string }) {
  const { ref, display } = useCountUp(value);
  return (
    <div className="text-center">
      <p className="text-3xl sm:text-4xl font-bold text-text-primary">
        <span ref={ref}>{display.toLocaleString('en-IN')}</span>{suffix}
      </p>
      <p className="mt-1 text-sm text-text-tertiary">{label}</p>
    </div>
  );
}

/* ── Category Data ── */
const categories = [
  { name: 'Cement', image: '/images/categories/cat-cement.png' },
  { name: 'Steel', image: '/images/categories/cat-steel.png' },
  { name: 'Bricks', image: '/images/categories/cat-bricks.png' },
  { name: 'Tiles', image: '/images/categories/cat-tiles.png' },
  { name: 'Plumbing', image: '/images/categories/cat-plumbing.png' },
  { name: 'Electrical', image: '/images/categories/cat-electrical.png' },
  { name: 'Wood', image: '/images/categories/cat-wood.png' },
  { name: 'Paints', image: '/images/categories/cat-paints.png' },
];

/* ── Role Cards ── */
const roles = [
  {
    icon: ShoppingCart, title: 'Buyer', headline: 'I need materials',
    description: 'Create RFQs, compare vendor quotes, and track your orders in real-time.',
    cta: 'Start sourcing →', borderColor: 'border-t-cta',
    iconBg: 'bg-cta/10 text-cta',
  },
  {
    icon: Store, title: 'Vendor', headline: 'I supply materials',
    description: 'Browse RFQs matching your catalog, submit competitive quotes, grow your business.',
    cta: 'Start selling →', borderColor: 'border-t-purple',
    iconBg: 'bg-purple/10 text-purple',
  },
  {
    icon: Shield, title: 'Admin', headline: 'Platform Admin',
    description: 'Manage vendors, monitor platform metrics, maintain quality standards.',
    cta: 'Manage platform →', borderColor: 'border-t-border-strong',
    iconBg: 'bg-elevated text-text-secondary',
  },
] as const;

/* ── Steps ── */
const steps = [
  { num: '01', icon: FileText, title: 'Post an RFQ', desc: 'List what you need with quantities, delivery location, and deadline.' },
  { num: '02', icon: ArrowLeftRight, title: 'Get Competing Quotes', desc: 'Local verified vendors send you their best prices within 24 hours.' },
  { num: '03', icon: CheckCircle2, title: 'Confirm & Track', desc: 'Accept the best quote, pay online, and track delivery in real-time.' },
];

/* ── Why BuildMart ── */
const features = [
  { icon: Shield, title: 'Verified Vendors', desc: 'Every supplier is vetted for quality, reliability, and compliance before they can quote on your RFQs.' },
  { icon: Zap, title: 'Instant Quotes', desc: 'Receive competitive quotes from multiple vendors within 24 hours of posting your requirement.' },
  { icon: TrendingUp, title: 'Better Prices', desc: 'Competition among vendors drives prices down — save up to 20% compared to single-vendor sourcing.' },
  { icon: Clock, title: 'Real-time Tracking', desc: 'Track every order from confirmation through delivery with live status updates and notifications.' },
];

/* ── Testimonials ── */
const testimonials = [
  {
    name: 'Rajesh Kumar',
    role: 'Site Engineer, Hyderabad',
    avatar: '/images/testimonials/testimonial-buyer-1.png',
    quote: 'BuildMart saved us over ₹2 lakhs on our last project. Getting quotes from 5 vendors in one place was a game-changer.',
    rating: 5,
  },
  {
    name: 'Priya Sharma',
    role: 'Hardware Supplier',
    avatar: '/images/testimonials/testimonial-vendor-1.png',
    quote: 'Since joining BuildMart, my business has grown 40%. The platform brings quality buyers directly to me — no middlemen.',
    rating: 5,
  },
];

/* ══════════════════════════════════════════════════ */

export default function HomePage() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.div
      className="min-h-screen bg-base relative overflow-hidden"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ═══ FLOATING NAVBAR ═══ */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navScrolled ? 'bg-surface/90 backdrop-blur-xl border-b border-border-subtle shadow-lg' : 'bg-transparent'
        }`}>
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            <span className="text-text-primary">Build</span>
            <span className="text-accent">Mart</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {[
              { href: '#categories', label: 'Categories' },
              { href: '#how-it-works', label: 'How It Works' },
              { href: '#why', label: 'Why BuildMart' },
            ].map((link) => (
              <a key={link.href} href={link.href} className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden md:inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-full px-5 py-2.5 text-sm font-semibold btn-glow transition-all">
                Get Started
                <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              className="md:hidden p-2 text-text-secondary hover:text-text-primary transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {/* Mobile nav */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-surface/95 backdrop-blur-xl border-b border-border-subtle px-6 pb-4 space-y-2">
            {[
              { href: '#categories', label: 'Categories' },
              { href: '#how-it-works', label: 'How It Works' },
              { href: '#why', label: 'Why BuildMart' },
            ].map((link) => (
              <a key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
                {link.label}
              </a>
            ))}
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-full px-5 py-2.5 text-sm font-semibold btn-glow transition-all">
                Get Started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </header>

      {/* ═══ HERO ═══ */}
      <section className="relative z-10 min-h-screen flex items-center">
        {/* Hero background image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/home/hero-construction-site.png"
            alt="Construction site"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-base via-base/95 to-base/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-base via-transparent to-base/40" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-24">
          <div className="max-w-2xl">
            <motion.div variants={fadeUp}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-elevated/80 backdrop-blur-sm text-sm text-text-secondary mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-glow" />
                Now serving Hyderabad
              </div>
            </motion.div>

            <motion.h1
              className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.05]"
              variants={fadeUp}
            >
              <span className="gradient-text">Source materials.</span>
              <br />
              <span className="gradient-text-blue">Close deals faster.</span>
            </motion.h1>

            <motion.p
              className="text-base sm:text-lg text-text-secondary max-w-md leading-relaxed mt-5"
              variants={fadeUp}
            >
              BuildMart connects construction buyers with verified local vendors.
              Post an RFQ, get competing quotes, confirm orders — all in one place.
            </motion.p>

            <motion.div className="mt-8 flex flex-wrap gap-3" variants={fadeUp}>
              <Link href="/login" className="inline-flex items-center gap-2 bg-cta hover:bg-cta-hover text-white rounded-full px-6 py-3 text-sm font-semibold btn-glow-cta transition-all group">
                  Get Started Free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a href="#how-it-works" className="glass inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-text-primary hover:bg-white/10 transition-all">
                  See How It Works
              </a>
            </motion.div>

            <motion.div className="mt-8 flex flex-wrap gap-5" variants={fadeUp}>
              {['Verified Vendors', 'Instant Quotes', 'Real-time Tracking'].map((pill) => (
                <div key={pill} className="flex items-center gap-1.5 text-sm text-text-secondary">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  {pill}
                </div>
              ))}
            </motion.div>
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

      {/* ═══ CATEGORY SHOWCASE ═══ */}
      <section id="categories" className="relative z-10 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            className="text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
          >
            <motion.p variants={fadeUp} className="text-xs font-semibold tracking-widest text-accent/70 uppercase mb-2">
              Browse
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold gradient-text">
              Popular Categories
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-3 text-text-secondary max-w-md mx-auto">
              Find everything from cement and steel to electrical fittings and paints.
            </motion.p>
          </motion.div>

          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
          >
            {categories.map((cat) => (
              <motion.div key={cat.name} variants={staggerItem}>
                <Link href="/login" className="group relative block overflow-hidden rounded-2xl border border-border-subtle hover:border-border-strong transition-all duration-300">
                  <div className="relative aspect-square bg-elevated">
                    <Image
                      src={cat.image}
                      alt={cat.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-base/90 via-base/30 to-transparent" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 px-4 py-3">
                    <p className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                      {cat.name}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ ROLE CARDS ═══ */}
      <section id="roles" className="relative z-10 py-16 md:py-24 border-t border-border-subtle">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            className="text-center mb-14"
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
          >
            <motion.p variants={fadeUp} className="text-xs font-semibold tracking-widest text-accent/70 uppercase mb-2">
              Platform
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold gradient-text">
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
            viewport={viewportOnce}
            variants={staggerContainer}
          >
            {roles.map((role) => (
              <motion.div key={role.title} variants={staggerItem}>
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
      <section id="how-it-works" className="relative z-10 py-16 md:py-24 border-t border-border-subtle">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            className="text-center mb-14"
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
          >
            <motion.p variants={fadeUp} className="text-xs font-semibold tracking-widest text-accent/70 uppercase mb-2">
              How it works
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold gradient-text">
              Three steps to your first order
            </motion.h2>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 relative"
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
          >
            <div className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-px border-t border-dashed border-border-strong" />
            {steps.map((step) => (
              <motion.div key={step.num} variants={staggerItem} className="text-center relative">
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

      {/* ═══ WHY BUILDMART ═══ */}
      <section id="why" className="relative z-10 py-16 md:py-24 border-t border-border-subtle">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            className="text-center mb-14"
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
          >
            <motion.p variants={fadeUp} className="text-xs font-semibold tracking-widest text-cta/70 uppercase mb-2">
              Why BuildMart
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold gradient-text">
              Built for the construction industry
            </motion.h2>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-5"
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
          >
            {features.map((feature) => (
              <motion.div key={feature.title} variants={staggerItem}>
                <div className="card p-6 flex gap-4 group">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">{feature.title}</h3>
                    <p className="mt-1 text-sm text-text-secondary leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ VENDOR CTA BANNER ═══ */}
      <section className="relative z-10 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            className="relative overflow-hidden rounded-3xl"
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={fadeUp}
          >
            <div className="absolute inset-0">
              <Image
                src="/images/home/vendor-cta-banner.png"
                alt="Become a vendor"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-base/95 via-base/80 to-base/50" />
            </div>
            <div className="relative z-10 px-8 py-16 md:px-16 md:py-20 max-w-lg">
              <p className="text-xs font-semibold tracking-widest text-cta uppercase mb-3">For Vendors</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-text-primary leading-tight">
                Grow your business with BuildMart
              </h2>
              <p className="mt-4 text-text-secondary leading-relaxed">
                Join 500+ verified vendors on Hyderabad&apos;s largest construction materials marketplace. Get direct access to quality buyers — no middlemen.
              </p>
              <Link href="/login" className="mt-8 inline-flex items-center gap-2 bg-cta hover:bg-cta-hover text-white rounded-full px-6 py-3 text-sm font-semibold btn-glow-cta transition-all group">
                  Register as Vendor
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="relative z-10 py-16 md:py-24 border-t border-border-subtle">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            className="text-center mb-14"
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
          >
            <motion.p variants={fadeUp} className="text-xs font-semibold tracking-widest text-accent/70 uppercase mb-2">
              Testimonials
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold gradient-text">
              Trusted by builders across Hyderabad
            </motion.h2>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
          >
            {testimonials.map((t) => (
              <motion.div key={t.name} variants={staggerItem}>
                <div className="card p-6">
                  <div className="flex items-center gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-warning text-warning" />
                    ))}
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-3 mt-5 pt-5 border-t border-border-subtle">
                    <div className="relative h-10 w-10 rounded-full overflow-hidden bg-elevated">
                      <Image
                        src={t.avatar}
                        alt={t.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{t.name}</p>
                      <p className="text-xs text-text-tertiary">{t.role}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ EXPANDED FOOTER ═══ */}
      <footer className="relative z-10 border-t border-border-subtle bg-surface py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <p className="text-xl font-bold mb-3">
                <span className="text-text-primary">Build</span>
                <span className="text-accent">Mart</span>
              </p>
              <p className="text-sm text-text-tertiary leading-relaxed max-w-xs">
                Hyderabad&apos;s trusted construction materials marketplace connecting buyers with verified local vendors.
              </p>
            </div>

            {/* Platform */}
            <div>
              <p className="text-sm font-semibold text-text-primary mb-3">Platform</p>
              <ul className="space-y-2">
                {['Buyer Dashboard', 'Vendor Portal', 'Product Catalog', 'Create RFQ'].map((item) => (
                  <li key={item}>
                    <Link href="/login" className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <p className="text-sm font-semibold text-text-primary mb-3">Company</p>
              <ul className="space-y-2">
                {['About Us', 'Careers', 'Privacy Policy', 'Terms of Service'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <p className="text-sm font-semibold text-text-primary mb-3">Contact</p>
              <ul className="space-y-2.5">
                <li className="flex items-center gap-2 text-sm text-text-tertiary">
                  <MapPin className="h-3.5 w-3.5 text-text-disabled" />
                  Hyderabad, Telangana
                </li>
                <li className="flex items-center gap-2 text-sm text-text-tertiary">
                  <Mail className="h-3.5 w-3.5 text-text-disabled" />
                  hello@buildmart.in
                </li>
                <li className="flex items-center gap-2 text-sm text-text-tertiary">
                  <Phone className="h-3.5 w-3.5 text-text-disabled" />
                  +91 90000 00000
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border-subtle pt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-text-tertiary">
              © {new Date().getFullYear()} BuildMart. All rights reserved.
            </p>
            <div className="flex items-center gap-3">
              {[Facebook, Twitter, Linkedin].map((Icon, i) => (
                <a key={i} href="#" className="flex h-8 w-8 items-center justify-center rounded-lg bg-elevated text-text-tertiary hover:text-text-secondary hover:bg-elevated/80 transition-colors">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </motion.div>
  );
}
