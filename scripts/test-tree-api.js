#!/usr/bin/env node

/**
 * Test Tree API Script
 *
 * Tests the /api/tree endpoint to verify MLM network structure.
 *
 * Usage:
 *   node scripts/test-tree-api.js <user-id> [options]
 *   npm run test:tree <user-id> [options]
 *
 * Options:
 *   --base-url <url>    Base URL [default: http://localhost:9002]
 *   --timeout <ms>      Request timeout in milliseconds [default: 10000]
 *   --verbose           Show detailed member information
 *   --json              Output raw JSON response
 *
 * Examples:
 *   node scripts/test-tree-api.js abc-123-def-456
 *   node scripts/test-tree-api.js abc-123 --verbose
 *   node scripts/test-tree-api.js abc-123 --base-url http://localhost:3000
 *
 * Exit codes:
 *   0 - API call successful
 *   1 - Invalid arguments
 *   2 - API call failed
 */

require('dotenv').config({ path: '.env.local' });

// Use native fetch (Node.js 18+)
const fetch = globalThis.fetch;

// Constants
const DEFAULT_BASE_URL = process.env.BASE_URL || 'http://localhost:9002';
const DEFAULT_TIMEOUT = 10000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates if a string is a valid UUID
 * @param {string} str - String to validate
 * @returns {boolean}
 */
function isValidUUID(str) {
  return UUID_REGEX.test(str);
}

/**
 * Prints usage instructions
 */
function printUsage() {
  console.log('📝 Uso:');
  console.log('   node scripts/test-tree-api.js <user-id> [options]\n');
  console.log('Opciones:');
  console.log('   --base-url <url>    URL base [default: http://localhost:9002]');
  console.log('   --timeout <ms>      Timeout en milisegundos [default: 10000]');
  console.log('   --verbose           Mostrar información detallada de miembros');
  console.log('   --json              Mostrar respuesta JSON cruda\n');
  console.log('Ejemplos:');
  console.log('   node scripts/test-tree-api.js abc-123-def-456');
  console.log('   node scripts/test-tree-api.js abc-123 --verbose');
  console.log('   node scripts/test-tree-api.js abc-123 --base-url http://localhost:3000\n');
  console.log('💡 Obtén un user_id desde:');
  console.log('   Supabase Dashboard → Authentication → Users\n');
}

/**
 * Parses command line arguments
 * @returns {Object} Configuration object
 */
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0].startsWith('--')) {
    printUsage();
    process.exit(0);
  }

  const config = {
    userId: args[0],
    baseUrl: DEFAULT_BASE_URL,
    timeout: DEFAULT_TIMEOUT,
    verbose: false,
    json: false,
  };

  // Validate user ID
  if (!isValidUUID(config.userId)) {
    console.error('❌ Error: user-id debe ser un UUID válido\n');
    console.error('Formato esperado: 12345678-1234-1234-1234-123456789abc\n');
    process.exit(1);
  }

  // Parse options
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--base-url':
        if (!nextArg) {
          console.error('❌ Error: --base-url requiere un valor\n');
          process.exit(1);
        }
        config.baseUrl = nextArg;
        i++;
        break;

      case '--timeout':
        if (!nextArg) {
          console.error('❌ Error: --timeout requiere un valor\n');
          process.exit(1);
        }
        const timeout = parseInt(nextArg, 10);
        if (isNaN(timeout) || timeout <= 0) {
          console.error('❌ Error: --timeout debe ser un número positivo\n');
          process.exit(1);
        }
        config.timeout = timeout;
        i++;
        break;

      case '--verbose':
        config.verbose = true;
        break;

      case '--json':
        config.json = true;
        break;

      default:
        console.error(`❌ Error: opción desconocida "${arg}"\n`);
        printUsage();
        process.exit(1);
    }
  }

  return config;
}

/**
 * Makes API call with timeout
 * @param {Object} config - Request configuration
 * @returns {Promise<Response>}
 */
async function makeApiCall(config) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const url = `${config.baseUrl}/api/tree`;
    const response = await fetch(url, {
      headers: {
        'x-user-id': config.userId,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Displays tree structure in a formatted way
 * @param {Object} data - Tree data
 * @param {boolean} verbose - Show detailed information
 */
function displayTreeStructure(data, verbose) {
  console.log('\n📊 Resumen del Árbol MLM:\n');
  console.log('═'.repeat(60));

  // Basic stats
  console.log('📈 Estadísticas Generales:');
  console.log(`   Nivel máximo: ${data.maxLevel ?? 'N/A'}`);
  console.log(`   Tiene niveles: ${!!data.levels ? 'Sí' : 'No'}`);

  if (data.level1) {
    console.log(`   Nivel 1 (directos): ${data.level1.length} miembros`);
  }
  if (data.level2) {
    console.log(`   Nivel 2: ${data.level2.length} miembros`);
  }

  // Total members count
  let totalMembers = 0;
  if (data.levels) {
    Object.values(data.levels).forEach(members => {
      totalMembers += members.length;
    });
    console.log(`   Total de miembros: ${totalMembers}`);
  }

  console.log('═'.repeat(60));

  // Levels breakdown
  if (data.levels) {
    console.log('\n🌳 Estructura por Niveles:\n');

    const levelNumbers = Object.keys(data.levels).map(Number).sort((a, b) => a - b);

    levelNumbers.forEach(level => {
      const members = data.levels[level];
      console.log(`📍 Nivel ${level}: ${members.length} miembro(s)`);

      if (verbose && members.length > 0) {
        members.forEach((member, index) => {
          const status = member.status || 'sin suscripción';
          const email = member.email || 'N/A';
          const name = member.name || 'Sin nombre';
          const userId = member.user_id || member.id || 'N/A';

          console.log(`   ${index + 1}. ${name} (${email})`);
          console.log(`      ID: ${userId}`);
          console.log(`      Estado: ${status}`);

          if (member.subscription_end) {
            console.log(`      Suscripción hasta: ${member.subscription_end}`);
          }
          if (member.phase !== undefined) {
            console.log(`      Fase: ${member.phase}`);
          }
          console.log('');
        });
      } else if (members.length > 0) {
        // Show summary without verbose
        const withSubscription = members.filter(m => m.status && m.status !== 'sin suscripción').length;
        console.log(`   └─ ${withSubscription} con suscripción activa`);
      }
      console.log('');
    });
  }

  // Legacy format support (level1, level2)
  if (data.level1 && !data.levels) {
    console.log('\n🌳 Estructura (formato legacy):\n');
    console.log(`📍 Nivel 1: ${data.level1.length} miembro(s)`);
    if (verbose) {
      data.level1.forEach((member, index) => {
        console.log(`   ${index + 1}. ${member.email || 'N/A'} (${member.status || 'sin suscripción'})`);
      });
    }
    console.log('');
  }

  if (data.level2 && !data.levels) {
    console.log(`📍 Nivel 2: ${data.level2.length} miembro(s)`);
    if (verbose) {
      data.level2.forEach((member, index) => {
        console.log(`   ${index + 1}. ${member.email || 'N/A'} (${member.status || 'sin suscripción'})`);
      });
    }
    console.log('');
  }

  console.log('═'.repeat(60));
}

/**
 * Tests the Tree API endpoint
 * @param {Object} config - Request configuration
 */
async function testTreeAPI(config) {
  console.log('🧪 Probando Tree API...\n');
  console.log('📋 Configuración:');
  console.log(`   User ID: ${config.userId}`);
  console.log(`   Base URL: ${config.baseUrl}`);
  console.log(`   URL completa: ${config.baseUrl}/api/tree`);
  console.log(`   Timeout: ${config.timeout}ms`);
  console.log(`   Modo verbose: ${config.verbose ? 'Sí' : 'No'}`);
  console.log(`   Salida JSON: ${config.json ? 'Sí' : 'No'}\n`);

  try {
    const startTime = Date.now();
    const response = await makeApiCall(config);
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`📡 Respuesta recibida en ${duration}ms`);
    console.log(`   Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      console.error('❌ Error en la API:');
      const errorData = await response.text();
      console.error('   Detalles:', errorData);
      console.error('\n🔍 Posibles causas:');
      console.error('   1. El usuario no existe');
      console.error('   2. El usuario no tiene red MLM');
      console.error('   3. Error de autenticación');
      console.error('   4. El endpoint requiere permisos especiales\n');
      process.exit(2);
    }

    const data = await response.json();

    if (config.json) {
      // Raw JSON output
      console.log('📄 Respuesta JSON:\n');
      console.log(JSON.stringify(data, null, 2));
    } else {
      // Formatted output
      displayTreeStructure(data, config.verbose);
    }

    console.log('\n✅ Tree API funciona correctamente!\n');
    process.exit(0);

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`❌ Timeout: El servidor no respondió en ${config.timeout / 1000} segundos\n`);
    } else {
      console.error('❌ Error al hacer la llamada:\n');
      console.error(`   ${error.message}\n`);
    }

    console.error('🔍 Posibles causas:');
    console.error('   1. El servidor no está corriendo (ejecuta: npm run dev)');
    console.error('   2. La URL base es incorrecta');
    console.error('   3. Problema de red o firewall\n');

    process.exit(2);
  }
}

// Main execution
const config = parseArgs();
testTreeAPI(config);

