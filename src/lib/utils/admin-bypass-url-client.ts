/**
 * Client-side Admin Bypass URL Configuration
 * 
 * This is the client-side version that reads from NEXT_PUBLIC_ADMIN_BYPASS_URL
 * since client components cannot access server-only environment variables.
 */

/**
 * Gets the configured admin bypass URL path segment (client-side)
 * @returns The URL path segment (without leading/trailing slashes)
 * @default 'purvitaadmin'
 */
export function getAdminBypassUrlClient(): string {
    const configuredUrl = process.env.NEXT_PUBLIC_ADMIN_BYPASS_URL;

    if (!configuredUrl) {
        return 'purvitaadmin'; // Default fallback
    }

    // Sanitize the URL: remove leading/trailing slashes and spaces
    const sanitized = configuredUrl.trim().replace(/^\/+|\/+$/g, '');

    // Validate format: only lowercase letters, numbers, and hyphens
    if (!/^[a-z0-9-]+$/.test(sanitized)) {
        console.warn(
            `[Admin Bypass] Invalid NEXT_PUBLIC_ADMIN_BYPASS_URL format: "${configuredUrl}". ` +
            'Using default "purvitaadmin". Only lowercase letters, numbers, and hyphens are allowed.'
        );
        return 'purvitaadmin';
    }

    return sanitized;
}

/**
 * Gets the full admin bypass URL for a specific language (client-side)
 * @param lang - The language code (e.g., 'en', 'es')
 * @returns The full bypass URL path (e.g., '/en/purvitaadmin')
 */
export function getAdminBypassUrlForLangClient(lang: string): string {
    const bypassUrl = getAdminBypassUrlClient();
    return `/${lang}/${bypassUrl}`;
}
