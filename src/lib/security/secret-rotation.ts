import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity } from './audit-logger';
import { getEnv } from '../env';

/**
 * Secret Rotation Service
 * Provides automated rotation of security-sensitive secrets
 */

export interface SecretRotationConfig {
  secretName: string;
  minLength: number;
  rotationIntervalDays: number;
  lastRotation?: Date;
  currentValue?: string;
}

export interface RotationResult {
  success: boolean;
  rotated: boolean;
  newSecret?: string;
  message: string;
}

const DEFAULT_ROTATION_CONFIGS: SecretRotationConfig[] = [
  {
    secretName: 'CRON_SECRET',
    minLength: 32,
    rotationIntervalDays: 90, // Rotate every 3 months
  },
  {
    secretName: 'CREDENTIALS_ENCRYPTION_KEY',
    minLength: 64,
    rotationIntervalDays: 180, // Rotate every 6 months
  },
  {
    secretName: 'CUSTOM_ID_SECRET',
    minLength: 64,
    rotationIntervalDays: 180, // Rotate every 6 months
  },
];

export class SecretRotationService {
  private static instance: SecretRotationService;
  private configs: Map<string, SecretRotationConfig> = new Map();
  private initialized = false;

  static getInstance(): SecretRotationService {
    if (!SecretRotationService.instance) {
      SecretRotationService.instance = new SecretRotationService();
    }
    return SecretRotationService.instance;
  }

  constructor() {
    // Don't initialize configs in constructor to avoid build-time errors
  }

  private initializeConfigs(): void {
    if (this.initialized) return;

    DEFAULT_ROTATION_CONFIGS.forEach(config => {
      this.configs.set(config.secretName, {
        ...config,
        lastRotation: this.getLastRotationDate(config.secretName),
        currentValue: this.getCurrentSecretValue(config.secretName),
      });
    });

    this.initialized = true;
  }

  private getLastRotationDate(secretName: string): Date | undefined {
    // In a real implementation, this would read from a secure storage
    // For now, we'll use a simple localStorage approach for demonstration
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return undefined;
      }
      const stored = localStorage.getItem(`secret_rotation_${secretName}`);
      return stored ? new Date(JSON.parse(stored).lastRotation) : undefined;
    } catch {
      return undefined;
    }
  }

  private getCurrentSecretValue(secretName: string): string | undefined {
    try {
      const env = getEnv();
      return env[secretName as keyof typeof env] as string | undefined;
    } catch {
      // During build time, env might not be fully available
      return undefined;
    }
  }

  private setLastRotationDate(secretName: string, date: Date): void {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return;
      }
      localStorage.setItem(
        `secret_rotation_${secretName}`,
        JSON.stringify({ lastRotation: date.toISOString() })
      );
    } catch (error) {
      console.warn(`Failed to store rotation date for ${secretName}:`, error);
    }
  }

  /**
   * Generate a cryptographically secure random secret
   */
  generateSecureSecret(length: number): string {
    const buffer = new Uint8Array(Math.ceil(length / 2)); // Hex characters: 2 chars per byte
    crypto.getRandomValues(buffer);
    
    // Convert to hex string
    return Array.from(buffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, length);
  }

  /**
   * Check if a secret needs rotation
   */
  needsRotation(secretName: string): boolean {
    this.initializeConfigs();
    const config = this.configs.get(secretName);
    if (!config || !config.lastRotation) {
      return true; // Never rotated before
    }

    const now = new Date();
    const rotationDate = new Date(config.lastRotation);
    rotationDate.setDate(rotationDate.getDate() + config.rotationIntervalDays);

    return now >= rotationDate;
  }

  /**
   * Rotate a specific secret if needed
   */
  async rotateSecret(secretName: string): Promise<RotationResult> {
    this.initializeConfigs();
    const config = this.configs.get(secretName);
    if (!config) {
      return {
        success: false,
        rotated: false,
        message: `No configuration found for secret: ${secretName}`,
      };
    }

    if (!this.needsRotation(secretName)) {
      return {
        success: true,
        rotated: false,
        message: `Secret ${secretName} does not need rotation yet`,
      };
    }

    try {
      await SecurityAuditLogger.log(
        SecurityEventType.SECRET_ROTATION_INITIATED,
        SecurityEventSeverity.INFO,
        `Initiating rotation for secret: ${secretName}`,
        { secretName },
        true
      );

      const newSecret = this.generateSecureSecret(config.minLength);
      
      // In a real implementation, this would:
      // 1. Update the environment variable (via deployment/configuration management)
      // 2. Update any encrypted data that uses the old secret
      // 3. Notify relevant services about the secret change
      
      this.setLastRotationDate(secretName, new Date());
      
      await SecurityAuditLogger.log(
        SecurityEventType.SECRET_ROTATION_COMPLETED,
        SecurityEventSeverity.INFO,
        `Successfully rotated secret: ${secretName}`,
        { 
          secretName, 
          newLength: newSecret.length,
          rotationDate: new Date().toISOString() 
        },
        true
      );

      return {
        success: true,
        rotated: true,
        newSecret,
        message: `Successfully rotated secret: ${secretName}`,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await SecurityAuditLogger.log(
        SecurityEventType.SECRET_ROTATION_FAILED,
        SecurityEventSeverity.ERROR,
        `Failed to rotate secret: ${secretName}`,
        { 
          secretName, 
          error: errorMessage 
        },
        false
      );

      return {
        success: false,
        rotated: false,
        message: `Failed to rotate secret ${secretName}: ${errorMessage}`,
      };
    }
  }

  /**
   * Check all secrets and rotate those that need it
   */
  async rotateAllNeededSecrets(): Promise<RotationResult[]> {
    const results: RotationResult[] = [];
    
    for (const [secretName] of this.configs) {
      if (this.needsRotation(secretName)) {
        const result = await this.rotateSecret(secretName);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get rotation status for all configured secrets
   */
  getRotationStatus(): Array<{
    secretName: string;
    needsRotation: boolean;
    lastRotation?: Date;
    nextRotation?: Date;
    currentLength?: number;
  }> {
    this.initializeConfigs();
    const status: Array<{
      secretName: string;
      needsRotation: boolean;
      lastRotation?: Date;
      nextRotation?: Date;
      currentLength?: number;
    }> = [];

    for (const [secretName, config] of this.configs) {
      const needsRotation = this.needsRotation(secretName);
      let nextRotation: Date | undefined;

      if (config.lastRotation) {
        nextRotation = new Date(config.lastRotation);
        nextRotation.setDate(nextRotation.getDate() + config.rotationIntervalDays);
      }

      status.push({
        secretName,
        needsRotation,
        lastRotation: config.lastRotation,
        nextRotation,
        currentLength: config.currentValue?.length,
      });
    }

    return status;
  }
}

// Export singleton instance
export const secretRotation = SecretRotationService.getInstance();