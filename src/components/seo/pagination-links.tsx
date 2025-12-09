/**
 * Pagination Links Component
 * 
 * Generates rel="prev" and rel="next" link tags for paginated content.
 * This helps search engines understand the relationship between pages in a series.
 * 
 * @see https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading
 */

interface PaginationLinksProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  pageParam?: string; // Default: 'page'
}

/**
 * PaginationLinks component
 * 
 * Usage:
 * ```tsx
 * <PaginationLinks
 *   currentPage={2}
 *   totalPages={10}
 *   baseUrl="/products"
 *   pageParam="page"
 * />
 * ```
 * 
 * This will generate:
 * - <link rel="prev" href="/products?page=1" />
 * - <link rel="next" href="/products?page=3" />
 */
export function PaginationLinks({
  currentPage,
  totalPages,
  baseUrl,
  pageParam = 'page',
}: PaginationLinksProps) {
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const buildUrl = (page: number): string => {
    const url = new URL(baseUrl, 'https://example.com'); // Base doesn't matter, we only need pathname + search
    
    if (page === 1) {
      // First page typically doesn't have page param
      return url.pathname;
    }
    
    url.searchParams.set(pageParam, page.toString());
    return `${url.pathname}${url.search}`;
  };

  return (
    <>
      {hasPrev && (
        <link rel="prev" href={buildUrl(currentPage - 1)} />
      )}
      {hasNext && (
        <link rel="next" href={buildUrl(currentPage + 1)} />
      )}
    </>
  );
}

/**
 * Generate pagination metadata for Next.js Metadata API
 * 
 * Usage in page.tsx:
 * ```tsx
 * export async function generateMetadata({ searchParams }): Promise<Metadata> {
 *   const page = Number(searchParams.page) || 1;
 *   const totalPages = await getTotalPages();
 *   
 *   return {
 *     ...otherMetadata,
 *     ...generatePaginationMetadata(page, totalPages, '/products'),
 *   };
 * }
 * ```
 */
export function generatePaginationMetadata(
  currentPage: number,
  totalPages: number,
  baseUrl: string,
  pageParam: string = 'page'
): {
  alternates?: {
    canonical?: string;
  };
  other?: Record<string, string>;
} {
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const buildUrl = (page: number): string => {
    if (page === 1) {
      return baseUrl;
    }
    
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${pageParam}=${page}`;
  };

  const metadata: {
    alternates?: { canonical?: string };
    other?: Record<string, string>;
  } = {};

  // Set canonical to current page
  metadata.alternates = {
    canonical: buildUrl(currentPage),
  };

  // Add prev/next to other meta tags
  const other: Record<string, string> = {};
  
  if (hasPrev) {
    other.prev = buildUrl(currentPage - 1);
  }
  
  if (hasNext) {
    other.next = buildUrl(currentPage + 1);
  }

  if (Object.keys(other).length > 0) {
    metadata.other = other;
  }

  return metadata;
}

