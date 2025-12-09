'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Script from 'next/script';

interface CaptchaWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

interface CaptchaConfig {
  enabled: boolean;
  provider: 'recaptcha_v2' | 'recaptcha_v3' | 'hcaptcha' | 'turnstile' | null;
  siteKey: string | null;
}

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      render: (container: string | HTMLElement, params: any) => number;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      reset: (widgetId?: number) => void;
    };
    hcaptcha?: {
      render: (container: string | HTMLElement, params: any) => string;
      execute: (widgetId: string) => Promise<{ response: string }>;
      reset: (widgetId?: string) => void;
    };
    turnstile?: {
      render: (container: string | HTMLElement, params: any) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

export function CaptchaWidget({ onVerify, onError, onExpire }: CaptchaWidgetProps) {
  const [config, setConfig] = useState<CaptchaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | number | null>(null);

  // Fetch CAPTCHA configuration
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/auth/captcha-config');
        const data = await response.json();
        setConfig(data);
      } catch (error) {
        console.error('[CaptchaWidget] Error fetching config:', error);
        setConfig({ enabled: false, provider: null, siteKey: null });
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  // Render CAPTCHA widget when script is loaded
  useEffect(() => {
    if (!scriptLoaded || !config?.enabled || !config.siteKey || !containerRef.current) {
      return;
    }

    const renderWidget = () => {
      if (!containerRef.current) return;

      try {
        switch (config.provider) {
          case 'recaptcha_v2':
            if (window.grecaptcha) {
              window.grecaptcha.ready(() => {
                if (!containerRef.current) return;
                widgetIdRef.current = window.grecaptcha!.render(containerRef.current, {
                  sitekey: config.siteKey!,
                  callback: onVerify,
                  'error-callback': onError,
                  'expired-callback': onExpire,
                });
              });
            }
            break;

          case 'recaptcha_v3':
            // reCAPTCHA v3 executes automatically on form submit
            // We'll handle this in the parent component
            break;

          case 'hcaptcha':
            if (window.hcaptcha) {
              widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
                sitekey: config.siteKey!,
                callback: onVerify,
                'error-callback': onError,
                'expired-callback': onExpire,
              });
            }
            break;

          case 'turnstile':
            if (window.turnstile) {
              widgetIdRef.current = window.turnstile.render(containerRef.current, {
                sitekey: config.siteKey!,
                callback: onVerify,
                'error-callback': onError,
                'expired-callback': onExpire,
              });
            }
            break;
        }
      } catch (error) {
        console.error('[CaptchaWidget] Error rendering widget:', error);
        onError?.();
      }
    };

    renderWidget();

    // Cleanup
    return () => {
      if (widgetIdRef.current !== null) {
        try {
          switch (config.provider) {
            case 'recaptcha_v2':
              window.grecaptcha?.reset(widgetIdRef.current as number);
              break;
            case 'hcaptcha':
              window.hcaptcha?.reset(widgetIdRef.current as string);
              break;
            case 'turnstile':
              window.turnstile?.reset(widgetIdRef.current as string);
              break;
          }
        } catch (error) {
          console.error('[CaptchaWidget] Error resetting widget:', error);
        }
      }
    };
  }, [scriptLoaded, config, onVerify, onError, onExpire]);

  // Execute reCAPTCHA v3 programmatically
  const executeRecaptchaV3 = useCallback(async (action: string = 'submit'): Promise<string | null> => {
    if (config?.provider !== 'recaptcha_v3' || !config.siteKey) {
      return null;
    }

    try {
      if (window.grecaptcha) {
        return await window.grecaptcha.execute(config.siteKey, { action });
      }
    } catch (error) {
      console.error('[CaptchaWidget] Error executing reCAPTCHA v3:', error);
      onError?.();
    }

    return null;
  }, [config, onError]);

  // Expose execute method for reCAPTCHA v3
  useEffect(() => {
    if (config?.provider === 'recaptcha_v3' && scriptLoaded) {
      (window as any).__executeRecaptchaV3 = executeRecaptchaV3;
    }
  }, [config, scriptLoaded, executeRecaptchaV3]);

  if (loading) {
    return <div className="h-[78px]" />; // Placeholder height
  }

  if (!config?.enabled) {
    return null;
  }

  const getScriptUrl = () => {
    switch (config.provider) {
      case 'recaptcha_v2':
        return `https://www.google.com/recaptcha/api.js?render=explicit`;
      case 'recaptcha_v3':
        return `https://www.google.com/recaptcha/api.js?render=${config.siteKey}`;
      case 'hcaptcha':
        return 'https://js.hcaptcha.com/1/api.js';
      case 'turnstile':
        return 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      default:
        return null;
    }
  };

  const scriptUrl = getScriptUrl();

  return (
    <>
      {scriptUrl && (
        <Script
          src={scriptUrl}
          onLoad={() => setScriptLoaded(true)}
          onError={() => {
            console.error('[CaptchaWidget] Failed to load CAPTCHA script');
            onError?.();
          }}
        />
      )}
      {config.provider !== 'recaptcha_v3' && (
        <div ref={containerRef} className="flex justify-center" />
      )}
    </>
  );
}

// Hook for using CAPTCHA in forms
export function useCaptcha() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [config, setConfig] = useState<CaptchaConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch CAPTCHA configuration on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/auth/captcha-config');
        const data = await response.json();
        setConfig(data);
      } catch (_error) {
        console.error('[useCaptcha] Error fetching config:', _error);
        setConfig({ enabled: false, provider: null, siteKey: null });
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleVerify = (captchaToken: string) => {
    setToken(captchaToken);
    setError(false);
  };

  const handleError = () => {
    setToken(null);
    setError(true);
  };

  const handleExpire = () => {
    setToken(null);
  };

  const executeV3 = async (action: string = 'submit'): Promise<string | null> => {
    // If CAPTCHA is not enabled, return empty string (not null) to indicate "no CAPTCHA needed"
    if (!config?.enabled) {
      return '';
    }

    // If it's reCAPTCHA v3, execute it
    if (config.provider === 'recaptcha_v3') {
      if (typeof window !== 'undefined' && (window as any).__executeRecaptchaV3) {
        const token = await (window as any).__executeRecaptchaV3(action);
        setToken(token);
        return token;
      }
    }

    // For other providers or if v3 is not ready, return current token
    return token;
  };

  return {
    token,
    error,
    isLoading,
    isEnabled: config?.enabled ?? false,
    provider: config?.provider ?? null,
    handleVerify,
    handleError,
    handleExpire,
    executeV3,
    reset: () => {
      setToken(null);
      setError(false);
    },
  };
}
