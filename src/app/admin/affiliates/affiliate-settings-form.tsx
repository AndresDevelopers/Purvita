'use client';

import { useEffect, useState } from 'react';
import { Loader2, Users, UserCheck, Crown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';
import { AppSettings } from '@/modules/app-settings/domain/models/app-settings';
import { PhaseLevel } from '@/modules/phase-levels/domain/models/phase-level';

interface AffiliateSettingsFormProps {
    copy: {
        title: string;
        description: string;
        storeOwnerDiscount: string;
        storeOwnerDiscountDesc: string;
        discountType: string;
        discountValue: string;
        sponsorCommission: string;
        sponsorCommissionDesc: string;
        networkCommission: string;
        networkCommissionDesc: string;
        save: string;
        saving: string;
        success: string;
        error: string;
    };
}

export function AffiliateSettingsForm({ copy }: AffiliateSettingsFormProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [phases, setPhases] = useState<PhaseLevel[]>([]);

    // Form state
    const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
    const [discountValue, setDiscountValue] = useState('');

    // Affiliate commission rates (global settings)
    const [affiliateDirectSponsorRate, setAffiliateDirectSponsorRate] = useState('');
    const [affiliateGeneralSponsorRate, setAffiliateGeneralSponsorRate] = useState('');

    // Phase rates state: map phase ID to rate strings (for MLM subscribers)
    const [phaseSponsorRates, setPhaseSponsorRates] = useState<Record<string, string>>({});

    useEffect(() => {
        const loadData = async () => {
            try {
                const [settingsRes, phasesRes] = await Promise.all([
                    adminApi.get('/api/admin/app-settings', { cache: 'no-store' }),
                    adminApi.get('/api/admin/phase-levels', { cache: 'no-store' })
                ]);

                if (!settingsRes.ok || !phasesRes.ok) throw new Error('Failed to load data');

                const settingsData = await settingsRes.json();
                const phasesData = await phasesRes.json();

                const appSettings = settingsData.settings as AppSettings;
                const phaseLevels = phasesData.phaseLevels as PhaseLevel[];

                setSettings(appSettings);
                setPhases(phaseLevels);

                // Initialize settings state
                setDiscountType(appSettings.storeOwnerDiscountType);
                if (appSettings.storeOwnerDiscountType === 'fixed') {
                    setDiscountValue((appSettings.storeOwnerDiscountValue / 100).toFixed(2));
                } else {
                    setDiscountValue((appSettings.storeOwnerDiscountValue * 100).toFixed(2));
                }

                // Initialize affiliate commission rates
                setAffiliateDirectSponsorRate((appSettings.affiliateDirectSponsorCommissionRate * 100).toFixed(2));
                setAffiliateGeneralSponsorRate((appSettings.affiliateGeneralSponsorCommissionRate * 100).toFixed(2));

                // Initialize phase rates state (for MLM subscribers)
                const sponsorRates: Record<string, string> = {};

                // Filter phases starting from level 1 (MLM network starts at phase 1)
                phaseLevels.filter(p => p.level >= 1).forEach(phase => {
                    sponsorRates[phase.id] = (phase.affiliateSponsorCommissionRate * 100).toFixed(2);
                });
                setPhaseSponsorRates(sponsorRates);

            } catch (error) {
                console.error('Failed to load data', error);
                toast({
                    title: 'Error',
                    description: copy.error,
                    variant: 'destructive',
                });
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [copy.error, toast]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;

        setSaving(true);
        try {
            // 1. Save App Settings
            let finalDiscountValue = parseFloat(discountValue);
            if (isNaN(finalDiscountValue)) finalDiscountValue = 0;

            if (discountType === 'fixed') {
                finalDiscountValue = Math.round(finalDiscountValue * 100); // Convert to cents
            } else {
                finalDiscountValue = finalDiscountValue / 100; // Convert to 0-1
            }

            // Parse affiliate commission rates
            let directSponsorRate = parseFloat(affiliateDirectSponsorRate);
            if (isNaN(directSponsorRate)) directSponsorRate = 0;
            directSponsorRate = directSponsorRate / 100;

            let generalSponsorRate = parseFloat(affiliateGeneralSponsorRate);
            if (isNaN(generalSponsorRate)) generalSponsorRate = 0;
            generalSponsorRate = generalSponsorRate / 100;

            const updatePayload = {
                maxMembersPerLevel: settings.maxMembersPerLevel,
                payoutFrequency: settings.payoutFrequency,
                currency: settings.currency,
                currencies: settings.currencies,
                autoAdvanceEnabled: settings.autoAdvanceEnabled,
                ecommerceCommissionRate: settings.ecommerceCommissionRate,
                teamLevelsVisible: settings.teamLevelsVisible,
                storeOwnerDiscountType: discountType,
                storeOwnerDiscountValue: finalDiscountValue,
                directSponsorCommissionRate: settings.directSponsorCommissionRate,
                networkCommissionRate: settings.networkCommissionRate,
                rewardCreditLabelEn: settings.rewardCreditLabelEn,
                rewardCreditLabelEs: settings.rewardCreditLabelEs,
                freeProductLabelEn: settings.freeProductLabelEn,
                freeProductLabelEs: settings.freeProductLabelEs,
                affiliateCommissionRate: settings.affiliateCommissionRate,
                affiliateDirectSponsorCommissionRate: directSponsorRate,
                affiliateGeneralSponsorCommissionRate: generalSponsorRate,
            };

            const settingsPromise = adminApi.put('/api/admin/app-settings', updatePayload);

            // 2. Save Phase Levels (only sponsor commission rate for phases >= 1)
            const mlmPhases = phases.filter(p => p.level >= 1);
            const phasePromises = mlmPhases.map(phase => {
                const sponsorRateStr = phaseSponsorRates[phase.id];

                // Skip if no rate is set for this phase
                if (sponsorRateStr === undefined || sponsorRateStr === '') {
                    return Promise.resolve();
                }

                let sponsorRate = parseFloat(sponsorRateStr);
                if (isNaN(sponsorRate)) sponsorRate = 0;
                sponsorRate = sponsorRate / 100;

                // Only update if changed
                if (Math.abs(sponsorRate - phase.affiliateSponsorCommissionRate) < 0.0001) {
                    return Promise.resolve();
                }

                return adminApi.put(`/api/admin/phase-levels/${phase.id}`, {
                    affiliateSponsorCommissionRate: sponsorRate
                });
            });

            const [settingsRes, ...phaseResults] = await Promise.all([settingsPromise, ...phasePromises]);

            if (!settingsRes.ok) {
                const errorData = await settingsRes.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to save settings');
            }

            // Check phase results
            for (const res of phaseResults) {
                if (res && !res.ok) {
                    console.error('Failed to update a phase level');
                }
            }

            // Reload data from server to ensure consistency
            const [newSettingsRes, newPhasesRes] = await Promise.all([
                adminApi.get('/api/admin/app-settings', { cache: 'no-store' }),
                adminApi.get('/api/admin/phase-levels', { cache: 'no-store' })
            ]);

            if (newSettingsRes.ok && newPhasesRes.ok) {
                const newSettingsData = await newSettingsRes.json();
                const newPhasesData = await newPhasesRes.json();
                
                const newSettings = newSettingsData.settings as AppSettings;
                const newPhaseLevels = newPhasesData.phaseLevels as PhaseLevel[];
                
                setSettings(newSettings);
                setPhases(newPhaseLevels);
                
                // Update form state with fresh data
                setAffiliateDirectSponsorRate((newSettings.affiliateDirectSponsorCommissionRate * 100).toFixed(2));
                setAffiliateGeneralSponsorRate((newSettings.affiliateGeneralSponsorCommissionRate * 100).toFixed(2));
                
                const newSponsorRates: Record<string, string> = {};
                newPhaseLevels.filter(p => p.level >= 1).forEach(phase => {
                    newSponsorRates[phase.id] = (phase.affiliateSponsorCommissionRate * 100).toFixed(2);
                });
                setPhaseSponsorRates(newSponsorRates);
            }

            toast({
                title: 'Success',
                description: copy.success,
            });

        } catch (error) {
            console.error('Failed to save settings', error);
            toast({
                title: 'Error',
                description: copy.error,
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleSponsorRateChange = (phaseId: string, value: string) => {
        setPhaseSponsorRates(prev => ({
            ...prev,
            [phaseId]: value
        }));
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>{copy.title}</CardTitle>
                    <CardDescription>{copy.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                    {/* Store Owner Discount */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">{copy.storeOwnerDiscount}</h3>
                        <p className="text-sm text-muted-foreground">{copy.storeOwnerDiscountDesc}</p>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>{copy.discountType}</Label>
                                <Select
                                    value={discountType}
                                    onValueChange={(v: 'fixed' | 'percent') => setDiscountType(v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                                        <SelectItem value="percent">Percentage (%)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>{copy.discountValue}</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={discountValue}
                                    onChange={(e) => setDiscountValue(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border-t" />

                    {/* Affiliate Sponsor Commissions (for affiliates without MLM subscription) */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            <h3 className="text-lg font-medium">Affiliate Sponsor Commissions</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Configure commissions for sponsors when an affiliate (without MLM subscription) makes a sale. 
                            Affiliates can be at any level without limits.
                        </p>

                        <div className="grid gap-4 sm:grid-cols-2">
                            {/* Direct Sponsor Commission */}
                            <div className="rounded-lg border p-4">
                                <div className="mb-3 flex items-center gap-2">
                                    <UserCheck className="h-5 w-5 text-green-600" />
                                    <h4 className="font-medium">Direct Sponsor</h4>
                                </div>
                                <p className="mb-3 text-xs text-muted-foreground">
                                    The person who directly referred the affiliate. Example: Pedro referred María, so Pedro is María&apos;s direct sponsor.
                                </p>
                                <div className="space-y-2">
                                    <Label>Commission %</Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            value={affiliateDirectSponsorRate}
                                            onChange={(e) => setAffiliateDirectSponsorRate(e.target.value)}
                                            className="pr-8"
                                        />
                                        <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
                                    </div>
                                </div>
                            </div>

                            {/* General Sponsor Commission */}
                            <div className="rounded-lg border p-4">
                                <div className="mb-3 flex items-center gap-2">
                                    <Crown className="h-5 w-5 text-amber-600" />
                                    <h4 className="font-medium">General Sponsor</h4>
                                </div>
                                <p className="mb-3 text-xs text-muted-foreground">
                                    The person who started the MLM network. Example: Kevin started the network, Pedro joined through Kevin, María joined through Pedro. Kevin is the general sponsor.
                                </p>
                                <div className="space-y-2">
                                    <Label>Commission %</Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            value={affiliateGeneralSponsorRate}
                                            onChange={(e) => setAffiliateGeneralSponsorRate(e.target.value)}
                                            className="pr-8"
                                        />
                                        <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg bg-muted/50 p-3">
                            <p className="text-xs text-muted-foreground">
                                <strong>Example:</strong> If María (affiliate) sells $100, with Direct Sponsor at 5% and General Sponsor at 2%:
                                <br />• Pedro (direct sponsor) receives $5
                                <br />• Kevin (general sponsor) receives $2
                            </p>
                        </div>
                    </div>

                    <div className="border-t" />

                    {/* MLM Phase Commissions (for subscribers with MLM subscription) */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Crown className="h-5 w-5 text-primary" />
                            <h3 className="text-lg font-medium">MLM Subscription - Phase Commissions</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Configure direct sponsor commissions for MLM subscribers by phase level. 
                            MLM subscribers have network limits configured in app settings. Phase 1+ forms the multi-level network.
                        </p>

                        <div className="space-y-4">
                            {phases.filter(p => p.level >= 1).map((phase) => (
                                <div key={phase.id} className="rounded-lg border p-4">
                                    <div className="mb-3 flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                            {phase.level}
                                        </div>
                                        <h4 className="font-medium">{phase.name}</h4>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Direct Sponsor Commission %</Label>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="100"
                                                value={phaseSponsorRates[phase.id] || ''}
                                                onChange={(e) => handleSponsorRateChange(phase.id, e.target.value)}
                                                className="pr-8"
                                            />
                                            <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            When a Phase {phase.level} MLM subscriber makes a sale, their direct sponsor receives this percentage.
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {copy.save}
                        </Button>
                    </div>

                </CardContent>
            </Card>
        </form>
    );
}
