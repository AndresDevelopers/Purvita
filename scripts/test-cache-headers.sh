#!/bin/bash

# Script para verificar los headers de caché en producción
# Uso: ./scripts/test-cache-headers.sh [domain]
# Ejemplo: ./scripts/test-cache-headers.sh purvitahealth.com

DOMAIN="${1:-purvitahealth.com}"
PROTOCOL="https"

echo "🔍 Verificando headers de caché para: $DOMAIN"
echo "================================================"
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para verificar headers
check_headers() {
    local url=$1
    local expected_cache=$2
    local description=$3
    
    echo -e "${YELLOW}📄 $description${NC}"
    echo "URL: $url"
    
    # Obtener headers
    headers=$(curl -s -I "$url" 2>&1)
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Error al obtener headers${NC}"
        echo ""
        return
    fi
    
    # Extraer Cache-Control
    cache_control=$(echo "$headers" | grep -i "cache-control:" | cut -d' ' -f2-)
    cf_cache_status=$(echo "$headers" | grep -i "cf-cache-status:" | cut -d' ' -f2-)
    
    echo "Cache-Control: $cache_control"
    
    if [ ! -z "$cf_cache_status" ]; then
        echo "CF-Cache-Status: $cf_cache_status"
    fi
    
    # Verificar si coincide con lo esperado
    if echo "$cache_control" | grep -qi "$expected_cache"; then
        echo -e "${GREEN}✅ Headers correctos${NC}"
    else
        echo -e "${RED}⚠️  Headers no coinciden con lo esperado: $expected_cache${NC}"
    fi
    
    echo ""
}

echo "=== PÁGINAS DINÁMICAS (NO DEBEN CACHEAR) ==="
echo ""

check_headers \
    "$PROTOCOL://$DOMAIN/en/dashboard" \
    "private.*no-cache" \
    "Dashboard (autenticado)"

check_headers \
    "$PROTOCOL://$DOMAIN/en/profile" \
    "private.*no-cache" \
    "Perfil de usuario"

check_headers \
    "$PROTOCOL://$DOMAIN/admin" \
    "private.*no-cache" \
    "Panel de administración"

echo "=== PÁGINAS PÚBLICAS (CACHE CORTO) ==="
echo ""

check_headers \
    "$PROTOCOL://$DOMAIN/en" \
    "public.*s-maxage" \
    "Landing page"

check_headers \
    "$PROTOCOL://$DOMAIN/en/products" \
    "public.*s-maxage" \
    "Página de productos"

echo "=== ASSETS ESTÁTICOS (CACHE LARGO) ==="
echo ""

check_headers \
    "$PROTOCOL://$DOMAIN/favicon.ico" \
    "public.*max-age" \
    "Favicon"

# Nota: Los assets de _next/static tienen hashes únicos, difícil de testear sin conocer el hash
echo -e "${YELLOW}📄 Assets de Next.js (_next/static/)${NC}"
echo "Nota: Estos archivos tienen hashes únicos y deben tener:"
echo "Cache-Control: public, max-age=31536000, immutable"
echo ""

echo "=== APIs ==="
echo ""

check_headers \
    "$PROTOCOL://$DOMAIN/api/settings/free-product-value" \
    "public.*s-maxage" \
    "API de configuración pública"

echo "================================================"
echo "✅ Verificación completada"
echo ""
echo "💡 Consejos:"
echo "  - Si ves CF-Cache-Status: HIT, Cloudflare está cacheando"
echo "  - Si ves CF-Cache-Status: DYNAMIC o BYPASS, no está cacheando (correcto para páginas dinámicas)"
echo "  - Si ves CF-Cache-Status: MISS, es la primera petición (la siguiente debería ser HIT)"
echo ""
echo "🔧 Para purgar caché de Cloudflare:"
echo "  1. Ve a tu panel de Cloudflare"
echo "  2. Caching → Configuration → Purge Everything"
echo ""

