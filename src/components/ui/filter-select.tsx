'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

interface FilterOption {
  id: string;
  label: string;
}

interface FilterSelectProps {
  /** The URL parameter name to use for filtering */
  paramName: string;
  /** The options to display in the select */
  options: FilterOption[];
  /** The currently selected value (if any) */
  currentValue?: string;
  /** The placeholder text when no option is selected */
  placeholder: string;
  /** Optional CSS class for width customization */
  className?: string;
}

/**
 * A reusable filter select component that updates URL search params
 * Uses Next.js router for client-side navigation without full page reload
 */
export function FilterSelect({
  paramName,
  options,
  currentValue,
  placeholder,
  className = 'w-48',
}: FilterSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const url = new URL(window.location.href);
    if (e.target.value) {
      url.searchParams.set(paramName, e.target.value);
    } else {
      url.searchParams.delete(paramName);
    }

    startTransition(() => {
      router.push(url.toString());
    });
  };

  return (
    <select
      className={`input ${className} ${isPending ? 'opacity-70' : ''}`}
      defaultValue={currentValue || ''}
      onChange={handleChange}
      disabled={isPending}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
