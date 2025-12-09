# Script para verificar los headers de caché en producción
# Uso: .\scripts\test-cache-headers.ps1 [domain]
# Ejemplo: .\scripts\test-cache-headers.ps1 purvitahealth.com

param(
    [string]$Domain = "purvitahealth.com"
)

$Protocol = "https"

Write-Host "🔍 Verificando headers de caché para: $Domain" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Función para verificar headers
function Check-Headers {
    param(
        [string]$Url,
        [string]$ExpectedCache,
        [string]$Description
    )
    
    Write-Host "📄 $Description" -ForegroundColor Yellow
    Write-Host "URL: $Url"
    
    try {
        # Obtener headers
        $response = Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing -ErrorAction Stop
        
        # Extraer Cache-Control
        $cacheControl = $response.Headers['Cache-Control']
        $cfCacheStatus = $response.Headers['CF-Cache-Status']
        
        Write-Host "Cache-Control: $cacheControl"
        
        if ($cfCacheStatus) {
            Write-Host "CF-Cache-Status: $cfCacheStatus"
        }
        
        # Verificar si coincide con lo esperado
        if ($cacheControl -match $ExpectedCache) {
            Write-Host "✅ Headers correctos" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Headers no coinciden con lo esperado: $ExpectedCache" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "❌ Error al obtener headers: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "=== PÁGINAS DINÁMICAS (NO DEBEN CACHEAR) ===" -ForegroundColor Magenta
Write-Host ""

Check-Headers `
    -Url "$Protocol`://$Domain/en/dashboard" `
    -ExpectedCache "private.*no-cache" `
    -Description "Dashboard (autenticado)"

Check-Headers `
    -Url "$Protocol`://$Domain/en/profile" `
    -ExpectedCache "private.*no-cache" `
    -Description "Perfil de usuario"

Check-Headers `
    -Url "$Protocol`://$Domain/admin" `
    -ExpectedCache "private.*no-cache" `
    -Description "Panel de administración"

Write-Host "=== PÁGINAS PÚBLICAS (CACHE CORTO) ===" -ForegroundColor Magenta
Write-Host ""

Check-Headers `
    -Url "$Protocol`://$Domain/en" `
    -ExpectedCache "public.*s-maxage" `
    -Description "Landing page"

Check-Headers `
    -Url "$Protocol`://$Domain/en/products" `
    -ExpectedCache "public.*s-maxage" `
    -Description "Página de productos"

Write-Host "=== ASSETS ESTÁTICOS (CACHE LARGO) ===" -ForegroundColor Magenta
Write-Host ""

Check-Headers `
    -Url "$Protocol`://$Domain/favicon.ico" `
    -ExpectedCache "public.*max-age" `
    -Description "Favicon"

# Nota: Los assets de _next/static tienen hashes únicos
Write-Host "📄 Assets de Next.js (_next/static/)" -ForegroundColor Yellow
Write-Host "Nota: Estos archivos tienen hashes únicos y deben tener:"
Write-Host "Cache-Control: public, max-age=31536000, immutable"
Write-Host ""

Write-Host "=== APIs ===" -ForegroundColor Magenta
Write-Host ""

Check-Headers `
    -Url "$Protocol`://$Domain/api/settings/free-product-value" `
    -ExpectedCache "public.*s-maxage" `
    -Description "API de configuración pública"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "✅ Verificación completada" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Consejos:" -ForegroundColor Cyan
Write-Host "  - Si ves CF-Cache-Status: HIT, Cloudflare está cacheando"
Write-Host "  - Si ves CF-Cache-Status: DYNAMIC o BYPASS, no está cacheando (correcto para páginas dinámicas)"
Write-Host "  - Si ves CF-Cache-Status: MISS, es la primera petición (la siguiente debería ser HIT)"
Write-Host ""
Write-Host "🔧 Para purgar caché de Cloudflare:" -ForegroundColor Cyan
Write-Host "  1. Ve a tu panel de Cloudflare"
Write-Host "  2. Caching → Configuration → Purge Everything"
Write-Host ""

