/**
 * Script para verificar el estado de Redis
 * 
 * Uso:
 *   npx tsx scripts/check-redis-status.ts
 * 
 * Este script muestra:
 * - Si Redis está habilitado o deshabilitado
 * - El entorno actual (development/production)
 * - Si las variables de entorno están configuradas
 * - Qué tipo de caché se está usando
 */

import { redisCache } from '../src/lib/redis';

function checkRedisStatus() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 Estado de Redis en PūrVita');
  console.log('═══════════════════════════════════════════════════════\n');

  // Verificar entorno
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  console.log('📊 Información del Entorno:');
  console.log(`   NODE_ENV: ${nodeEnv}`);
  console.log(`   Modo: ${isProduction ? 'Producción' : 'Desarrollo'}\n`);

  // Verificar variables de entorno
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  console.log('🔑 Variables de Entorno:');
  if (redisUrl && redisToken) {
    console.log(`   ✅ UPSTASH_REDIS_REST_URL: ${redisUrl.substring(0, 30)}...`);
    console.log(`   ✅ UPSTASH_REDIS_REST_TOKEN: ${redisToken.substring(0, 20)}...`);
  } else {
    console.log('   ❌ Variables de Redis NO configuradas');
    if (!redisUrl) console.log('      - UPSTASH_REDIS_REST_URL no encontrada');
    if (!redisToken) console.log('      - UPSTASH_REDIS_REST_TOKEN no encontrada');
  }
  console.log('');

  // Verificar estado de Redis
  const isAvailable = redisCache.isAvailable();

  console.log('🎯 Estado de Redis:');
  if (isAvailable) {
    console.log('   ✅ Redis HABILITADO');
    console.log('   📦 Tipo de caché: Upstash Redis (distribuido)');
    console.log('   🌐 Compartido entre instancias: Sí');
    console.log('   💾 Persistencia: Sí');
  } else {
    console.log('   ❌ Redis DESHABILITADO');
    console.log('   📦 Tipo de caché: Memoria local (fallback)');
    console.log('   🌐 Compartido entre instancias: No');
    console.log('   💾 Persistencia: No (se pierde al reiniciar)');
  }
  console.log('');

  // Explicar por qué está habilitado/deshabilitado
  console.log('📝 Razón:');
  if (!isProduction) {
    console.log('   Redis está deshabilitado porque estás en modo DESARROLLO.');
    console.log('   Esto es intencional para:');
    console.log('   - No requerir cuenta de Upstash para desarrollar');
    console.log('   - Ahorrar comandos del plan gratuito');
    console.log('   - Desarrollo más rápido sin conexiones externas');
    console.log('   - Funcionar offline');
  } else if (!redisUrl || !redisToken) {
    console.log('   Redis está deshabilitado porque las variables de entorno');
    console.log('   no están configuradas, aunque estás en modo PRODUCCIÓN.');
  } else {
    console.log('   Redis está habilitado porque:');
    console.log('   - Estás en modo PRODUCCIÓN');
    console.log('   - Las variables de entorno están configuradas');
  }
  console.log('');

  // Recomendaciones
  console.log('💡 Recomendaciones:');
  if (!isProduction) {
    console.log('   ✅ Configuración correcta para desarrollo');
    console.log('   ℹ️  No necesitas hacer nada');
    console.log('   ℹ️  La aplicación usa caché en memoria automáticamente');
    console.log('');
    console.log('   Si quieres probar Redis en desarrollo:');
    console.log('   1. Configura las variables en .env.local');
    console.log('   2. Agrega NODE_ENV=production a .env.local');
    console.log('   3. Reinicia el servidor');
  } else if (!redisUrl || !redisToken) {
    console.log('   ⚠️  Estás en producción pero Redis no está configurado');
    console.log('   📋 Para habilitar Redis:');
    console.log('   1. Crea una cuenta en https://console.upstash.com/');
    console.log('   2. Crea una base de datos Redis');
    console.log('   3. Configura las variables de entorno:');
    console.log('      - UPSTASH_REDIS_REST_URL');
    console.log('      - UPSTASH_REDIS_REST_TOKEN');
    console.log('   4. Reinicia la aplicación');
  } else {
    console.log('   ✅ Configuración correcta para producción');
    console.log('   ✅ Redis está activo y funcionando');
    console.log('   ℹ️  Monitorea el uso en https://console.upstash.com/');
  }
  console.log('');

  // Información adicional
  console.log('📚 Documentación:');
  console.log('   - Guía completa: docs/redis-setup.md');
  console.log('   - Comportamiento Dev/Prod: docs/REDIS_BEHAVIOR.md');
  console.log('   - Ejemplos: docs/examples/redis-integration-examples.md');
  console.log('');

  console.log('═══════════════════════════════════════════════════════');
}

// Ejecutar verificación
checkRedisStatus();

