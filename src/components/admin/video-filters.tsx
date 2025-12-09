'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface VideoFiltersProps {
    visibilityOptions: { value: string; label: string }[];
    levelOptions?: { value: number; label: string }[];
    dict: any;
}

export function VideoFilters({ visibilityOptions, levelOptions = [], dict }: VideoFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const selectedVisibility = React.useMemo(() => {
        const params = searchParams.get('visibility');
        return params ? params.split(',') : [];
    }, [searchParams]);

    const selectedLevels = React.useMemo(() => {
        const params = searchParams.get('levels');
        return params ? params.split(',').map(Number) : [];
    }, [searchParams]);

    const updateFilters = (newVisibility: string[], newLevels: number[]) => {
        const params = new URLSearchParams(searchParams.toString());

        if (newVisibility.length > 0) {
            params.set('visibility', newVisibility.join(','));
        } else {
            params.delete('visibility');
        }

        if (newLevels.length > 0) {
            params.set('levels', newLevels.join(','));
        } else {
            params.delete('levels');
        }

        router.push(`?${params.toString()}`);
    };

    const toggleVisibility = (value: string) => {
        const newVisibility = selectedVisibility.includes(value)
            ? selectedVisibility.filter((v) => v !== value)
            : [...selectedVisibility, value];
        updateFilters(newVisibility, selectedLevels);
    };

    const toggleLevel = (value: number) => {
        const newLevels = selectedLevels.includes(value)
            ? selectedLevels.filter((l) => l !== value)
            : [...selectedLevels, value];
        updateFilters(selectedVisibility, newLevels);
    };

    const clearFilters = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('visibility');
        params.delete('levels');
        router.push(`?${params.toString()}`);
    };

    const activeFilterCount = selectedVisibility.length + selectedLevels.length;

    return (
        <div className="flex items-center space-x-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 border-dashed">
                        <Filter className="mr-2 h-4 w-4" />
                        {dict.admin?.filters || 'Filters'}
                        {activeFilterCount > 0 && (
                            <>
                                <Separator orientation="vertical" className="mx-2 h-4" />
                                <Badge
                                    variant="secondary"
                                    className="rounded-sm px-1 font-normal lg:hidden"
                                >
                                    {activeFilterCount}
                                </Badge>
                                <div className="hidden space-x-1 lg:flex">
                                    {activeFilterCount > 2 ? (
                                        <Badge
                                            variant="secondary"
                                            className="rounded-sm px-1 font-normal"
                                        >
                                            {activeFilterCount} selected
                                        </Badge>
                                    ) : (
                                        <>
                                            {visibilityOptions
                                                .filter((option) => selectedVisibility.includes(option.value))
                                                .map((option) => (
                                                    <Badge
                                                        key={option.value}
                                                        variant="secondary"
                                                        className="rounded-sm px-1 font-normal"
                                                    >
                                                        {option.label}
                                                    </Badge>
                                                ))}
                                            {levelOptions
                                                .filter((option) => selectedLevels.includes(option.value))
                                                .map((option) => (
                                                    <Badge
                                                        key={option.value}
                                                        variant="secondary"
                                                        className="rounded-sm px-1 font-normal"
                                                    >
                                                        {option.label}
                                                    </Badge>
                                                ))}
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                        <CommandInput placeholder={dict.admin?.filterVideos || "Filter videos..."} />
                        <CommandList>
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup heading={dict.admin?.visibility || "Visibility"}>
                                {visibilityOptions.map((option) => {
                                    const isSelected = selectedVisibility.includes(option.value);
                                    return (
                                        <CommandItem
                                            key={option.value}
                                            onSelect={() => toggleVisibility(option.value)}
                                        >
                                            <div
                                                className={cn(
                                                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                    isSelected
                                                        ? "bg-primary text-primary-foreground"
                                                        : "opacity-50 [&_svg]:invisible"
                                                )}
                                            >
                                                <Check className={cn("h-4 w-4")} />
                                            </div>
                                            <span>{option.label}</span>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                            {levelOptions.length > 0 && (
                                <>
                                    <CommandSeparator />
                                    <CommandGroup heading="Allowed Levels">
                                        {levelOptions.map((option) => {
                                            const isSelected = selectedLevels.includes(option.value);
                                            return (
                                                <CommandItem
                                                    key={option.value}
                                                    onSelect={() => toggleLevel(option.value)}
                                                >
                                                    <div
                                                        className={cn(
                                                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                            isSelected
                                                                ? "bg-primary text-primary-foreground"
                                                                : "opacity-50 [&_svg]:invisible"
                                                        )}
                                                    >
                                                        <Check className={cn("h-4 w-4")} />
                                                    </div>
                                                    <span>{option.label}</span>
                                                </CommandItem>
                                            );
                                        })}
                                    </CommandGroup>
                                </>
                            )}
                            {activeFilterCount > 0 && (
                                <>
                                    <CommandSeparator />
                                    <CommandGroup>
                                        <CommandItem
                                            onSelect={clearFilters}
                                            className="justify-center text-center"
                                        >
                                            {dict.admin?.clearFilters || "Clear filters"}
                                        </CommandItem>
                                    </CommandGroup>
                                </>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
