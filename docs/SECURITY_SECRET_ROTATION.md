# 🔐 Secret Rotation Guide

This document describes the process for rotating security secrets in the PurVita application.

---

## 📋 Overview

Regular secret rotation is a critical security practice that helps:
- Limit the impact of compromised credentials
- Meet compliance requirements (SOC2, GDPR, PCI-DSS)
- Reduce the attack window for leaked secrets

**Recommended rotation schedule:**
- **Critical secrets** (database, service keys): Every 90 days
- **Encryption keys**: Every 180 days
- **API keys** (third-party services): Every 90 days
- **CSRF/Session secrets**: Every 180 days

---

## 🔑 Secrets Inventory

### 1. Database & Authentication

| Secret | Variable Name | Criticality | Rotation Frequency |
|--------|---------------|-------------|-------------------|
| Supabase URL | `NEXT_PUBLIC_SUPABASE_URL` | High | On compromise only |
| Supabase Anon Key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | High | 90 days |
| Supabase Service Role Key | `SUPABASE_SERVICE_ROLE_KEY` | **Critical** | 90 days |

### 2. Encryption & Security

| Secret | Variable Name | Criticality | Rotation Frequency |
|--------|---------------|-------------|-------------------|
| CSRF Secret | `CSRF_SECRET` | High | 180 days |
| Encryption Key | `ENCRYPTION_KEY` | **Critical** | 180 days |
| NextAuth Secret | `NEXTAUTH_SECRET` | High | 180 days |

### 3. Payment Providers

| Secret | Variable Name | Criticality | Rotation Frequency |
|--------|---------------|-------------|-------------------|
| Stripe Secret Key | `STRIPE_SECRET_KEY` | **Critical** | 90 days |
| Stripe Webhook Secret | `STRIPE_WEBHOOK_SECRET` | High | 90 days |
| PayPal Client Secret | `PAYPAL_CLIENT_SECRET` | **Critical** | 90 days |

### 4. External APIs

| Secret | Variable Name | Criticality | Rotation Frequency |
|--------|---------------|-------------|-------------------|
| Mailchimp API Key | `MAILCHIMP_API_KEY` | Medium | 90 days |
| SendGrid API Key | `SENDGRID_API_KEY` | Medium | 90 days |
| VirusTotal API Key | `VIRUSTOTAL_API_KEY` | Low | 180 days |
| Google Safe Browsing Key | `GOOGLE_SAFE_BROWSING_API_KEY` | Low | 180 days |

---

## 🔄 Rotation Process

### Manual Rotation (Current Process)

#### Step 1: Generate New Secret

```bash
# For random secrets (CSRF, encryption, etc.)
openssl rand -hex 32

# For base64 encoded secrets
openssl rand -base64 32
```

#### Step 2: Update Environment Variables

**Production (Vercel/Hosting Platform):**
1. Log into hosting dashboard
2. Navigate to Environment Variables
3. Add new secret with temporary name (e.g., `CSRF_SECRET_NEW`)
4. Deploy to verify it works
5. Rename old secret to `CSRF_SECRET_OLD`
6. Rename new secret to `CSRF_SECRET`
7. Deploy again
8. Keep old secret for 7 days for rollback

**Local Development:**
```bash
# Update .env.local
cp .env.local .env.local.backup
nano .env.local  # Update the secret
```

#### Step 3: Trigger Rotation via Admin Panel

1. Log into admin panel: `/admin`
2. Navigate to Security Settings: `/admin/security`
3. Click "Rotate Secrets"
4. Confirm rotation
5. Verify all services still work

**Or use API endpoint:**

```bash
curl -X POST https://your-domain.com/api/admin/security/rotate-secrets \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -H "X-CSRF-Token: your-csrf-token" \
  -d '{
    "secretType": "csrf",
    "newSecret": "your-new-secret-here"
  }'
```

#### Step 4: Update Dependent Systems

**Supabase Secrets:**
1. Generate new service role key in Supabase dashboard
2. Update `SUPABASE_SERVICE_ROLE_KEY` in environment
3. Test admin operations
4. Revoke old key after 24 hours

**Stripe Secrets:**
1. Generate new secret key in Stripe dashboard
2. Update `STRIPE_SECRET_KEY`
3. Generate new webhook secret
4. Update `STRIPE_WEBHOOK_SECRET`
5. Test payment flow
6. Revoke old keys after 7 days

**Payment Provider Webhooks:**
- Update webhook URLs if secret changed
- Verify webhook signatures still work
- Monitor error logs for 24 hours

#### Step 5: Verify Rotation

```bash
# Check application health
curl https://your-domain.com/api/health

# Check admin access
curl https://your-domain.com/api/check-admin-access \
  -H "Cookie: your-session"

# Check payment processing (test mode)
# ... perform test purchase
```

#### Step 6: Document Rotation

Update rotation log:

```
Date: 2025-11-18
Rotated: CSRF_SECRET, ENCRYPTION_KEY
Reason: Scheduled 180-day rotation
Rotated by: admin@example.com
Old secret retained until: 2025-11-25
Notes: All systems verified working
```

---

## 🚨 Emergency Rotation (Compromised Secret)

If a secret is compromised, follow this expedited process:

### Immediate Actions (< 1 hour)

1. **Assess Impact**
   - Which secret was compromised?
   - What systems does it access?
   - Is there evidence of unauthorized use?

2. **Rotate Immediately**
   - Generate new secret
   - Update production environment
   - Deploy immediately (skip staging if critical)

3. **Revoke Old Secret**
   - Immediately revoke from provider (Stripe, Supabase, etc.)
   - Do NOT wait 7 days

4. **Monitor Actively**
   - Check audit logs for suspicious activity
   - Monitor error rates
   - Alert team

### Post-Incident (< 24 hours)

1. **Root Cause Analysis**
   - How was secret compromised?
   - Was it logged inappropriately?
   - Was it committed to Git?

2. **Search for Exposure**
   ```bash
   # Search Git history
   git log -S "compromised-secret" --all

   # Search GitHub if repo is public
   # Use GitHub secret scanning alerts
   ```

3. **Notify Stakeholders**
   - Security team
   - Management (if high severity)
   - Affected users (if data breach)

4. **Update Procedures**
   - Document what went wrong
   - Update rotation procedures
   - Add automated checks if applicable

---

## 🤖 Automated Rotation (Future Enhancement)

### Proposed Implementation

```typescript
// /lib/security/secret-rotation-scheduler.ts

export async function scheduleSecretRotation() {
  // Check secret age
  const secretAge = await getSecretAge('CSRF_SECRET');

  if (secretAge > 180 * 24 * 60 * 60 * 1000) { // 180 days
    // Send alert to admins
    await sendRotationAlert('CSRF_SECRET', secretAge);

    // Optionally auto-rotate non-critical secrets
    if (process.env.AUTO_ROTATE_SECRETS === 'true') {
      await rotateSecret('CSRF_SECRET');
    }
  }
}
```

### Rotation Monitoring Dashboard

Create `/admin/security/secrets` page with:
- List of all secrets with last rotation date
- Days until recommended rotation
- Automated rotation toggle
- Rotation history log
- One-click rotation for supported secrets

---

## 📊 Rotation Checklist

Use this checklist for each rotation:

- [ ] Backup current configuration
- [ ] Generate new secret (cryptographically secure)
- [ ] Update environment variables in all environments
- [ ] Deploy and verify production
- [ ] Test critical flows (auth, payments, admin access)
- [ ] Monitor logs for 24 hours
- [ ] Update webhook configurations if needed
- [ ] Revoke old secret after grace period
- [ ] Document rotation in log
- [ ] Update expiry reminder (90 or 180 days)

---

## 🔒 Best Practices

1. **Never commit secrets to Git**
   ```bash
   # Add to .gitignore
   .env
   .env.local
   .env.*.local
   ```

2. **Use separate secrets for dev/staging/prod**
   - Never use production secrets in development
   - Never use development secrets in production

3. **Implement secret scanning**
   ```bash
   # Install git-secrets
   brew install git-secrets

   # Setup in repo
   git secrets --install
   git secrets --register-aws
   ```

4. **Rotate on team member departure**
   - When an admin leaves, rotate all critical secrets
   - Revoke their access tokens immediately

5. **Monitor secret usage**
   - Log when secrets are used (not the values!)
   - Alert on unusual patterns
   - Track secret age

6. **Use secret management tools (recommended)**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Google Secret Manager
   - Azure Key Vault

---

## 📞 Support

**For rotation assistance:**
- Internal: Contact security team
- External: Open issue at https://github.com/your-org/PurVita/issues

**Emergency (compromised secret):**
- Email: security@your-domain.com
- Slack: #security-incidents
- Phone: [Emergency contact]

---

**Last Updated:** 2025-11-18
**Next Review:** 2026-02-18
