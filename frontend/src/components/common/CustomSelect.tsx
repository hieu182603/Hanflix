import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  menuClassName?: string;
  ariaLabel?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Chọn một mục...',
  className = '',
  menuClassName = '',
  ariaLabel,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || displayLabel}
        className={`w-full h-10 px-3.5 rounded-xl border bg-white flex items-center justify-between gap-2.5 text-xs sm:text-sm font-semibold outline-none cursor-pointer transition-all shadow-2xs ${
          isOpen
            ? 'border-[#B91B1C] ring-2 ring-[#B91B1C]/15 text-[#18181B]'
            : 'border-[#E7E7EA] hover:border-[#8B9097] text-[#18181B]'
        }`}
      >
        <span className="truncate text-left font-medium">{displayLabel}</span>
        <ChevronDown
          className={`w-4 h-4 text-[#8B9097] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#B91B1C]' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute left-0 right-0 sm:right-auto sm:min-w-full top-full mt-1.5 py-1.5 bg-white border border-[#E7E7EA] rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto scrollbar-thin ${menuClassName}`}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3.5 py-2 text-left text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  isSelected
                    ? 'font-bold text-[#B91B1C] bg-[#FFF5F5]'
                    : 'text-[#3A3F45] hover:bg-[#F7F7F9] hover:text-[#18181B]'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-[#B91B1C] shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
