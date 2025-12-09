#!/bin/bash

# Security Check Script for PūrVita
# Run this script regularly to verify security posture

set -e

echo "🔒 PūrVita Security Check"
echo "========================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Verify .env files are not tracked
echo "📋 Check 1: Verifying .env files are not in Git..."
if git ls-files | grep -q "\.env"; then
    echo -e "${RED}❌ FAIL: .env files found in Git!${NC}"
    echo "   Files found:"
    git ls-files | grep "\.env"
    echo "   Action: Remove these files from Git immediately!"
    exit 1
else
    echo -e "${GREEN}✅ PASS: No .env files in Git${NC}"
fi
echo ""

# Check 2: Verify .env files are in .gitignore
echo "📋 Check 2: Verifying .env files are in .gitignore..."
if grep -q "\.env" .gitignore; then
    echo -e "${GREEN}✅ PASS: .env files are in .gitignore${NC}"
else
    echo -e "${RED}❌ FAIL: .env files not in .gitignore!${NC}"
    echo "   Action: Add .env* to .gitignore"
    exit 1
fi
echo ""

# Check 3: Check for hardcoded secrets
echo "📋 Check 3: Checking for hardcoded secrets..."
SECRETS_FOUND=0

# Check for common secret patterns
if grep -r "sk_live_" src/ --exclude-dir=node_modules 2>/dev/null; then
    echo -e "${RED}❌ Found Stripe live secret key in code!${NC}"
    SECRETS_FOUND=1
fi

if grep -r "sk_test_" src/ --exclude-dir=node_modules 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Found Stripe test secret key in code${NC}"
fi

if grep -r "password.*=.*['\"]" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "password:" | grep -v "// "; then
    echo -e "${YELLOW}⚠️  Found potential hardcoded password${NC}"
fi

if [ $SECRETS_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ PASS: No obvious hardcoded secrets found${NC}"
else
    echo -e "${RED}❌ FAIL: Hardcoded secrets found!${NC}"
    exit 1
fi
echo ""

# Check 4: NPM audit
echo "📋 Check 4: Running npm audit..."
if npm audit --audit-level=high; then
    echo -e "${GREEN}✅ PASS: No high/critical vulnerabilities${NC}"
else
    echo -e "${RED}❌ FAIL: Vulnerabilities found!${NC}"
    echo "   Action: Run 'npm audit fix' to resolve"
    exit 1
fi
echo ""

# Check 5: Check for console.log with sensitive data
echo "📋 Check 5: Checking for console.log with sensitive data..."
CONSOLE_ISSUES=0

if grep -r "console\.log.*password" src/ --exclude-dir=node_modules 2>/dev/null; then
    echo -e "${RED}❌ Found console.log with 'password'${NC}"
    CONSOLE_ISSUES=1
fi

if grep -r "console\.log.*token" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "csrf"; then
    echo -e "${YELLOW}⚠️  Found console.log with 'token'${NC}"
fi

if grep -r "console\.log.*secret" src/ --exclude-dir=node_modules 2>/dev/null; then
    echo -e "${RED}❌ Found console.log with 'secret'${NC}"
    CONSOLE_ISSUES=1
fi

if [ $CONSOLE_ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ PASS: No obvious sensitive data in console.log${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING: Review console.log statements${NC}"
fi
echo ""

# Check 6: Verify CSRF protection in POST/PUT/DELETE endpoints
echo "📋 Check 6: Checking CSRF protection in API routes..."
MISSING_CSRF=0

# Find all POST/PUT/DELETE handlers
for file in $(find src/app/api -name "route.ts" -o -name "route.js"); do
    if grep -q "export async function POST\|export async function PUT\|export async function DELETE" "$file"; then
        if ! grep -q "requireCsrfToken\|withAdminAuth\|withAuth" "$file"; then
            echo -e "${YELLOW}⚠️  Missing CSRF protection: $file${NC}"
            MISSING_CSRF=1
        fi
    fi
done

if [ $MISSING_CSRF -eq 0 ]; then
    echo -e "${GREEN}✅ PASS: All endpoints have CSRF protection${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING: Some endpoints may be missing CSRF protection${NC}"
    echo "   Action: Review endpoints and add requireCsrfToken() or use withAuth wrappers"
fi
echo ""

# Check 7: Verify admin endpoints have authentication
echo "📋 Check 7: Checking admin endpoints for authentication..."
MISSING_AUTH=0

for file in $(find src/app/api/admin -name "route.ts" -o -name "route.js"); do
    if ! grep -q "withAdminAuth\|verifyAdminAuth\|AdminAuthService" "$file"; then
        echo -e "${YELLOW}⚠️  Missing admin auth: $file${NC}"
        MISSING_AUTH=1
    fi
done

if [ $MISSING_AUTH -eq 0 ]; then
    echo -e "${GREEN}✅ PASS: All admin endpoints have authentication${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING: Some admin endpoints may be missing authentication${NC}"
    echo "   Action: Review admin endpoints and add withAdminAuth()"
fi
echo ""

# Check 8: Verify environment variables are set
echo "📋 Check 8: Checking required environment variables..."
MISSING_ENV=0

REQUIRED_VARS=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "CREDENTIALS_ENCRYPTION_KEY"
    "CUSTOM_ID_SECRET"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${YELLOW}⚠️  Missing: $var${NC}"
        MISSING_ENV=1
    fi
done

if [ $MISSING_ENV -eq 0 ]; then
    echo -e "${GREEN}✅ PASS: All required environment variables are set${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING: Some environment variables are missing${NC}"
    echo "   Note: This is expected in CI/CD. Ensure they're set in production."
fi
echo ""

# Summary
echo "========================="
echo "🎉 Security Check Complete"
echo "========================="
echo ""
echo "Next steps:"
echo "1. Review any warnings above"
echo "2. Run 'npm audit fix' if vulnerabilities found"
echo "3. Ensure all environment variables are set in production"
echo "4. Review and update dependencies regularly"
echo ""
echo "For more information, see:"
echo "- docs/security-audit-2025.md"
echo "- docs/security-best-practices.md"
echo "- SECURITY_IMPROVEMENTS_APPLIED.md"

