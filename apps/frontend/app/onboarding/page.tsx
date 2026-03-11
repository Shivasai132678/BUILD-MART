import Link from 'next/link';

export default function OnboardingPage() {
  return (
    <div className="w-full max-w-xl">
      {/* Logo */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#D97706] flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[20px]">construction</span>
          </div>
          <span className="text-2xl font-bold text-text-primary">
            Build<span className="text-[#D97706]">Mart</span>
          </span>
        </div>
        <h1 className="text-xl font-bold text-text-primary">How will you use BuildMart?</h1>
        <p className="text-sm text-[#A89F91] mt-2">Choose your role to get started. You can only pick one.</p>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Buyer */}
        <Link
          href="/onboarding/buyer"
          className="group flex flex-col items-center gap-4 bg-surface border border-[#2A2520] hover:border-[#D97706]/50 rounded-2xl p-6 transition-all duration-200 hover:bg-[#D97706]/5"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#D97706]/15 flex items-center justify-center group-hover:bg-[#D97706]/25 transition-colors">
            <span className="material-symbols-outlined text-[#D97706] text-[28px]">corporate_fare</span>
          </div>
          <div className="text-center">
            <div className="font-semibold text-text-primary">I&apos;m a Buyer</div>
            <div className="text-xs text-[#7A7067] mt-1 leading-relaxed">
              Create RFQs and source materials from verified vendors
            </div>
          </div>
          <div className="mt-auto flex items-center gap-1 text-xs font-semibold text-[#D97706]">
            Get started
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </div>
        </Link>

        {/* Vendor */}
        <Link
          href="/onboarding/vendor"
          className="group flex flex-col items-center gap-4 bg-[#111827] border border-[#1E2A3A] hover:border-blue/50 rounded-2xl p-6 transition-all duration-200 hover:bg-blue/5"
        >
          <div className="w-14 h-14 rounded-2xl bg-blue/15 flex items-center justify-center group-hover:bg-blue/25 transition-colors">
            <span className="material-symbols-outlined text-blue text-[28px]">storefront</span>
          </div>
          <div className="text-center">
            <div className="font-semibold text-text-primary">I&apos;m a Vendor</div>
            <div className="text-xs text-[#4A6080] mt-1 leading-relaxed">
              List your products and receive quote requests from buyers
            </div>
          </div>
          <div className="mt-auto flex items-center gap-1 text-xs font-semibold text-blue">
            Register business
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
