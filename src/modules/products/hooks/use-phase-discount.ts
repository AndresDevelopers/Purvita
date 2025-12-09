import { useState, useEffect } from 'react';

export interface PhaseGroupGainInfo {
  userPhase: number;
  gainRate: number;
  gainPercentage: number;
}

/**
 * Hook para obtener la ganancia de grupo que el patrocinador recibe por las compras
 * generadas por el usuario autenticado. La información proviene del endpoint
 * `/api/products/user-discount` y solo se usa con fines informativos en la UI.
 */
export function usePhaseDiscount() {
  const [discountInfo, setDiscountInfo] = useState<PhaseGroupGainInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    const fetchDiscount = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/products/user-discount', {
          cache: 'no-store',
        });

        if (!response.ok) {
          if (response.status === 401) {
            // User not authenticated - no discount
            if (!ignore) {
              setDiscountInfo(null);
            }
            return;
          }
          throw new Error('Failed to fetch discount information');
        }

        const data = await response.json();
        
        if (!ignore) {
          if (data.gainPercentage > 0) {
            setDiscountInfo({
              userPhase: data.userPhase,
              gainRate: data.gainRate,
              gainPercentage: data.gainPercentage,
            });
          } else {
            setDiscountInfo(null);
          }
        }
      } catch (err) {
        if (!ignore) {
          console.error('[usePhaseDiscount] Error fetching discount:', err);
          setError(err instanceof Error ? err.message : 'Unknown error');
          setDiscountInfo(null);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    fetchDiscount();

    return () => {
      ignore = true;
    };
  }, []);

  return {
    discountInfo,
    isLoading,
    error,
    hasDiscount: discountInfo !== null && discountInfo.gainPercentage > 0,
  };
}

