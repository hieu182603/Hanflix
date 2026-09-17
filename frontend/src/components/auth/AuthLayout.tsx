import React from 'react';

interface AuthLayoutProps {
  visualPanel: React.ReactNode;
  formPanel: React.ReactNode;
  reverse?: boolean; // If true, visual is on the right (Register view)
}

export default function AuthLayout({ visualPanel, formPanel, reverse = false }: AuthLayoutProps) {
  return (
    <div className="auth-page min-h-[100dvh] w-full flex flex-col bg-white font-sans antialiased selection:bg-[#E50914]/10 selection:text-[#E50914] overflow-hidden">
      {/* Mobile Logo Header (<1024px) */}
      <div className="lg:hidden shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 bg-white border-b border-[#F0D5C0]/60">
        <a href="/" className="inline-flex items-center">
          <img
            src="/assets/logo.png"
            alt="HanFlix Logo"
            className="h-8 sm:h-9 w-auto object-contain"
          />
        </a>
        <a
          href="/"
          role="button"
          aria-label="Quay lại"
          className="text-[13px] font-semibold text-neutral-600 hover:text-neutral-900 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 flex items-center gap-1 cursor-pointer"
        >
          Quay lại
        </a>
      </div>

      {/* Main Split Grid (50/50 on desktop, 1-col on mobile/tablet) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0 w-full h-full">
        
        {/* Visual Panel (Desktop only) — fixed, no scroll */}
        <div
          className={`hidden lg:flex w-full h-full max-h-full relative flex-col justify-between overflow-hidden select-none bg-gradient-to-br from-[#FFF0E6] via-[#FED3BD] to-[#FBAA8C] ${
            reverse ? 'lg:order-2 border-l border-[#F6A37F]/60' : 'lg:order-1 border-r border-[#F6A37F]/60'
          } auth-visual-panel`}
        >
          {/* Ambient lighting glows */}
          <div className="absolute top-1/4 left-1/4 w-[clamp(260px,25vw,380px)] h-[clamp(260px,25vw,380px)] rounded-full bg-[#E50914]/18 blur-[90px] pointer-events-none" />
          <div className="absolute -top-16 -right-16 w-[clamp(220px,20vw,320px)] h-[clamp(220px,20vw,320px)] bg-gradient-to-bl from-[#F6976F]/50 to-transparent rounded-bl-full pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-[clamp(240px,22vw,340px)] h-[clamp(240px,22vw,340px)] rounded-full bg-[#E50914]/14 blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 right-10 w-[clamp(180px,18vw,260px)] h-[clamp(180px,18vw,260px)] rounded-full bg-[#F59E0B]/20 blur-2xl pointer-events-none" />

          {/* Inner Content Container - Fluid padding */}
          <div className="relative z-10 w-full max-w-[580px] xl:max-w-[640px] 2xl:max-w-[680px] mx-auto h-full flex flex-col justify-between p-5 lg:p-6 xl:p-8 2xl:p-10 auth-visual-inner">
            {/* Top Brand Logo */}
            <div className="shrink-0 mb-3 xl:mb-5">
              <img
                src="/assets/logo.png"
                alt="HanFlix Logo"
                className="h-9 xl:h-11 w-auto max-w-[220px] object-contain drop-shadow-sm"
              />
            </div>

            {/* Main Visual Content */}
            <div className="my-auto py-1.5 flex-1 flex flex-col justify-center">
              {visualPanel}
            </div>

            {/* Bottom spacer */}
            <div className="shrink-0" />
          </div>
        </div>

        {/* Form Panel (Clean, crisp pure white) */}
        <div
          className={`flex-1 w-full flex flex-col justify-center items-center px-4 py-4 sm:px-8 lg:px-8 xl:px-12 bg-white overflow-y-auto ${
            reverse ? 'lg:order-1' : 'lg:order-2'
          } auth-form-panel`}
        >
          <div className="w-full max-w-[420px] xl:max-w-[460px] mx-auto my-auto py-2 sm:py-4 auth-form-container">
            {formPanel}
          </div>
        </div>

      </div>
    </div>
  );
}
