'use client'

import { useEffect } from 'react'

interface CsrfTokenProviderProps {
  token: string
}

/**
 * CSRF Token Provider Component
 *
 * Injects CSRF token into meta tag for client-side access
 * Should be placed in the root layout
 */
export function CsrfTokenProvider({ token }: CsrfTokenProviderProps) {
  useEffect(() => {
    // Set CSRF token in meta tag for client-side access
    let metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement

    if (!metaTag) {
      metaTag = document.createElement('meta')
      metaTag.name = 'csrf-token'
      document.head.appendChild(metaTag)
    }

    metaTag.content = token
  }, [token])

  return null // This component doesn't render anything
}
