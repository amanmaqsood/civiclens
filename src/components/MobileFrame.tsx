import React from "react";

interface MobileFrameProps {
  children: React.ReactNode;
}

export default function MobileFrame({ children }: MobileFrameProps) {
  return (
    <div className="min-h-screen w-full bg-paper font-sans antialiased text-ink overflow-x-clip">
      <div
        className="min-h-screen w-full bg-paper flex flex-col"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
