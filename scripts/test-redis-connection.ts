/**
 * Script de prueba para verificar la conexión a Upstash Redis
 * 
 * Uso:
 *   npx tsx scripts/test-redis-connection.ts
 * 
 * Este script verifica:
 * - Que las variables de entorno estén configuradas
 * - Que la conexión a Redis funcione
 * - Que las operaciones básicas (get/set/delete) funcionen
 */

import { redisCache, CacheKeys } from '../src/lib/redis';

async function testRedisConnection() {
  console.log('🔍 Verificando configuración de Redis...\n');

  // Verificar variables de entorno
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    console.error('❌ Error: Variables de entorno no configuradas');
    console.log('\nAsegúrate de tener las siguientes variables en tu .env.local:');
    console.log('  UPSTASH_REDIS_REST_URL=https://...');
    console.log('  UPSTASH_REDIS_REST_TOKEN=...');
    console.log('\nVer docs/redis-setup.md para más información.');
    process.exit(1);
  }

  console.log('✅ Variables de entorno configuradas');
  console.log(`   URL: ${redisUrl.substring(0, 30)}...`);
  console.log(`   Token: ${redisToken.substring(0, 20)}...\n`);

  // Verificar disponibilidad
  if (!redisCache.isAvailable()) {
    console.error('❌ Error: Redis no está disponible');
    process.exit(1);
  }

  console.log('✅ Cliente Redis inicializado\n');

  // Test 1: Set
  console.log('📝 Test 1: Guardar valor en caché...');
  const testKey = 'test:connection';
  const testValue = {
    message: 'Hello from Redis!',
    timestamp: new Date().toISOString(),
  };

  const setResult = await redisCache.set(testKey, testValue, 60);
  if (!setResult) {
    console.error('❌ Error al guardar en caché');
    process.exit(1);
  }
  console.log('✅ Valor guardado exitosamente\n');

  // Test 2: Get
  console.log('📖 Test 2: Obtener valor de caché...');
  const getValue = await redisCache.get<typeof testValue>(testKey);
  if (!getValue) {
    console.error('❌ Error al obtener de caché');
    process.exit(1);
  }
  console.log('✅ Valor obtenido:', getValue);
  console.log('');

  // Test 3: Exists
  console.log('🔎 Test 3: Verificar existencia...');
  const exists = await redisCache.exists(testKey);
  if (!exists) {
    console.error('❌ Error: La clave debería existir');
    process.exit(1);
  }
  console.log('✅ Clave existe en Redis\n');

  // Test 4: TTL
  console.log('⏱️  Test 4: Verificar TTL...');
  const ttl = await redisCache.ttl(testKey);
  if (ttl === null || ttl <= 0) {
    console.error('❌ Error: TTL inválido');
    process.exit(1);
  }
  console.log(`✅ TTL: ${ttl} segundos\n`);

  // Test 5: Increment
  console.log('➕ Test 5: Incrementar contador...');
  const counterKey = 'test:counter';
  const count1 = await redisCache.increment(counterKey);
  const count2 = await redisCache.increment(counterKey);
  if (count1 === null || count2 === null || count2 !== count1 + 1) {
    console.error('❌ Error al incrementar contador');
    process.exit(1);
  }
  console.log(`✅ Contador: ${count1} → ${count2}\n`);

  // Test 6: Delete
  console.log('🗑️  Test 6: Eliminar valores...');
  await redisCache.delete(testKey);
  await redisCache.delete(counterKey);
  
  const existsAfterDelete = await redisCache.exists(testKey);
  if (existsAfterDelete) {
    console.error('❌ Error: La clave debería haber sido eliminada');
    process.exit(1);
  }
  console.log('✅ Valores eliminados exitosamente\n');

  // Test 7: Get-or-Set
  console.log('🔄 Test 7: Patrón get-or-set...');
  let fetcherCalled = false;
  const getOrSetValue = await redisCache.getOrSet(
    'test:get-or-set',
    async () => {
      fetcherCalled = true;
      return { data: 'Fetched from source' };
    },
    60
  );

  if (!fetcherCalled) {
    console.error('❌ Error: El fetcher debería haber sido llamado');
    process.exit(1);
  }

  // Segunda llamada - debería usar caché
  fetcherCalled = false;
  const cachedValue = await redisCache.getOrSet(
    'test:get-or-set',
    async () => {
      fetcherCalled = true;
      return { data: 'This should not be called' };
    },
    60
  );

  if (fetcherCalled) {
    console.error('❌ Error: El fetcher no debería haber sido llamado (debería usar caché)');
    process.exit(1);
  }

  console.log('✅ Get-or-set funciona correctamente');
  console.log(`   Primera llamada: ${JSON.stringify(getOrSetValue)}`);
  console.log(`   Segunda llamada (caché): ${JSON.stringify(cachedValue)}\n`);

  // Limpiar
  await redisCache.delete('test:get-or-set');

  // Test 8: CacheKeys
  console.log('🔑 Test 8: Generadores de claves...');
  const keys = {
    appSettings: CacheKeys.appSettings(),
    user: CacheKeys.user('123'),
    userProfile: CacheKeys.userProfile('123'),
    product: CacheKeys.product('abc'),
    translation: CacheKeys.translation('es', 'common'),
    rateLimit: CacheKeys.rateLimit('user-123'),
  };

  console.log('✅ Claves generadas:');
  Object.entries(keys).forEach(([name, key]) => {
    console.log(`   ${name}: ${key}`);
  });
  console.log('');

  // Resumen
  console.log('═══════════════════════════════════════════════════════');
  console.log('🎉 ¡Todos los tests pasaron exitosamente!');
  console.log('═══════════════════════════════════════════════════════');
  console.log('\n✅ Redis está configurado correctamente y funcionando');
  console.log('✅ Todas las operaciones básicas funcionan');
  console.log('✅ Los generadores de claves funcionan correctamente');
  console.log('\n📚 Próximos pasos:');
  console.log('   1. Implementar caché en tus servicios');
  console.log('   2. Agregar rate limiting a tus API routes');
  console.log('   3. Ver docs/redis-setup.md para más ejemplos');
  console.log('');
}

// Ejecutar tests
testRedisConnection()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error durante los tests:', error);
    process.exit(1);
  });

