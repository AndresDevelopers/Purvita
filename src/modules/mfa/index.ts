/**
 * MFA Module
 * 
 * Two-Factor Authentication module using Supabase's native TOTP support.
 */

// Types
export * from './types';

// Services
export { MfaService, createMfaService } from './services/mfa-service';

// Hooks (client-side)
export { useMfa } from './hooks/use-mfa';

// Components
export { MfaSetupCard } from './components/mfa-setup-card';
export { MfaVerifyDialog } from './components/mfa-verify-dialog';
