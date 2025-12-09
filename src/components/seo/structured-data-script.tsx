import { structuredDataToSafeJSON } from '@/lib/utils/structured-data-sanitizer';

interface StructuredDataScriptProps {
  json?: string | Record<string, unknown> | null;
  data?: Record<string, unknown>;
}

/**
 * Structured Data Script Component
 *
 * Renders JSON-LD structured data with automatic sanitization
 * to prevent XSS attacks.
 *
 * @param json - Pre-stringified JSON (will be sanitized)
 * @param data - Structured data object (preferred - will be validated and sanitized)
 *
 * @example
 * ```tsx
 * // Preferred: Pass object directly
 * <StructuredDataScript data={{
 *   "@context": "https://schema.org",
 *   "@type": "Product",
 *   "name": "Product Name"
 * }} />
 *
 * // Alternative: Pass pre-stringified JSON
 * <StructuredDataScript json={JSON.stringify(data)} />
 * ```
 */
export function StructuredDataScript({ json, data }: StructuredDataScriptProps) {
  let safeJson: string | null = null;

  try {
    if (data) {
      // Preferred: Validate and sanitize object
      safeJson = structuredDataToSafeJSON(data);
    } else if (json) {
      // Handle both string and object types
      if (typeof json === 'string') {
        const parsed = JSON.parse(json);
        safeJson = structuredDataToSafeJSON(parsed);
      } else {
        // json is already an object
        safeJson = structuredDataToSafeJSON(json);
      }
    }
  } catch (error) {
    console.error('Invalid structured data:', error);
    return null;
  }

  if (!safeJson) {
    return null;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJson }}
      suppressHydrationWarning
    />
  );
}
