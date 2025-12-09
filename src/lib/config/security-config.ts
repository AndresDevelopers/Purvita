/**
 * Centralized Security Configuration
 *
 * This file contains all security-related constants and configuration
 * to ensure consistency across the application.
 */

// ================================
// SESSION MANAGEMENT
// ================================

export const SESSION_CONFIG = {
  /** Session timeout for regular users (15 minutes) */
  TIMEOUT_MS: 15 * 60 * 1000,

  /** Warning time before session expires (2 minutes) */
  WARNING_MS: 2 * 60 * 1000,

  /** Admin session timeout (10 minutes - more restrictive) */
  ADMIN_TIMEOUT_MS: 10 * 60 * 1000,

  /** Admin session warning time (1 minute) */
  ADMIN_WARNING_MS: 1 * 60 * 1000,
} as const;

// ================================
// PASSWORD REQUIREMENTS
// ================================

export const PASSWORD_CONFIG = {
  /** Minimum password length */
  MIN_LENGTH: 8,

  /** Maximum password length */
  MAX_LENGTH: 128,

  /** Require uppercase letter */
  REQUIRE_UPPERCASE: false,

  /** Require lowercase letter */
  REQUIRE_LOWERCASE: false,

  /** Require number */
  REQUIRE_NUMBER: false,

  /** Require special character */
  REQUIRE_SPECIAL: false,
} as const;

// ================================
// RATE LIMITING
// ================================

export const RATE_LIMIT_CONFIG = {
  /** Login attempts */
  LOGIN: {
    requests: 5,
    windowMs: 5 * 60 * 1000, // 5 minutes
  },

  /** Registration attempts */
  REGISTER: {
    requests: 5,
    windowMs: 5 * 60 * 1000, // 5 minutes
  },

  /** Password reset attempts */
  FORGOT_PASSWORD: {
    requests: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },

  /** Admin login attempts */
  ADMIN_LOGIN: {
    requests: 3,
    windowMs: 5 * 60 * 1000, // 5 minutes
  },

  /** Admin API requests */
  ADMIN_API: {
    requests: 30,
    windowMs: 60 * 1000, // 1 minute
  },

  /** General API requests */
  API_GENERAL: {
    requests: 60,
    windowMs: 60 * 1000, // 1 minute
  },

  /** Referral code resolution */
  REFERRAL_RESOLVE: {
    requests: 10,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;

// ================================
// ENCRYPTION
// ================================

export const ENCRYPTION_CONFIG = {
  /** AES encryption algorithm */
  ALGORITHM: 'aes-256-gcm',

  /** IV length for AES-GCM */
  IV_LENGTH: 12,

  /** Auth tag length for AES-GCM */
  AUTH_TAG_LENGTH: 16,

  /** Salt length for key derivation */
  SALT_LENGTH: 16,
} as const;

// ================================
// CSRF PROTECTION
// ================================

export const CSRF_CONFIG = {
  /** CSRF token expiration (24 hours) */
  TOKEN_EXPIRY_MS: 24 * 60 * 60 * 1000,

  /** CSRF token length (bytes) */
  TOKEN_LENGTH: 32,

  /** Cookie name for CSRF token */
  COOKIE_NAME: 'csrf-token',
} as const;

// ================================
// CONTENT SECURITY POLICY
// ================================

export const CSP_CONFIG = {
  /** CSP is enabled by default in all environments (set DISABLE_CSP_DEV=true to disable in dev) */
  ENABLED: process.env.DISABLE_CSP_DEV !== 'true',

  /** CSP report-only mode */
  REPORT_ONLY: process.env.CSP_REPORT_ONLY === 'true',

  /** CSP report URI */
  REPORT_URI: '/api/csp-violations',
} as const;

// ================================
// FILE UPLOAD
// ================================

export const FILE_UPLOAD_CONFIG = {
  /** Max file size for images (5MB) */
  MAX_IMAGE_SIZE: 5 * 1024 * 1024,

  /** Max file size for videos (100MB) */
  MAX_VIDEO_SIZE: 100 * 1024 * 1024,

  /** Max file size for audio (10MB) */
  MAX_AUDIO_SIZE: 10 * 1024 * 1024,

  /** Max file size for documents (10MB) */
  MAX_DOCUMENT_SIZE: 10 * 1024 * 1024,

  /** Allowed image types */
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const,

  /** Allowed video types */
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/ogg'] as const,

  /** Allowed audio types */
  ALLOWED_AUDIO_TYPES: ['audio/mpeg', 'audio/wav', 'audio/ogg'] as const,

  /** Allowed document types */
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] as const,
} as const;

// ================================
// THREAT INTELLIGENCE
// ================================

export const THREAT_INTELLIGENCE_CONFIG = {
  /** Enable auto-blocking of malicious IPs */
  AUTO_BLOCK_ENABLED: process.env.AUTO_BLOCK_ENABLED === 'true',

  /** Auto-block duration (24 hours) */
  AUTO_BLOCK_DURATION_HOURS: parseInt(process.env.AUTO_BLOCK_DURATION_HOURS || '24', 10),

  /** Minimum confidence score for auto-blocking (0-100) */
  AUTO_BLOCK_MIN_CONFIDENCE: parseInt(process.env.AUTO_BLOCK_MIN_CONFIDENCE || '70', 10),

  /** Threat intelligence strategy */
  STRATEGY: (process.env.THREAT_INTELLIGENCE_STRATEGY || 'any') as 'any' | 'majority' | 'all',
} as const;

// ================================
// AUDIT LOGGING
// ================================

export const AUDIT_LOG_CONFIG = {
  /** Enable audit logging */
  ENABLED: true,

  /** Log retention period (90 days) */
  RETENTION_DAYS: 90,

  /** Redact sensitive fields */
  REDACT_SENSITIVE: true,

  /** Fields to redact */
  SENSITIVE_FIELDS: ['password', 'token', 'secret', 'key', 'apiKey', 'api_key'] as const,
} as const;

// ================================
// AFFILIATE TRACKING
// ================================

export const AFFILIATE_CONFIG = {
  /** Referral tracking expiry (30 days) */
  TRACKING_EXPIRY_DAYS: 30,

  /** Commission rate (percentage) */
  DEFAULT_COMMISSION_RATE: 10,

  /** Minimum payout amount */
  MIN_PAYOUT_AMOUNT: 50_00, // $50.00 in cents
} as const;

// ================================
// EXPORTS
// ================================

export const SECURITY_CONFIG = {
  SESSION: SESSION_CONFIG,
  PASSWORD: PASSWORD_CONFIG,
  RATE_LIMIT: RATE_LIMIT_CONFIG,
  ENCRYPTION: ENCRYPTION_CONFIG,
  CSRF: CSRF_CONFIG,
  CSP: CSP_CONFIG,
  FILE_UPLOAD: FILE_UPLOAD_CONFIG,
  THREAT_INTELLIGENCE: THREAT_INTELLIGENCE_CONFIG,
  AUDIT_LOG: AUDIT_LOG_CONFIG,
  AFFILIATE: AFFILIATE_CONFIG,
} as const;

export default SECURITY_CONFIG;
