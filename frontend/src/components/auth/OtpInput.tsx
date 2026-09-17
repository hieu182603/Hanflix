import React, { useRef, useEffect, useCallback } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}

export default function OtpInput({ value, onChange, length = 6, disabled = false, autoFocus = true }: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split('').concat(Array(length).fill('')).slice(0, length);

  useEffect(() => {
    if (autoFocus && inputsRef.current[0]) {
      inputsRef.current[0].focus();
    }
  }, [autoFocus]);

  const focusInput = useCallback((index: number) => {
    const el = inputsRef.current[index];
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const handleChange = useCallback((index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    if (!char) return;
    const next = value.split('').concat(Array(length).fill('')).slice(0, length);
    next[index] = char;
    const newValue = next.join('').replace(/\s/g, '');
    onChange(newValue);
    if (index < length - 1) {
      focusInput(index + 1);
    }
  }, [value, length, onChange, focusInput]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = value.split('').concat(Array(length).fill('')).slice(0, length);
      if (next[index]) {
        next[index] = '';
        onChange(next.join('').trimEnd());
      } else if (index > 0) {
        next[index - 1] = '';
        onChange(next.join('').trimEnd());
        focusInput(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      focusInput(index + 1);
    }
  }, [value, length, onChange, focusInput]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pasted) {
      onChange(pasted);
      const focusIdx = Math.min(pasted.length, length - 1);
      setTimeout(() => focusInput(focusIdx), 0);
    }
  }, [length, onChange, focusInput]);

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={el => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={digits[i] || ''}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          aria-label={`Digit ${i + 1}`}
          className={`
            w-11 h-13 sm:w-13 sm:h-15
            text-center text-xl sm:text-2xl font-black font-display
            rounded-xl border-2 bg-white
            transition-all duration-200
            outline-none
            ${digits[i]
              ? 'border-[#E50914] text-neutral-900 shadow-[0_0_0_3px_rgba(229,9,20,0.1)]'
              : 'border-neutral-200 text-neutral-400'
            }
            focus:border-[#E50914] focus:ring-4 focus:ring-[#E50914]/10 focus:shadow-[0_4px_12px_rgba(229,9,20,0.15)]
            disabled:opacity-50 disabled:cursor-not-allowed
            placeholder:text-neutral-200
          `}
          style={{ caretColor: '#E50914' }}
        />
      ))}
    </div>
  );
}
