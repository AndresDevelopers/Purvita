/**
 * Affiliate Security Monitor
 *
 * Monitors and logs security events specific to affiliate pages including:
 * - Attempts to access inactive affiliate stores
 * - Suspicious referral code patterns
 * - Unusual access patterns
 */

import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity } from './audit-logger';

export interface AffiliateAccessAttempt {
  referralCode: string;
  hasActiveSubscription: boolean;
  pathname: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface SuspiciousPattern {
  type: 'inactive_store_access' | 'invalid_referral_format' | 'rapid_access';
  severity: 'low' | 'medium' | 'high';
  details: Record<string, any>;
}

class AffiliateSecurityMonitor {
  private accessAttempts: Map<string, AffiliateAccessAttempt[]> = new Map();
  private readonly MAX_ATTEMPTS_WINDOW = 60000; // 1 minute
  private readonly SUSPICIOUS_ACCESS_THRESHOLD = 10; // 10 attempts in 1 minute

  /**
   * Log an attempt to access an affiliate store
   */
  async logAccessAttempt(attempt: AffiliateAccessAttempt): Promise<void> {
    const key = `${attempt.ipAddress || 'unknown'}:${attempt.referralCode}`;

    // Store attempt
    const attempts = this.accessAttempts.get(key) || [];
    attempts.push(attempt);

    // Clean old attempts (older than window)
    const now = Date.now();
    const recentAttempts = attempts.filter(
      a => now - a.timestamp.getTime() < this.MAX_ATTEMPTS_WINDOW
    );
    this.accessAttempts.set(key, recentAttempts);

    // Check for suspicious patterns
    const patterns = this.detectSuspiciousPatterns(recentAttempts, attempt);

    for (const pattern of patterns) {
      await this.reportSuspiciousPattern(pattern, attempt);
    }
  }

  /**
   * Log failed access to inactive affiliate store
   */
  async logInactiveStoreAccess(
    referralCode: string,
    metadata: {
      ipAddress?: string;
      userAgent?: string;
      pathname: string;
    }
  ): Promise<void> {
    await SecurityAuditLogger.log(
      SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
      SecurityEventSeverity.WARNING,
      `Attempt to access inactive affiliate store: ${referralCode}`,
      {
        referralCode,
        pathname: metadata.pathname,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        reason: 'inactive_subscription',
        resourceType: 'affiliate_store',
      },
      false // Not userId-based, it's IP-based
    );

    // Track this attempt
    await this.logAccessAttempt({
      referralCode,
      hasActiveSubscription: false,
      pathname: metadata.pathname,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      timestamp: new Date(),
    });
  }

  /**
   * Log successful affiliate store access (for analytics)
   */
  async logSuccessfulAccess(
    referralCode: string,
    metadata: {
      ipAddress?: string;
      userAgent?: string;
      pathname: string;
      sponsorId?: string;
    }
  ): Promise<void> {
    // Only log in development for now to avoid excessive logging
    if (process.env.NODE_ENV !== 'production') {
      console.log('[AffiliateSecurityMonitor] Successful access:', {
        referralCode,
        pathname: metadata.pathname,
      });
    }

    // Track this attempt
    await this.logAccessAttempt({
      referralCode,
      hasActiveSubscription: true,
      pathname: metadata.pathname,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      timestamp: new Date(),
    });
  }

  /**
   * Detect suspicious access patterns
   */
  private detectSuspiciousPatterns(
    attempts: AffiliateAccessAttempt[],
    currentAttempt: AffiliateAccessAttempt
  ): SuspiciousPattern[] {
    const patterns: SuspiciousPattern[] = [];

    // Pattern 1: Rapid access to inactive stores
    const inactiveAttempts = attempts.filter(a => !a.hasActiveSubscription);
    if (inactiveAttempts.length >= this.SUSPICIOUS_ACCESS_THRESHOLD) {
      patterns.push({
        type: 'rapid_access',
        severity: 'high',
        details: {
          attemptCount: inactiveAttempts.length,
          timeWindow: this.MAX_ATTEMPTS_WINDOW,
          referralCode: currentAttempt.referralCode,
        },
      });
    }

    // Pattern 2: Access to inactive store
    if (!currentAttempt.hasActiveSubscription) {
      patterns.push({
        type: 'inactive_store_access',
        severity: 'low',
        details: {
          referralCode: currentAttempt.referralCode,
          pathname: currentAttempt.pathname,
        },
      });
    }

    // Pattern 3: Invalid referral code format (potential injection attempt)
    const suspiciousCodePattern = /[<>"'`]/;
    if (suspiciousCodePattern.test(currentAttempt.referralCode)) {
      patterns.push({
        type: 'invalid_referral_format',
        severity: 'medium',
        details: {
          referralCode: currentAttempt.referralCode,
          reason: 'contains_suspicious_characters',
        },
      });
    }

    return patterns;
  }

  /**
   * Report suspicious pattern to audit log
   */
  private async reportSuspiciousPattern(
    pattern: SuspiciousPattern,
    attempt: AffiliateAccessAttempt
  ): Promise<void> {
    const severityMap = {
      low: SecurityEventSeverity.LOW,
      medium: SecurityEventSeverity.WARNING,
      high: SecurityEventSeverity.HIGH,
    };

    const messageMap = {
      inactive_store_access: 'Attempt to access inactive affiliate store',
      invalid_referral_format: 'Suspicious referral code format detected',
      rapid_access: 'Rapid access attempts to affiliate stores detected',
    };

    await SecurityAuditLogger.log(
      SecurityEventType.SUSPICIOUS_ACTIVITY,
      severityMap[pattern.severity],
      messageMap[pattern.type],
      {
        patternType: pattern.type,
        ipAddress: attempt.ipAddress,
        userAgent: attempt.userAgent,
        pathname: attempt.pathname,
        ...pattern.details,
      },
      false
    );
  }

  /**
   * Get access statistics for a specific IP
   */
  getAccessStats(ipAddress: string): {
    totalAttempts: number;
    inactiveStoreAttempts: number;
    suspiciousPatterns: number;
  } {
    const allAttempts = Array.from(this.accessAttempts.values()).flat();
    const ipAttempts = allAttempts.filter(a => a.ipAddress === ipAddress);

    return {
      totalAttempts: ipAttempts.length,
      inactiveStoreAttempts: ipAttempts.filter(a => !a.hasActiveSubscription).length,
      suspiciousPatterns: this.detectSuspiciousPatterns(ipAttempts, ipAttempts[0] || {} as any).length,
    };
  }

  /**
   * Clear old access attempts (cleanup)
   */
  cleanup(): void {
    const now = Date.now();

    for (const [key, attempts] of this.accessAttempts.entries()) {
      const recentAttempts = attempts.filter(
        a => now - a.timestamp.getTime() < this.MAX_ATTEMPTS_WINDOW
      );

      if (recentAttempts.length === 0) {
        this.accessAttempts.delete(key);
      } else {
        this.accessAttempts.set(key, recentAttempts);
      }
    }
  }
}

// Singleton instance
export const affiliateSecurityMonitor = new AffiliateSecurityMonitor();

// Auto-cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    affiliateSecurityMonitor.cleanup();
  }, 5 * 60 * 1000);
}
