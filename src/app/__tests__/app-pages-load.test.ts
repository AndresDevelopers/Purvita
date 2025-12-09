import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, test, vi } from 'vitest';

// Provide stable environment configuration for modules that read environment variables at import time.
beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'public-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'service-role-key';
  process.env.PRODUCTS_BUCKET = process.env.PRODUCTS_BUCKET ?? 'products';
});

// Core framework mocks to keep server/client specific helpers from throwing when imported in Vitest.
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  useParams: () => ({}),
}));

vi.mock('next/headers', () => ({
  headers: () => new Headers(),
  cookies: () => ({
    get: vi.fn(),
    getAll: vi.fn(() => []),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: <T extends (...args: any[]) => any>(fn: T) => fn,
  cache: <T extends (...args: any[]) => any>(fn: T) => fn,
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    cache: (actual as any).cache ?? ((fn: (...args: any[]) => any) => fn),
  };
});

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      signOut: vi.fn(async () => undefined),
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        remove: vi.fn(),
        list: vi.fn(),
      })),
    },
  })),
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      signOut: vi.fn(async () => undefined),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    })),
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      signOut: vi.fn(async () => undefined),
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        remove: vi.fn(),
        list: vi.fn(),
      })),
    },
  })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      signOut: vi.fn(async () => undefined),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    })),
  })),
  createAdminClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      signOut: vi.fn(async () => undefined),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    })),
  })),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  withMonitoring: (handler: any) => handler,
}));

type PageModule = {
  /** Absolute path to the file on disk. */
  absolutePath: string;
  /** Module specifier that Vitest can use to import the page. */
  moduleSpecifier: string;
};

const isPageFile = (entryPath: string) => {
  const extension = path.extname(entryPath);
  const baseName = path.basename(entryPath);
  return (
    baseName === 'page.tsx' ||
    baseName === 'page.ts' ||
    baseName === 'page.jsx' ||
    baseName === 'page.js'
  ) && extension.length > 0;
};

const walkAppDirectory = (directory: string, accumulator: PageModule[]) => {
  const entries = readdirSync(directory);

  entries.forEach((entry) => {
    const entryPath = path.join(directory, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      walkAppDirectory(entryPath, accumulator);
      return;
    }

    if (!stats.isFile()) {
      return;
    }

    if (!isPageFile(entryPath)) {
      return;
    }

    const relativeFromSrc = path.relative(path.join(process.cwd(), 'src'), entryPath);
    const moduleSpecifier = `@/${relativeFromSrc.replace(/\\/g, '/').replace(/\.(t|j)sx?$/, '')}`;

    accumulator.push({ absolutePath: entryPath, moduleSpecifier });
  });
};

const discoverPageModules = (): PageModule[] => {
  const accumulator: PageModule[] = [];
  const appDirectory = path.join(process.cwd(), 'src', 'app');
  walkAppDirectory(appDirectory, accumulator);

  return accumulator.sort((first, second) => first.moduleSpecifier.localeCompare(second.moduleSpecifier));
};

const pageModules = discoverPageModules();
const googleFontsMockModule = path.join(
  process.cwd(),
  'src',
  'app',
  '__tests__',
  '__fixtures__',
  'google-fonts-mock.js',
);

const startMockSupabaseServer = async () => {
  const server = createServer((request, response) => {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json');

    if (request.method === 'DELETE') {
      response.end('[]');
      return;
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      response.end('[]');
      return;
    }

    response.end('{}');
  });

  const url = await new Promise<string>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        resolve(`http://127.0.0.1:${address.port}`);
      } else {
        resolve('http://127.0.0.1');
      }
    });
  });

  return {
    url,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
};

describe('Application pages', () => {
  test.each(pageModules)('module %s loads without runtime import errors', async ({ moduleSpecifier }) => {
    const imported = await import(moduleSpecifier);
    expect(imported).toBeDefined();
    expect(imported.default).toBeDefined();
  });

  test('every discovered page is covered exactly once', () => {
    expect(pageModules.length).toBeGreaterThan(0);

    const seen = new Set<string>();
    const duplicates = new Set<string>();

    pageModules.forEach(({ moduleSpecifier }) => {
      if (seen.has(moduleSpecifier)) {
        duplicates.add(moduleSpecifier);
        return;
      }

      seen.add(moduleSpecifier);
    });

    expect(Array.from(duplicates)).toHaveLength(0);
  });
});

describe('Production build', () => {
  test(
    'next build completes without errors',
    { timeout: 240_000 },
    async () => {
      const mockSupabase = await startMockSupabaseServer();

      try {
        expect(() =>
          execSync('npx --yes next build --no-lint', {
            cwd: process.cwd(),
            env: {
              ...process.env,
              NODE_ENV: 'production',
              NEXT_TELEMETRY_DISABLED: '1',
              NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
              NEXT_FONT_GOOGLE_MOCKED_RESPONSES: googleFontsMockModule,
              NEXT_PUBLIC_SUPABASE_URL: mockSupabase.url,
              SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
              SUPABASE_SERVICE_ROLE_SECRET: 'service-role-key',
              APP_BUILD_SMOKE_TEST: '1',
            },
            stdio: 'pipe',
          }),
        ).not.toThrow();
      } finally {
        await mockSupabase.close();
      }
    },
  );
});
