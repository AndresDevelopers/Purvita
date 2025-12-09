
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

interface UserFiltersProps {
    levels: { value: number; label: string }[];
    subscriptionStatuses: { value: string; label: string }[];
    dict: any;
}

export function UserFilters({ levels, subscriptionStatuses, dict }: UserFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const selectedLevels = React.useMemo(() => {
        const params = searchParams.get('levels');
        return params ? params.split(',').map(Number) : [];
    }, [searchParams]);

    const selectedStatuses = React.useMemo(() => {
        const params = searchParams.get('subscriptionStatus');
        return params ? params.split(',') : [];
    }, [searchParams]);

    const updateFilters = (newLevels: number[], newStatuses: string[]) => {
        const params = new URLSearchParams(searchParams.toString());

        if (newLevels.length > 0) {
            params.set('levels', newLevels.join(','));
        } else {
            params.delete('levels');
        }

        if (newStatuses.length > 0) {
            params.set('subscriptionStatus', newStatuses.join(','));
        } else {
            params.delete('subscriptionStatus');
        }

        router.push(`?${params.toString()}`);
    };

    const toggleLevel = (level: number) => {
        const newLevels = selectedLevels.includes(level)
            ? selectedLevels.filter((l) => l !== level)
            : [...selectedLevels, level];
        updateFilters(newLevels, selectedStatuses);
    };

    const toggleStatus = (status: string) => {
        const newStatuses = selectedStatuses.includes(status)
            ? selectedStatuses.filter((s) => s !== status)
            : [...selectedStatuses, status];
        updateFilters(selectedLevels, newStatuses);
    };

    const clearFilters = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('levels');
        params.delete('subscriptionStatus');
        router.push(`?${params.toString()}`);
    };

    const activeFilterCount = selectedLevels.length + selectedStatuses.length;

    return (
        <div className="flex items-center space-x-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 border-dashed">
                        <Filter className="mr-2 h-4 w-4" />
                        {dict.admin.filters || 'Filters'}
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
                                            {levels
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
                                            {subscriptionStatuses
                                                .filter((option) => selectedStatuses.includes(option.value))
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
                <PopoverContent className="w-[200px] p-0" align="start">
                    <Command>
                        <CommandInput placeholder={dict.admin.filterUsers || "Filter users..."} />
                        <CommandList>
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup heading={dict.admin.levels || "Levels"}>
                                {levels.map((level) => {
                                    const isSelected = selectedLevels.includes(level.value);
                                    return (
                                        <CommandItem
                                            key={level.value}
                                            onSelect={() => toggleLevel(level.value)}
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
                                            <span>{level.label}</span>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandGroup heading={dict.admin.subscriptionStatus || "Subscription Status"}>
                                {subscriptionStatuses.map((status) => {
                                    const isSelected = selectedStatuses.includes(status.value);
                                    return (
                                        <CommandItem
                                            key={status.value}
                                            onSelect={() => toggleStatus(status.value)}
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
                                            <span>{status.label}</span>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                            {activeFilterCount > 0 && (
                                <>
                                    <CommandSeparator />
                                    <CommandGroup>
                                        <CommandItem
                                            onSelect={clearFilters}
                                            className="justify-center text-center"
                                        >
                                            {dict.admin.clearFilters || "Clear filters"}
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
