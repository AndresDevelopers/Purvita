import { useState, useEffect } from 'react';

interface AvailableDatesResponse {
  dates: string[];
}

export const useAvailableDates = () => {
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchAvailableDates = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/admin/orders/available-dates', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          credentials: 'same-origin',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch available dates');
        }

        const data: AvailableDatesResponse = await response.json();
        setAvailableDates(data.dates);
      } catch (err) {
        console.error('[useAvailableDates] Error fetching available dates:', err);
        setError(err as Error);
        setAvailableDates([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchAvailableDates();
  }, []);

  return { availableDates, loading, error };
};

