/**
 * Session Timeout Service
 *
 * Implements automatic session timeout based on inactivity
 * - Tracks user activity (mouse, keyboard, touch events)
 * - Warns user before timeout
 * - Automatically logs out on inactivity
 */

export interface SessionTimeoutConfig {
  /** Timeout duration in milliseconds (default: 30 minutes) */
  timeout: number
  /** Warning duration before timeout in milliseconds (default: 2 minutes) */
  warningTime: number
  /** Callback when timeout warning is triggered */
  onWarning?: () => void
  /** Callback when session times out */
  onTimeout?: () => void
  /** Callback when user activity is detected */
  onActivity?: () => void
}

const DEFAULT_CONFIG: SessionTimeoutConfig = {
  timeout: 30 * 60 * 1000, // 30 minutes
  warningTime: 2 * 60 * 1000, // 2 minutes before timeout
}

export class SessionTimeout {
  private timeoutId: NodeJS.Timeout | null = null
  private warningId: NodeJS.Timeout | null = null
  private lastActivity: number = Date.now()
  private config: SessionTimeoutConfig
  private isWarningActive: boolean = false
  private activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']

  constructor(config: Partial<SessionTimeoutConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.handleActivity = this.handleActivity.bind(this)
  }

  /**
   * Starts monitoring session timeout
   */
  start(): void {
    if (typeof window === 'undefined') {
      return
    }

    this.resetTimers()
    this.registerActivityListeners()
  }

  /**
   * Stops monitoring session timeout
   */
  stop(): void {
    this.clearTimers()
    this.unregisterActivityListeners()
  }

  /**
   * Resets the timeout timers
   */
  reset(): void {
    this.lastActivity = Date.now()
    this.isWarningActive = false
    this.resetTimers()
  }

  /**
   * Gets time until timeout in milliseconds
   */
  getTimeUntilTimeout(): number {
    const elapsed = Date.now() - this.lastActivity
    return Math.max(0, this.config.timeout - elapsed)
  }

  /**
   * Gets time until warning in milliseconds
   */
  getTimeUntilWarning(): number {
    const elapsed = Date.now() - this.lastActivity
    const warningTime = this.config.timeout - this.config.warningTime
    return Math.max(0, warningTime - elapsed)
  }

  /**
   * Checks if session is still active
   */
  isActive(): boolean {
    return this.getTimeUntilTimeout() > 0
  }

  private handleActivity(): void {
    // Prevent excessive resets
    const now = Date.now()
    if (now - this.lastActivity < 1000) {
      return // Throttle to once per second
    }

    this.lastActivity = now

    // Reset warning if it was active
    if (this.isWarningActive) {
      this.isWarningActive = false
    }

    // Call activity callback
    if (this.config.onActivity) {
      this.config.onActivity()
    }

    this.resetTimers()
  }

  private resetTimers(): void {
    this.clearTimers()

    // Set warning timer
    const warningTime = this.config.timeout - this.config.warningTime
    this.warningId = setTimeout(() => {
      this.triggerWarning()
    }, warningTime)

    // Set timeout timer
    this.timeoutId = setTimeout(() => {
      this.triggerTimeout()
    }, this.config.timeout)
  }

  private clearTimers(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }

    if (this.warningId) {
      clearTimeout(this.warningId)
      this.warningId = null
    }
  }

  private triggerWarning(): void {
    if (this.isWarningActive) {
      return
    }

    this.isWarningActive = true

    if (this.config.onWarning) {
      this.config.onWarning()
    }
  }

  private triggerTimeout(): void {
    this.stop()

    if (this.config.onTimeout) {
      this.config.onTimeout()
    }
  }

  private registerActivityListeners(): void {
    if (typeof window === 'undefined') {
      return
    }

    this.activityEvents.forEach((event) => {
      window.addEventListener(event, this.handleActivity, { passive: true })
    })
  }

  private unregisterActivityListeners(): void {
    if (typeof window === 'undefined') {
      return
    }

    this.activityEvents.forEach((event) => {
      window.removeEventListener(event, this.handleActivity)
    })
  }
}

/**
 * React hook for session timeout
 */
export function useSessionTimeout(config: Partial<SessionTimeoutConfig> = {}) {
  if (typeof window === 'undefined') {
    return {
      start: () => {},
      stop: () => {},
      reset: () => {},
      getTimeUntilTimeout: () => 0,
      getTimeUntilWarning: () => 0,
      isActive: () => false,
    }
  }

  // Use a singleton instance
  const timeout = new SessionTimeout(config)

  return {
    start: () => timeout.start(),
    stop: () => timeout.stop(),
    reset: () => timeout.reset(),
    getTimeUntilTimeout: () => timeout.getTimeUntilTimeout(),
    getTimeUntilWarning: () => timeout.getTimeUntilWarning(),
    isActive: () => timeout.isActive(),
  }
}

/**
 * Server-side session timeout validation
 * Checks if session has been inactive for too long
 */
export interface SessionActivityData {
  lastActivity: number
  createdAt: number
}

export function isSessionExpired(
  sessionData: SessionActivityData,
  timeoutMs: number = 30 * 60 * 1000
): boolean {
  const now = Date.now()
  const inactiveTime = now - sessionData.lastActivity

  return inactiveTime > timeoutMs
}

/**
 * Updates session activity timestamp
 */
export function updateSessionActivity(sessionData: SessionActivityData): SessionActivityData {
  return {
    ...sessionData,
    lastActivity: Date.now(),
  }
}

/**
 * Creates new session activity data
 */
export function createSessionActivity(): SessionActivityData {
  const now = Date.now()
  return {
    lastActivity: now,
    createdAt: now,
  }
}
