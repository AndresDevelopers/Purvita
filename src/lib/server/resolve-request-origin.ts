const DEVELOPMENT_PROTOCOL = 'http';
const PRODUCTION_PROTOCOL = 'https';

/**
 * Attempts to normalize a configured public site URL into an URL instance.
 * When the provided value is invalid, the function logs the failure and
 * gracefully falls back to resolving the origin from the incoming request.
 */
const resolveConfiguredOrigin = (configuredUrl?: string | null): URL | null => {
    if (!configuredUrl) {
        return null;
    }

    try {
        return new URL(configuredUrl);
    } catch (error) {
        console.error('Invalid NEXT_PUBLIC_SITE_URL provided. Ignoring value.', error);
        return null;
    }
};

/**
 * Ensures the protocol always returns a valid value even when headers omit it.
 */
const normalizeProtocol = (proto?: string | null): string => {
    if (!proto) {
        return process.env.NODE_ENV === 'development'
            ? DEVELOPMENT_PROTOCOL
            : PRODUCTION_PROTOCOL;
    }

    return proto.replace(/:$/, '');
};

const pickFirstForwardedValue = (value?: string | null): string | null => {
    if (!value) {
        return null;
    }

    const [first] = value.split(',');
    const normalized = first?.trim();

    return normalized && normalized.length > 0 ? normalized : null;
};

/**
 * Resolves the request host by prioritising the forwarded values set by reverse
 * proxies (Vercel, Nginx, etc.) and gracefully falling back to the standard
 * host header or Vercel specific environment configuration.
 */
type HeaderLike = Pick<Headers, 'get'>;

const resolveForwardedHost = (headerList: HeaderLike): string | null => {
    const forwardedHost = pickFirstForwardedValue(headerList.get('x-forwarded-host'));

    if (forwardedHost) {
        return forwardedHost;
    }

    const host = pickFirstForwardedValue(headerList.get('host'));

    if (host) {
        return host;
    }

    return pickFirstForwardedValue(process.env.VERCEL_URL) ?? null;
};

const _extractHostname = (host: string): string => {
    const trimmed = host.trim();

    if (!trimmed) {
        return trimmed;
    }

    if (trimmed.startsWith('[')) {
        const closingIndex = trimmed.indexOf(']');
        return closingIndex > 1 ? trimmed.slice(1, closingIndex) : trimmed;
    }

    const separatorIndex = trimmed.indexOf(':');
    return separatorIndex === -1 ? trimmed : trimmed.slice(0, separatorIndex);
};

const _isLoopbackHostname = (hostname: string): boolean => {
    const normalized = hostname.toLowerCase();

    return normalized === 'localhost'
        || normalized === '127.0.0.1'
        || normalized === '::1';
};

/**
 * Determines the absolute origin for server-side fetch calls so they function
 * consistently across development and production environments.
 *
 * This function automatically detects the origin from request headers and only
 * uses NEXT_PUBLIC_SITE_URL as a fallback when headers are not available.
 */
export const resolveRequestOrigin = (headerList: HeaderLike): string => {
    const originHeader = pickFirstForwardedValue(headerList.get('origin'));

    let derivedOrigin: string;

    if (originHeader) {
        try {
            const parsedOrigin = new URL(originHeader);
            derivedOrigin = parsedOrigin.origin;
        } catch (error) {
            console.warn('Invalid origin header received. Falling back to forwarded host.', error);

            const forwardedProto = pickFirstForwardedValue(headerList.get('x-forwarded-proto'));
            const protocol = normalizeProtocol(forwardedProto);
            const host = resolveForwardedHost(headerList);

            if (!host) {
                throw new Error('Unable to resolve host from request headers.');
            }

            const cleanedHost = host.trim();
            derivedOrigin = `${protocol}://${cleanedHost}`;
        }
    } else {
        const forwardedProto = pickFirstForwardedValue(headerList.get('x-forwarded-proto'));
        const protocol = normalizeProtocol(forwardedProto);
        const host = resolveForwardedHost(headerList);

        if (!host) {
            // Only use configured origin as fallback when headers are completely unavailable
            const configuredOrigin = resolveConfiguredOrigin(process.env.NEXT_PUBLIC_SITE_URL);
            if (configuredOrigin) {
                return configuredOrigin.origin;
            }
            throw new Error('Unable to resolve host from request headers.');
        }

        const cleanedHost = host.trim();
        derivedOrigin = `${protocol}://${cleanedHost}`;
    }

    // Always return the origin derived from request headers
    // This ensures the system uses the actual URL the user is accessing
    return derivedOrigin;
};

