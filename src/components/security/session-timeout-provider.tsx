'use client'

import { useEffect, useState, useCallback } from 'react'
import { SessionTimeout } from '@/lib/security/session-timeout'
import { useRouter } from 'next/navigation'

interface SessionTimeoutProviderProps {
  /** Timeout duration in minutes (default: 30) */
  timeoutMinutes?: number
  /** Warning time in minutes before timeout (default: 2) */
  warningMinutes?: number
  /** Whether to enable timeout (default: true) */
  enabled?: boolean
  /** Callback on logout */
  onLogout?: () => void | Promise<void>
}

/**
 * Session Timeout Provider
 *
 * Monitors user activity and automatically logs out after inactivity
 * Shows warning dialog before timeout
 */
export function SessionTimeoutProvider({
  timeoutMinutes = 30,
  warningMinutes = 2,
  enabled = true,
  onLogout,
}: SessionTimeoutProviderProps) {
  const [showWarning, setShowWarning] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const router = useRouter()

  const handleTimeout = useCallback(async () => {
    setShowWarning(false)

    // Call custom logout handler if provided
    if (onLogout) {
      await onLogout()
    }

    // Redirect to login page
    router.push('/admin/login?timeout=true')
  }, [onLogout, router])

  const handleWarning = useCallback(() => {
    setShowWarning(true)
  }, [])

  const handleContinue = useCallback(() => {
    setShowWarning(false)
    // Session timeout will be reset automatically on user activity
  }, [])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return
    }

    const timeout = new SessionTimeout({
      timeout: timeoutMinutes * 60 * 1000,
      warningTime: warningMinutes * 60 * 1000,
      onWarning: handleWarning,
      onTimeout: handleTimeout,
    })

    timeout.start()

    // Update countdown timer
    const intervalId = setInterval(() => {
      if (showWarning) {
        const remaining = Math.ceil(timeout.getTimeUntilTimeout() / 1000)
        setTimeRemaining(remaining)

        if (remaining <= 0) {
          clearInterval(intervalId)
        }
      }
    }, 1000)

    return () => {
      timeout.stop()
      clearInterval(intervalId)
    }
  }, [enabled, timeoutMinutes, warningMinutes, handleWarning, handleTimeout, showWarning])

  if (!showWarning) {
    return null
  }

  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
            <svg
              className="h-6 w-6 text-yellow-600 dark:text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Sesión por expirar
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Tu sesión está inactiva
            </p>
          </div>
        </div>

        <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
          Tu sesión expirará por inactividad en{' '}
          <span className="font-mono font-bold text-yellow-600 dark:text-yellow-400">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </p>

        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          Haz clic en &quot;Continuar&quot; para mantener tu sesión activa.
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleContinue}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Continuar sesión
          </button>
          <button
            onClick={handleTimeout}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
