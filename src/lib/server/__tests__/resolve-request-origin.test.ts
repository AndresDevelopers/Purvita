import { afterEach, describe, expect, it } from 'vitest';
import { resolveRequestOrigin } from '../resolve-request-origin';

const createHeaders = (values: Record<string, string | undefined>): Headers => {
    const headers = new Headers();

    for (const [key, value] of Object.entries(values)) {
        if (value !== undefined) {
            headers.set(key, value);
        }
    }

    return headers;
};

const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
    if (ORIGINAL_SITE_URL === undefined) {
        delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
        process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;
    }
});

describe('resolveRequestOrigin', () => {
    it('derives the origin from request headers when no configuration exists', () => {
        delete process.env.NEXT_PUBLIC_SITE_URL;

        const headers = createHeaders({
            'x-forwarded-proto': 'https',
            host: 'admin.example.com',
        });

        expect(resolveRequestOrigin(headers)).toBe('https://admin.example.com');
    });

    it('prefers the origin header when provided by the browser', () => {
        process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:9000';

        const headers = createHeaders({
            origin: 'https://admin.production.example',
            'x-forwarded-proto': 'https',
            host: 'localhost:3000',
        });

        expect(resolveRequestOrigin(headers)).toBe('https://admin.production.example');
    });

    it('falls back to forwarded headers when the origin header is invalid', () => {
        delete process.env.NEXT_PUBLIC_SITE_URL;

        const headers = createHeaders({
            origin: 'not-a-valid-origin',
            'x-forwarded-proto': 'https',
            host: 'admin.example.com',
        });

        expect(resolveRequestOrigin(headers)).toBe('https://admin.example.com');
    });

    it('always prioritizes request headers over configured URL', () => {
        process.env.NEXT_PUBLIC_SITE_URL = 'https://configured.example.com/app';

        const headers = createHeaders({
            'x-forwarded-proto': 'https',
            host: 'actual-request.example.com',
        });

        // Should use the actual request host, not the configured URL
        expect(resolveRequestOrigin(headers)).toBe('https://actual-request.example.com');
    });

    it('uses configured URL only as fallback when headers are unavailable', () => {
        process.env.NEXT_PUBLIC_SITE_URL = 'https://fallback.example.com';

        const headers = createHeaders({
            // No headers provided
        });

        expect(resolveRequestOrigin(headers)).toBe('https://fallback.example.com');
    });

    it('detects different ports from request headers', () => {
        process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';

        const headers = createHeaders({
            'x-forwarded-proto': 'http',
            host: 'localhost:9002',
        });

        // Should use the actual port from headers (9002), not configured (3000)
        expect(resolveRequestOrigin(headers)).toBe('http://localhost:9002');
    });
});
