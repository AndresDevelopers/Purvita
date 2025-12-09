'use client';

import { useState, useEffect } from 'react';

interface UploadLimits {
  max_image_size_mb: number;
  max_avatar_size_mb: number;
}

const DEFAULT_LIMITS: UploadLimits = {
  max_image_size_mb: 5,
  max_avatar_size_mb: 2,
};

/**
 * Hook para obtener los límites de upload configurados
 * @returns Los límites de upload y funciones helper
 */
export function useUploadLimits() {
  const [limits, setLimits] = useState<UploadLimits>(DEFAULT_LIMITS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    
    const fetchLimits = async () => {
      try {
        const response = await fetch('/api/admin/upload-limits', {
          signal: controller.signal
        });
        
        if (response.ok) {
          const data = await response.json();
          setLimits({
            max_image_size_mb: data.config.max_image_size_mb ?? DEFAULT_LIMITS.max_image_size_mb,
            max_avatar_size_mb: data.config.max_avatar_size_mb ?? DEFAULT_LIMITS.max_avatar_size_mb,
          });
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.warn('[useUploadLimits] Failed to fetch limits, using defaults');
      } finally {
        setLoading(false);
      }
    };

    fetchLimits();
    
    return () => {
      controller.abort();
    };
  }, []);

  /**
   * Valida si un archivo de imagen cumple con el límite de tamaño
   */
  const validateImageSize = (file: File): { valid: boolean; error?: string } => {
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > limits.max_image_size_mb) {
      return {
        valid: false,
        error: `El archivo excede el límite de ${limits.max_image_size_mb} MB`,
      };
    }
    return { valid: true };
  };

  /**
   * Valida si un archivo de avatar cumple con el límite de tamaño
   */
  const validateAvatarSize = (file: File): { valid: boolean; error?: string } => {
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > limits.max_avatar_size_mb) {
      return {
        valid: false,
        error: `El archivo excede el límite de ${limits.max_avatar_size_mb} MB`,
      };
    }
    return { valid: true };
  };

  /**
   * Genera texto descriptivo para el límite de imagen
   */
  const getImageLimitText = (): string => {
    return `Máximo ${limits.max_image_size_mb} MB`;
  };

  /**
   * Genera texto descriptivo para el límite de avatar
   */
  const getAvatarLimitText = (): string => {
    return `Máximo ${limits.max_avatar_size_mb} MB`;
  };

  return {
    limits,
    loading,
    validateImageSize,
    validateAvatarSize,
    getImageLimitText,
    getAvatarLimitText,
  };
}
