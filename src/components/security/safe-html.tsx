'use client'

import { sanitizeHtml, SanitizeOptions } from '@/lib/security/sanitization'

/**
 * Safe HTML Component
 *
 * React component wrapper for safe HTML rendering
 * Use this instead of dangerouslySetInnerHTML
 *
 * @example
 * <SafeHtml html={userGeneratedContent} />
 */

export interface SafeHtmlProps {
  html: string
  options?: SanitizeOptions
  className?: string
  as?: React.ElementType
}

export function SafeHtml({ html, options = {}, className, as: Component = 'div' }: SafeHtmlProps) {
  const sanitized = sanitizeHtml(html, options)

  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
