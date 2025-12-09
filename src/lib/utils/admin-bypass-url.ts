/**
 * Admin Bypass URL Configuration
 *
 * Provides utilities to get the configured admin bypass URL from environment variables.
 * This allows administrators to customize the URL path used to access the admin panel
 * during maintenance or coming soon modes.
 *
 * ✅ SIMPLIFIED: Solo necesitas configurar NEXT_PUBLIC_ADMIN_BYPASS_URL
 * Esta variable funciona tanto en el servidor como en el cliente.
 */

/**
 * Gets the configured admin bypass URL path segment
 * @returns The URL path segment (without leading/trailing slashes)
 * @default 'purvitaadmin'
 */
export function getAdminBypassUrl(): string {
    // ✅ SIMPLIFIED: Solo usa NEXT_PUBLIC_ADMIN_BYPASS_URL
    // Funciona en servidor y cliente
    const configuredUrl = process.env.NEXT_PUBLIC_ADMIN_BYPASS_URL;

    if (!configuredUrl) {
        return 'purvitaadmin'; // Default fallback
    }

    // Sanitize the URL: remove leading/trailing slashes and spaces
    const sanitized = configuredUrl.trim().replace(/^\/+|\/+$/g, '');

    // Validate format: only lowercase letters, numbers, and hyphens
    if (!/^[a-z0-9-]+$/.test(sanitized)) {
        console.warn(
            `[Admin Bypass] Invalid ADMIN_BYPASS_URL format: "${configuredUrl}". ` +
            'Using default "purvitaadmin". Only lowercase letters, numbers, and hyphens are allowed.'
        );
        return 'purvitaadmin';
    }

    return sanitized;
}

/**
 * Gets the full admin bypass URL for a specific language
 * @param lang - The language code (e.g., 'en', 'es')
 * @returns The full bypass URL path (e.g., '/en/purvitaadmin')
 */
export function getAdminBypassUrlForLang(lang: string): string {
    const bypassUrl = getAdminBypassUrl();
    return `/${lang}/${bypassUrl}`;
}

/**
 * Checks if the current pathname matches the admin bypass URL pattern
 * @param pathname - The current pathname to check
 * @returns true if the pathname matches the bypass URL pattern
 */
export function isAdminBypassUrl(pathname: string): boolean {
    const bypassUrl = getAdminBypassUrl();
    const pattern = new RegExp(`^/[a-z]{2}/${bypassUrl}(/.*)?$`);
    return pattern.test(pathname);
}
