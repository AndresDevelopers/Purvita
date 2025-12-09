import { getNonce } from '@/lib/security/csp-nonce'

/**
 * React component for nonce-protected inline script
 *
 * This component allows you to safely include inline scripts
 * while maintaining strong CSP protection.
 *
 * @example
 * <NonceScript>
 *   console.log('This inline script is CSP-safe')
 * </NonceScript>
 */

interface NonceScriptProps {
  children: string
  id?: string
  type?: string
}

export async function NonceScript({ children, id, type = 'text/javascript' }: NonceScriptProps) {
  const nonce = await getNonce()

  return (
    <script
      id={id}
      type={type}
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: children }}
    />
  )
}
