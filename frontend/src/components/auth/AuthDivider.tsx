import React from 'react';

export default function AuthDivider() {
  return (
    <div className="auth-divider flex items-center gap-3 w-full my-2.5 sm:my-3">
      <span className="auth-divider-line h-[1px] flex-1 bg-neutral-200" />
      <span className="auth-divider-text text-[13px] font-medium text-neutral-400 select-none">
        hoặc
      </span>
      <span className="auth-divider-line h-[1px] flex-1 bg-neutral-200" />
    </div>
  );
}
