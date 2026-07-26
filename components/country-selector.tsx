'use client';

import { useId, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CountryFlag } from '@/components/country-flag';
import { getCountryDisplayName } from '@/lib/country-display';
import type { Country } from '@/lib/types';

export interface CountrySelectorProps {
    /** ID forwarded to the combobox trigger for label association */
    id?: string;
    /** Current selected country code (ISO 3166-1 alpha-2) */
    value: string | null | undefined;
    /** Callback when country selection changes */
    onChange: (countryCode: string | null) => void;
    /** List of available countries */
    countries: Country[];
    /** Placeholder text when no country is selected */
    placeholder?: string;
    /** Whether the field is required */
    required?: boolean;
    /** Whether the selector is disabled */
    disabled?: boolean;
    /** Error message to display */
    error?: string;
    /** Whether to show the clear button */
    showClear?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Additional CSS classes for the combobox trigger */
    triggerClassName?: string;
    /** Loading state */
    loading?: boolean;
    /** Search placeholder text */
    searchPlaceholder?: string;
    /** Empty state text */
    emptyText?: string;
    /** Current locale for country name display */
    locale?: string;
    /** Localized label shown while countries are loading */
    loadingText?: string;
    /** Localized accessible label for clearing the selection */
    clearLabel?: string;
}

/**
 * CountrySelector - A searchable dropdown component for selecting countries
 *
 * Features:
 * - Real-time search filtering
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Flag icons with country names
 * - Optional clear button
 * - Loading and error states
 * - Full accessibility support (ARIA labels, keyboard focus management)
 * - Responsive design
 *
 * @example
 * ```tsx
 * <CountrySelector
 *   value={selectedCountry}
 *   onChange={setSelectedCountry}
 *   countries={countries}
 *   placeholder="Select your country"
 *   showClear={true}
 * />
 * ```
 */
export function CountrySelector({
    id,
    value,
    onChange,
    countries,
    placeholder = 'Select country',
    required = false,
    disabled = false,
    error,
    showClear = true,
    className,
    triggerClassName,
    loading = false,
    searchPlaceholder = 'Search countries...',
    emptyText = 'No country found',
    locale = 'en',
    loadingText = 'Loading...',
    clearLabel = 'Clear selection',
}: CountrySelectorProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const generatedErrorId = useId();
    const errorId = id ? `${id}-error` : generatedErrorId;

    // Find the selected country object
    const selectedCountry = useMemo(
        () => countries.find((country) => country.code === value),
        [countries, value],
    );

    // Filter countries based on search query
    const filteredCountries = useMemo(() => {
        // Handle empty or whitespace-only queries
        if (!searchQuery || searchQuery.trim() === '') return countries;

        const query = searchQuery.toLowerCase();
        return countries.filter((country) => {
            const name = getCountryDisplayName(country, locale);
            return name.toLowerCase().includes(query) || country.code.toLowerCase().includes(query);
        });
    }, [countries, searchQuery, locale]);

    // Handle country selection
    const handleSelect = (countryCode: string) => {
        onChange(countryCode === value ? null : countryCode);
        setOpen(false);
        setSearchQuery('');
    };

    // Handle clear button
    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
    };

    // Get display name for a country
    const getCountryName = (country: Country) => {
        return getCountryDisplayName(country, locale);
    };

    // Determine if clear button should be shown
    const showClearButton = showClear && !required && value && !disabled;

    return (
        <div className={cn('relative', className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <div className="relative">
                    <PopoverTrigger asChild>
                        <Button
                            id={id}
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            aria-label={id ? undefined : placeholder}
                            aria-invalid={!!error}
                            aria-required={required}
                            aria-describedby={error ? errorId : undefined}
                            disabled={disabled || loading}
                            className={cn(
                                'min-h-11 w-full justify-between',
                                showClearButton && 'pe-20',
                                !value && 'text-muted-foreground',
                                error && 'border-destructive focus-visible:ring-destructive',
                                triggerClassName,
                            )}
                        >
                            <span className="flex min-w-0 flex-1 items-center gap-2">
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                                        <span className="truncate">{loadingText}</span>
                                    </>
                                ) : selectedCountry ? (
                                    <>
                                        <CountryFlag
                                            countryCode={selectedCountry.code}
                                            countryName={getCountryName(selectedCountry)}
                                            size="sm"
                                            decorative
                                        />
                                        <span className="truncate">
                                            {getCountryName(selectedCountry)}
                                        </span>
                                    </>
                                ) : (
                                    <span className="truncate">{placeholder}</span>
                                )}
                            </span>
                            <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    {showClearButton && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="absolute inset-y-0 end-8 z-10 grid w-11 place-items-center opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            aria-label={clearLabel}
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    )}
                </div>
                <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                >
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                            aria-label={searchPlaceholder}
                        />
                        <CommandList>
                            <CommandEmpty>{emptyText}</CommandEmpty>
                            <CommandGroup>
                                {filteredCountries.map((country) => {
                                    const countryName = getCountryName(country);
                                    const isSelected = value === country.code;

                                    return (
                                        <CommandItem
                                            key={country.code}
                                            value={country.code}
                                            onSelect={() => handleSelect(country.code)}
                                            aria-selected={isSelected}
                                        >
                                            <CountryFlag
                                                countryCode={country.code}
                                                countryName={countryName}
                                                size="sm"
                                                decorative
                                            />
                                            <span className="flex-1 truncate">{countryName}</span>
                                            <Check
                                                className={cn(
                                                    'h-4 w-4 shrink-0',
                                                    isSelected ? 'opacity-100' : 'opacity-0',
                                                )}
                                            />
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {error && (
                <p
                    id={errorId}
                    className="mt-1.5 text-sm text-destructive"
                    role="alert"
                    aria-live="polite"
                >
                    {error}
                </p>
            )}
        </div>
    );
}
