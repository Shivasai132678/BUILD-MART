import type { ReactNode } from 'react';
import Image from 'next/image';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#141210] text-slate-100 font-sans">
      {/* Left Side: Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-cover bg-center overflow-hidden">
        <Image
          src="/images/home/hero-construction-site.png"
          alt="Construction site"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#141210]/90 via-[#141210]/70 to-[#D97706]/30" />

        {/* Brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 text-[#D97706] mb-16">
            <div className="size-8">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-[#F5F0E8] text-2xl font-bold tracking-tight">BuildMart</h2>
          </div>
          <h1 className="text-[#F5F0E8] text-5xl font-bold leading-tight mb-8 max-w-lg">
            Every great build starts with the right materials
          </h1>
          <div className="flex flex-col gap-4 items-start">
            {[
              { icon: 'verified', text: '500+ verified vendors' },
              { icon: 'compare_arrows', text: 'Compare quotes instantly' },
              { icon: 'my_location', text: 'Real-time delivery tracking' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3 rounded-full bg-[#1A1714]/80 border border-[#2A251F] px-5 py-2.5 backdrop-blur-md">
                <span className="material-symbols-outlined text-[#D97706] text-xl">{item.icon}</span>
                <p className="text-[#F5F0E8] text-sm font-medium">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative z-10 rounded-2xl p-6 mt-12 max-w-md" style={{ background: 'rgba(26,23,20,0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(42,37,31,0.8)' }}>
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-[#2A251F] shrink-0 border border-[#2A251F] flex items-center justify-center text-[#D97706] font-bold text-lg">R</div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-[#F5F0E8] font-semibold">Ramesh Reddy</h4>
                <span className="text-[#A89F91] text-xs">• Construction Manager</span>
              </div>
              <p className="text-[#A89F91] text-sm leading-relaxed">
                &ldquo;BuildMart completely transformed how we source cement and steel for our Hyderabad projects.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[#1A1714] overflow-y-auto">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="flex lg:hidden justify-center items-center gap-3 text-[#D97706] mb-8">
            <div className="size-8">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-[#F5F0E8] text-2xl font-bold tracking-tight">BuildMart</h2>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
