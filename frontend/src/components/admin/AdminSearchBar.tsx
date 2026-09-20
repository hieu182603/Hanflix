import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';

interface AdminSearchBarProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  onSubmit?: (value: string) => void;
  onChangeExtra?: () => void;
  className?: string;
  inputClassName?: string;
  containerClassName?: string;
}

export function AdminSearchBar({
  placeholder = 'Tìm kiếm...',
  value,
  onChange,
  onClear,
  onSubmit,
  onChangeExtra,
  className = '',
  inputClassName = '',
  containerClassName = '',
}: AdminSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit(value.trim());
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    onChange('');
    onClear?.();
    inputRef.current?.focus();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    onChangeExtra?.();
  };

  return (
    <div
      className={`relative flex w-full items-center rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] transition-all focus-within:border-[#B91B1C] focus-within:bg-white ${className} ${containerClassName}`}
    >
      {/* Search Icon */}
      <Search className="absolute left-3 h-4 w-4 shrink-0 text-[#8C827A]" />

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`h-10 w-full bg-transparent pl-9 pr-8 text-xs text-[#2B2826] outline-none placeholder:text-[#8C827A]/70 ${inputClassName}`}
      />

      {/* Clear Button */}
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 flex h-5 w-5 items-center justify-center rounded-md text-[#8C827A] hover:bg-[#F2E4D8] hover:text-[#2B2826] transition-colors"
          title="Xóa tìm kiếm"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
