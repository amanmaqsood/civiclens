import React from "react";

interface MobileFrameProps {
  children: React.ReactNode;
}

export default function MobileFrame({ children }: MobileFrameProps) {
  return (
    <div className="min-h-screen w-full bg-[#E5E3DB] flex items-center justify-center py-0 sm:py-8 font-sans antialiased text-ink">
      <div className="w-full max-w-md sm:h-[840px] bg-paper sm:rounded-3xl sm:shadow-[0_20px_60px_-15px_rgba(14,26,43,0.35)] overflow-hidden flex flex-col border-0 sm:border-[8px] sm:border-slate-800 relative">
        {/* Mobile Status Bar Simulation (only visible on sm screen bezel wraps) */}
        <div className="hidden sm:flex bg-ink text-paper text-[11px] px-6 py-1.5 items-center justify-between font-mono font-medium tracking-tight border-b border-white/5">
          <span>09:41 AM</span>
          <div className="w-20 h-4 bg-ink rounded-full absolute left-1/2 -translate-x-1/2 top-1.5 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-marigold mr-1.5 animate-pulse"></span>
            <span className="w-1 h-1 rounded-full bg-white/20"></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase font-bold tracking-widest text-marigold">5G Lte</span>
            <span>100%</span>
          </div>
        </div>

        {/* Core Screen Area - Scrollable */}
        <div className="flex-1 overflow-y-auto bg-paper relative flex flex-col justify-between">
          <main className="flex-1">
            {children}
          </main>
        </div>

        {/* simulated home bar on sm screen displays */}
        <div className="hidden sm:block bg-paper pb-2.5 pt-1 text-center border-t border-hairline/60">
          <div className="w-32 h-1 bg-slate/30 rounded-full mx-auto" />
        </div>
      </div>
    </div>
  );
}
