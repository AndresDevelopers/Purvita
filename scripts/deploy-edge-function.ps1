# Script para desplegar la Edge Function de Registration Access Code
# Ejecutar desde la raíz del proyecto

Write-Host "🚀 Desplegando Edge Function: registration-access-code" -ForegroundColor Cyan
Write-Host ""

# Verificar que Supabase CLI esté instalado
Write-Host "📋 Verificando Supabase CLI..." -ForegroundColor Yellow
$supabaseVersion = & supabase --version 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Supabase CLI no está instalado" -ForegroundColor Red
    Write-Host ""
    Write-Host "Instala Supabase CLI con uno de estos métodos:" -ForegroundColor Yellow
    Write-Host "  1. npm install -g supabase" -ForegroundColor White
    Write-Host "  2. scoop install supabase" -ForegroundColor White
    Write-Host "  3. Descarga desde: https://github.com/supabase/cli/releases" -ForegroundColor White
    Write-Host ""
    Write-Host "Luego ejecuta este script nuevamente." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Supabase CLI instalado: $supabaseVersion" -ForegroundColor Green
Write-Host ""

# Verificar que el archivo de la función existe
$functionPath = "supabase/functions/registration-access-code/index.ts"
if (-not (Test-Path $functionPath)) {
    Write-Host "❌ No se encuentra el archivo: $functionPath" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Archivo de función encontrado" -ForegroundColor Green
Write-Host ""

# Verificar si ya está linkeado a un proyecto
Write-Host "📋 Verificando link al proyecto..." -ForegroundColor Yellow
$linkStatus = & supabase status 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  No estás linkeado a un proyecto de Supabase" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Opciones:" -ForegroundColor Cyan
    Write-Host "  1. Link interactivo: supabase link" -ForegroundColor White
    Write-Host "  2. Link directo: supabase link --project-ref purvita-developers" -ForegroundColor White
    Write-Host ""
    
    $response = Read-Host "¿Quieres hacer link ahora? (s/n)"
    
    if ($response -eq "s" -or $response -eq "S") {
        Write-Host ""
        Write-Host "Ejecutando: supabase link" -ForegroundColor Cyan
        & supabase link
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Error al hacer link al proyecto" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "❌ Necesitas linkear al proyecto primero" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ Proyecto linkeado" -ForegroundColor Green
Write-Host ""

# Desplegar la función
Write-Host "🚀 Desplegando función..." -ForegroundColor Cyan
Write-Host ""

& supabase functions deploy registration-access-code

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Error al desplegar la función" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Función desplegada exitosamente!" -ForegroundColor Green
Write-Host ""

# Preguntar si quiere ver los logs
$viewLogs = Read-Host "¿Quieres ver los logs de la función? (s/n)"

if ($viewLogs -eq "s" -or $viewLogs -eq "S") {
    Write-Host ""
    Write-Host "📊 Mostrando logs (Ctrl+C para salir)..." -ForegroundColor Cyan
    Write-Host ""
    & supabase functions logs registration-access-code --follow
}

Write-Host ""
Write-Host "🎉 Deployment completado!" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Cyan
Write-Host "  1. Configura el cron job semanal (ver supabase/DEPLOY-EDGE-FUNCTION.md)" -ForegroundColor White
Write-Host "  2. Prueba la función manualmente" -ForegroundColor White
Write-Host "  3. Monitorea los logs" -ForegroundColor White
Write-Host ""
