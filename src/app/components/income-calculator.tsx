"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, DollarSign, Users, TrendingUp, Loader2, UserPlus, Gift } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MLMLevel {
  level: number;
  name: string;
  nameEn: string;
  nameEs: string;
  commissionRate: number;
  creditCents: number;
  freeProductValueCents: number;
}

interface MLMConfig {
  levels: MLMLevel[];
  visibleLevels: number;
  currency: string;
  rewardCreditLabelEn: string;
  rewardCreditLabelEs: string;
  freeProductLabelEn: string;
  freeProductLabelEs: string;
  affiliateCommissionRate: number;
  affiliateDirectSponsorCommissionRate: number;
  affiliateGeneralSponsorCommissionRate: number;
}

interface _LevelInput {
  level: number;
  people: string;
  salesPerPerson: string;
}

interface LevelResult {
  level: number;
  name: string;
  people: number;
  salesPerPerson: number;
  commissionRate: number;
  networkCommission: number;
  rewardCredits: number;
  freeProductValue: number;
  totalIncome: number;
}

interface AffiliateEarnings {
  clientEarnings: number;
  referrerEarnings: number;
  totalSystemEarnings: number;
}

interface IncomeCalculatorProps {
  dict: any;
  lang: 'en' | 'es';
}

export default function IncomeCalculator({ dict, lang }: IncomeCalculatorProps) {
  const [activeTab, setActiveTab] = useState("multilevel");
  const [config, setConfig] = useState<MLMConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personalSales, setPersonalSales] = useState<string>("");
  const [selectedPhase, setSelectedPhase] = useState<number>(0);
  const [averageSalesPerPerson, setAverageSalesPerPerson] = useState<string>("");
  const [level1People, setLevel1People] = useState<string>(""); // Personas en Nivel 1 (input del usuario)
  const [includeRewardCredits, setIncludeRewardCredits] = useState<boolean>(true); // Include reward credits in calculation
  const [includeFreeProductValue, setIncludeFreeProductValue] = useState<boolean>(true); // Include free product value in calculation
  const [results, setResults] = useState<LevelResult[]>([]);
  const [totalIncome, setTotalIncome] = useState<number>(0);
  
  // Affiliate system states
  const [affiliateSales, setAffiliateSales] = useState<string>("");
  const [affiliateResults, setAffiliateResults] = useState<AffiliateEarnings | null>(null);

  // Calculate network structure based on Level 1 input (2x duplication from there)
  // Limited by both the phase level AND the admin's visibleLevels setting
  const getNetworkStructure = () => {
    if (!config) return [];

    const level1Count = parseInt(level1People) || 0;
    if (level1Count === 0) return [];

    // The maximum levels is the MINIMUM between:
    // 1. Phase level itself (Phase 0 = 0 levels, Phase 1 = 1 level, Phase 2 = 2 levels, Phase 3 = 3 levels)
    // 2. Admin's visibleLevels configuration
    const maxLevelsByPhase = selectedPhase; // Phase number = max levels (NOT phase + 1)
    const maxLevelsByAdmin = config.visibleLevels;
    const maxLevels = Math.min(maxLevelsByPhase, maxLevelsByAdmin);

    const structure: { level: number; people: number }[] = [];

    // Level 1: User's input
    structure.push({ level: 1, people: level1Count });

    // Subsequent levels: Each person invites 2 more
    let previousLevelPeople = level1Count;
    for (let level = 2; level <= maxLevels; level++) {
      const people = previousLevelPeople * 2; // Each person from previous level invites 2
      structure.push({ level, people });
      previousLevelPeople = people;
    }

    return structure;
  };

  // Clear results and network fields when phase changes
  useEffect(() => {
    setResults([]);
    setTotalIncome(0);

    // Clear network fields if switching to Phase 0
    if (selectedPhase === 0) {
      setLevel1People("");
      setAverageSalesPerPerson("");
    }
  }, [selectedPhase]);

  // Load MLM configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/public/mlm-config');
        if (!response.ok) {
          throw new Error('Failed to load configuration');
        }
        const data: MLMConfig = await response.json();
        setConfig(data);

        // Set default phase to the first available level
        if (data.levels.length > 0) {
          setSelectedPhase(data.levels[0].level);
        }

        setError(null);
      } catch (err) {
        console.error('Error loading MLM config:', err);
        setError('No se pudo cargar la configuración. Por favor, intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const calculateIncome = () => {
    if (!config) return;

    const personal = parseFloat(personalSales) || 0;
    const avgSales = parseFloat(averageSalesPerPerson) || 0;
    const selectedLevel = config.levels.find((l) => l.level === selectedPhase);
    const personalCommissionRate = selectedLevel?.commissionRate || 0;
    const personalIncome = personal * personalCommissionRate;

    // Get network structure based on phase (automatic 2x duplication)
    const networkStructure = getNetworkStructure();
    
    // Check if user has minimum required people (at least 2 in Level 1)
    const level1Count = parseInt(level1People) || 0;
    const hasMinimumNetwork = level1Count >= 2;

    // Calculate income for each level
    const levelResults: LevelResult[] = networkStructure.map((struct) => {
      // Only calculate commissions if minimum network requirement is met
      // Commission from network sales (if they entered average sales)
      const networkCommission = hasMinimumNetwork && avgSales > 0 ? struct.people * avgSales * personalCommissionRate : 0;

      // Reward credits and free product value per person at this level (based on selected phase)
      // Only apply if minimum network requirement is met
      const rewardCreditsPerPerson = hasMinimumNetwork && includeRewardCredits ? (selectedLevel?.creditCents || 0) / 100 : 0;
      const freeProductValuePerPerson = hasMinimumNetwork && includeFreeProductValue ? (selectedLevel?.freeProductValueCents || 0) / 100 : 0;

      // Total rewards from all people at this level
      const rewardCredits = struct.people * rewardCreditsPerPerson;
      const freeProductValue = struct.people * freeProductValuePerPerson;

      // Total income from this level (network commission + optional rewards)
      const totalIncome = networkCommission + rewardCredits + freeProductValue;

      return {
        level: struct.level,
        name: `Nivel ${struct.level}`,
        people: struct.people,
        salesPerPerson: avgSales,
        commissionRate: personalCommissionRate,
        networkCommission,
        rewardCredits,
        freeProductValue,
        totalIncome,
      };
    });

    setResults(levelResults);
    const networkTotal = levelResults.reduce((sum, result) => sum + result.totalIncome, 0);
    setTotalIncome(personalIncome + networkTotal);
  };

  const calculateAffiliateEarnings = () => {
    if (!config) return;
    
    const sales = parseFloat(affiliateSales) || 0;
    
    if (sales <= 0) {
      setAffiliateResults(null);
      return;
    }
    
    const clientEarns = sales * config.affiliateCommissionRate;
    // Sponsor earnings = direct sponsor + general sponsor commissions
    const directSponsorEarns = sales * config.affiliateDirectSponsorCommissionRate;
    const generalSponsorEarns = sales * config.affiliateGeneralSponsorCommissionRate;
    const referrerEarns = directSponsorEarns + generalSponsorEarns;
    const totalSystem = clientEarns + referrerEarns;
    
    setAffiliateResults({
      clientEarnings: clientEarns,
      referrerEarnings: referrerEarns,
      totalSystemEarnings: totalSystem
    });
  };
  
  const resetAffiliateCalculator = () => {
    setAffiliateSales("");
    setAffiliateResults(null);
  };

  const resetCalculator = () => {
    setPersonalSales("");
    setAverageSalesPerPerson("");
    setLevel1People("");
    setSelectedPhase(config?.levels[0]?.level || 0);
    setResults([]);
    setTotalIncome(0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: config?.currency || 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="pt-6 flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
              <p className="text-muted-foreground">Cargando configuración...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>{error || 'Error al cargar la configuración'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Calculator className="h-12 w-12 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl">{dict.incomeCalculator.title}</CardTitle>
          <CardDescription>
            {dict.incomeCalculator.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="multilevel" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {dict.incomeCalculator.tabs.multilevel}
              </TabsTrigger>
              <TabsTrigger value="affiliate" className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                {dict.incomeCalculator.tabs.affiliate}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="multilevel" className="space-y-6 mt-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-emerald-700">{dict.incomeCalculator.multilevel.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {dict.incomeCalculator.multilevel.subtitle}
                </p>
              </div>
          {/* Personal Sales Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <h3 className="text-lg font-semibold">{dict.incomeCalculator.multilevel.initialConfig}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phase-select" className="font-semibold">{dict.incomeCalculator.multilevel.phaseLabel}</Label>
                <select
                  id="phase-select"
                  aria-label={dict.incomeCalculator.multilevel.phasePlaceholder}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={selectedPhase}
                  onChange={(e) => setSelectedPhase(parseInt(e.target.value))}
                  disabled={config.levels.length === 0}
                >
                  {config.levels.length === 0 ? (
                    <option value={0}>{dict.incomeCalculator.multilevel.noPhases}</option>
                  ) : (
                    config.levels.map((level) => (
                      <option key={level.level} value={level.level}>
                        Fase {level.level}: {level.nameEs} - {(level.commissionRate * 100).toFixed(1)}% comisión
                      </option>
                    ))
                  )}
                </select>
                <p className="text-xs text-muted-foreground">
                  {dict.incomeCalculator.multilevel.phaseHelp}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="personal-sales" className="font-semibold">{dict.incomeCalculator.multilevel.personalSalesLabel}</Label>
                <Input
                  id="personal-sales"
                  type="number"
                  placeholder="Ej: 500.00"
                  value={personalSales}
                  onChange={(e) => setPersonalSales(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {dict.incomeCalculator.multilevel.personalSalesHelp}
                </p>
              </div>
            </div>

            {/* Phase 0 Message - No network access */}
            {selectedPhase === 0 && (
              <Alert className="bg-amber-50 border-amber-300">
                <AlertDescription className="text-sm">
                  <p className="font-semibold text-amber-900 mb-1">
                    {dict.incomeCalculator.multilevel.phase0AlertTitle}
                  </p>
                  <p className="text-amber-800">
                    {dict.incomeCalculator.multilevel.phase0AlertBody}
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Level 1 People Count - Only show if phase > 0 */}
            {selectedPhase > 0 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="level1-people" className="font-semibold">{dict.incomeCalculator.multilevel.level1Label}</Label>
                  <Input
                    id="level1-people"
                    type="number"
                    min="0"
                    placeholder={dict.incomeCalculator.multilevel.level1Placeholder}
                    value={level1People}
                    onChange={(e) => setLevel1People(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {dict.incomeCalculator.multilevel.level1Help}
                  </p>
                </div>

                {/* Average Sales Per Person */}
                <div className="space-y-2">
                  <Label htmlFor="avg-sales" className="font-semibold">{dict.incomeCalculator.multilevel.avgSalesLabel}</Label>
                  <Input
                    id="avg-sales"
                    type="number"
                    placeholder={dict.incomeCalculator.multilevel.avgSalesPlaceholder}
                    value={averageSalesPerPerson}
                    onChange={(e) => setAverageSalesPerPerson(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {dict.incomeCalculator.multilevel.avgSalesHelp}
                  </p>
                </div>

                {/* Additional Benefits Options */}
                <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                  <Label className="font-semibold text-emerald-900">{dict.incomeCalculator.multilevel.benefitsLabel}</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="include-reward-credits"
                        checked={includeRewardCredits}
                        onChange={(e) => setIncludeRewardCredits(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <label htmlFor="include-reward-credits" className="text-sm font-medium text-emerald-900 cursor-pointer">
                        {dict.incomeCalculator.multilevel.benefitsLabel.replace('5. ', '')} {lang === 'es' ? config.rewardCreditLabelEs : config.rewardCreditLabelEn}
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="include-free-product"
                        checked={includeFreeProductValue}
                        onChange={(e) => setIncludeFreeProductValue(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <label htmlFor="include-free-product" className="text-sm font-medium text-emerald-900 cursor-pointer">
                        {dict.incomeCalculator.multilevel.benefitsLabel.replace('5. ', '')} {lang === 'es' ? config.freeProductLabelEs : config.freeProductLabelEn}
                      </label>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-700">
                    {dict.incomeCalculator.multilevel.benefitsHelp}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Network Structure Preview - Only show if phase > 0 */}
          {selectedPhase > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600" />
                <h3 className="text-lg font-semibold">{dict.incomeCalculator.multilevel.networkStructure}</h3>
              </div>

              {parseInt(level1People) === 1 && (
                <Alert className="bg-amber-50 border-amber-300">
                  <AlertDescription className="text-amber-900">
                    <p className="font-semibold mb-2">⚠️ {lang === 'es' ? 'Requisito Mínimo para Activar Comisiones' : 'Minimum Requirement to Activate Commissions'}</p>
                    <p className="text-sm">
                      {lang === 'es' 
                        ? 'Para comenzar a recibir comisiones en tu red multinivel, necesitas invitar al menos 2 personas con suscripción activa. Con solo 1 persona, aún no calificas para recibir ganancias del sistema.'
                        : 'To start receiving commissions in your multilevel network, you need to invite at least 2 people with active subscriptions. With only 1 person, you do not yet qualify to receive earnings from the system.'}
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {parseInt(level1People) > 0 ? (
              <Alert className="bg-gradient-to-r from-blue-50 to-emerald-50 border-2 border-blue-300">
                <AlertDescription>
                  <div className="space-y-3">
                    <p className="font-semibold text-blue-900 text-base">
                      📊 Estructura Calculada de tu Red en Fase {selectedPhase}
                    </p>

                    <div className="bg-white/80 rounded-lg p-4 space-y-2">
                      <p className="text-sm font-medium text-gray-700">
                        Duplicación Automática (cada persona invita a 2):
                      </p>
                      {getNetworkStructure().map((struct, index) => {
                        return (
                          <div key={struct.level} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                                {struct.level}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  Nivel {struct.level}
                                  {struct.level === 1 && <span className="ml-2 text-xs text-blue-600">(Tu input)</span>}
                                  {struct.level > 1 && <span className="ml-2 text-xs text-emerald-600">(Calculado: {getNetworkStructure()[index - 1]?.people} × 2)</span>}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {struct.level === 1 ? 'Tus invitados directos' : `Invitados por Nivel ${struct.level - 1}`}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-emerald-700 text-lg">
                                {struct.people} {struct.people === 1 ? 'persona' : 'personas'}
                              </p>
                            </div>
                          </div>
                        );
                      })}

                      <div className="mt-3 pt-3 border-t-2 border-emerald-300">
                        <div className="flex justify-between items-center">
                          <p className="font-semibold text-gray-900">Total en tu red:</p>
                          <p className="text-2xl font-bold text-emerald-700">
                            {getNetworkStructure().reduce((sum, s) => sum + s.people, 0)} personas
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-blue-700 mt-2">
                      💡 <strong>Cálculo automático:</strong>
                      {(() => {
                        const maxByPhase = selectedPhase; // Phase number = max levels
                        const maxByAdmin = config.visibleLevels;
                        const actualMax = Math.min(maxByPhase, maxByAdmin);

                        if (maxByPhase > maxByAdmin) {
                          return (
                            <span>
                              {' '}Tu Fase {selectedPhase} permite hasta {maxByPhase} {maxByPhase === 1 ? 'nivel' : 'niveles'}, pero el sistema está configurado para mostrar hasta {maxByAdmin} {maxByAdmin === 1 ? 'nivel' : 'niveles'}.
                            </span>
                          );
                        } else if (maxByPhase < maxByAdmin) {
                          return (
                            <span>
                              {' '}En Fase {selectedPhase} ganas de {actualMax} {actualMax === 1 ? 'nivel' : 'niveles'} de profundidad.
                              <span className="block mt-1">
                                Avanza a fases superiores para desbloquear más niveles (hasta {maxByAdmin} niveles).
                              </span>
                            </span>
                          );
                        } else {
                          return <span> En Fase {selectedPhase} ganas de {actualMax} {actualMax === 1 ? 'nivel' : 'niveles'} de profundidad.</span>;
                        }
                      })()}
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
              ) : (
                <Alert className="bg-gray-50 border-gray-300">
                  <AlertDescription className="text-sm text-gray-600">
                    👆 Ingresa cuántas personas invitaste directamente (Nivel 1) para ver la estructura completa de tu red calculada automáticamente.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="flex gap-4">
            <Button onClick={calculateIncome} className="flex-1">
              {dict.incomeCalculator.multilevel.calculateButton}
            </Button>
            <Button onClick={resetCalculator} variant="outline" className="flex-1">
              {dict.incomeCalculator.multilevel.resetButton}
            </Button>
          </div>

          {/* Results Section */}
          {totalIncome > 0 && (
            <div className="space-y-4">
              <Card className="bg-emerald-50 border-emerald-200">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center space-x-2">
                    <DollarSign className="h-8 w-8 text-emerald-600" />
                    <div className="text-center">
                      <p className="text-sm text-emerald-600">{dict.incomeCalculator.multilevel.estimatedIncome}</p>
                      <p className="text-3xl font-bold text-emerald-700">
                        {formatCurrency(totalIncome)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Breakdown by Level */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{dict.incomeCalculator.multilevel.breakdown}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Personal Sales */}
                    {parseFloat(personalSales) > 0 && (
                      <div className="flex justify-between items-center p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                        <div>
                          <p className="font-semibold text-blue-900">{dict.incomeCalculator.multilevel.personalSalesBreakdown}</p>
                          <p className="text-sm text-blue-700">
                            {formatCurrency(parseFloat(personalSales))} × {(config.levels.find(l => l.level === selectedPhase)?.commissionRate || 0) * 100}% comisión
                          </p>
                        </div>
                        <p className="text-xl font-bold text-blue-700">
                          {formatCurrency(parseFloat(personalSales) * (config.levels.find(l => l.level === selectedPhase)?.commissionRate || 0))}
                        </p>
                      </div>
                    )}

                    {/* Network Levels */}
                    {results.length > 0 && results.map((result) => (
                      <div key={result.level} className="flex justify-between items-center p-4 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
                        <div className="flex-1">
                          <p className="font-semibold text-emerald-900">
                            👥 Nivel {result.level} - {result.name}
                          </p>
                          <div className="text-sm text-emerald-700 mt-1 space-y-0.5">
                            <p>
                              • {result.people} {result.people === 1 ? 'persona' : 'personas'} en tu red
                            </p>
                            {result.networkCommission > 0 && (
                              <p>
                                • Comisión por sus ventas: {formatCurrency(result.networkCommission)}
                              </p>
                            )}
                            {result.rewardCredits > 0 && (
                              <p>
                                • {lang === 'es' ? config.rewardCreditLabelEs : config.rewardCreditLabelEn}: {formatCurrency(result.rewardCredits)}
                              </p>
                            )}
                            {result.freeProductValue > 0 && (
                              <p>
                                • {lang === 'es' ? config.freeProductLabelEs : config.freeProductLabelEn}: {formatCurrency(result.freeProductValue)}
                              </p>
                            )}
                          </div>
                        </div>
                        <p className="text-xl font-bold text-emerald-700 ml-4">
                          {formatCurrency(result.totalIncome)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
            </TabsContent>
            
            <TabsContent value="affiliate" className="space-y-6 mt-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-blue-700">{dict.incomeCalculator.affiliate.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {dict.incomeCalculator.affiliate.subtitle}
                </p>
              </div>
              
              {/* Affiliate System Content */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">{dict.incomeCalculator.affiliate.configTitle}</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="affiliate-sales" className="font-semibold">{dict.incomeCalculator.affiliate.salesLabel}</Label>
                    <Input
                      id="affiliate-sales"
                      type="number"
                      placeholder="Ej: 1000.00"
                      value={affiliateSales}
                      onChange={(e) => setAffiliateSales(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {dict.incomeCalculator.affiliate.salesHelp}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="font-semibold">{dict.incomeCalculator.affiliate.affiliateCommissionLabel}</Label>
                    <div className="p-3 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
                      <p className="text-2xl font-bold text-emerald-700">
                        {config ? (config.affiliateCommissionRate * 100).toFixed(1) : '0.0'}%
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dict.incomeCalculator.affiliate.affiliateCommissionHelp}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="font-semibold">{dict.incomeCalculator.affiliate.referrerCommissionLabel}</Label>
                  <div className="p-3 bg-orange-50 border-2 border-orange-200 rounded-lg">
                    <p className="text-2xl font-bold text-orange-700">
                      {config ? ((config.affiliateDirectSponsorCommissionRate + config.affiliateGeneralSponsorCommissionRate) * 100).toFixed(1) : '0.0'}%
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dict.incomeCalculator.affiliate.referrerCommissionHelp}
                  </p>
                </div>
                
                <Alert className="bg-blue-50 border-blue-300">
                  <AlertDescription className="text-sm text-blue-800">
                    <p className="font-semibold text-blue-900 mb-1">
                      {dict.incomeCalculator.affiliate.infoAlertTitle}
                    </p>
                    <p>
                      {dict.incomeCalculator.affiliate.infoAlertBody1}<br/>
                      {dict.incomeCalculator.affiliate.infoAlertBody2}<br/>
                      {dict.incomeCalculator.affiliate.infoAlertBody3}
                    </p>
                  </AlertDescription>
                </Alert>
                
                <div className="flex gap-4">
                  <Button onClick={calculateAffiliateEarnings} className="flex-1">
                    {dict.incomeCalculator.affiliate.calculateButton}
                  </Button>
                  <Button onClick={resetAffiliateCalculator} variant="outline" className="flex-1">
                    {dict.incomeCalculator.multilevel.resetButton}
                  </Button>
                </div>
                
                {/* Affiliate Results */}
                {affiliateResults && (
                  <div className="space-y-4">
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-center space-x-2">
                          <DollarSign className="h-8 w-8 text-blue-600" />
                          <div className="text-center">
                            <p className="text-sm text-blue-600">{dict.incomeCalculator.affiliate.totalSystemEarnings}</p>
                            <p className="text-3xl font-bold text-blue-700">
                              {formatCurrency(affiliateResults.totalSystemEarnings)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{dict.incomeCalculator.affiliate.breakdownTitle}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                            <div>
                              <p className="font-semibold text-green-900">{dict.incomeCalculator.affiliate.affiliateEarnings}</p>
                              <p className="text-sm text-green-700">
                                {formatCurrency(parseFloat(affiliateSales))} × {config ? (config.affiliateCommissionRate * 100).toFixed(1) : '0.0'}% comisión
                              </p>
                            </div>
                            <p className="text-xl font-bold text-green-700">
                              {formatCurrency(affiliateResults.clientEarnings)}
                            </p>
                          </div>
                          
                          <div className="flex justify-between items-center p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
                            <div>
                              <p className="font-semibold text-orange-900">{dict.incomeCalculator.affiliate.referrerEarnings}</p>
                              <p className="text-sm text-orange-700">
                                {formatCurrency(parseFloat(affiliateSales))} × {config ? ((config.affiliateDirectSponsorCommissionRate + config.affiliateGeneralSponsorCommissionRate) * 100).toFixed(1) : '0.0'}% comisión
                              </p>
                            </div>
                            <p className="text-xl font-bold text-orange-700">
                              {formatCurrency(affiliateResults.referrerEarnings)}
                            </p>
                          </div>
                          
                          <div className="mt-4 p-4 bg-gray-50 border-2 border-gray-200 rounded-lg">
                            <div className="flex justify-between items-center">
                              <p className="font-semibold text-gray-900">{dict.incomeCalculator.affiliate.summaryTitle}</p>
                              <div className="text-right">
                                <p className="text-sm text-gray-600">{dict.incomeCalculator.affiliate.totalSales.replace('{{amount}}', formatCurrency(parseFloat(affiliateSales)))}</p>
                                <p className="text-sm text-gray-600">{dict.incomeCalculator.affiliate.affiliateRate.replace('{{rate}}', config ? (config.affiliateCommissionRate * 100).toFixed(1) : '0.0')}</p>
                                <p className="text-sm text-gray-600">{dict.incomeCalculator.affiliate.referrerRate.replace('{{rate}}', config ? ((config.affiliateDirectSponsorCommissionRate + config.affiliateGeneralSponsorCommissionRate) * 100).toFixed(1) : '0.0')}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}