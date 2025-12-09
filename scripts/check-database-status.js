#!/usr/bin/env node

/**
 * Database Status Diagnostic Script
 * 
 * Verifies the existence of required database tables for the payout system.
 * 
 * Usage: node scripts/check-database-status.js
 * 
 * Exit codes:
 *   0 - All tables exist
 *   1 - Missing environment variables or connection error
 *   2 - Missing required tables
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Constants
const REQUIRED_TABLES = [
  'profiles',
  'network_commissions',
  'payout_accounts',
  'payout_preferences',
  'wallet',
  'subscriptions'
];

const SERVICE_KEY_PREVIEW_LENGTH = 20;

// Environment validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Variables de entorno faltantes\n');
  console.error('Asegúrate de tener en .env.local:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=tu-url');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=tu-service-key\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Checks if a table exists in the database
 * @param {string} tableName - Name of the table to check
 * @returns {Promise<{exists: boolean, error: string|null, code?: string}>}
 */
async function checkTable(tableName) {
  try {
    // Use head:true to avoid fetching data, just check if table exists
    const { error } = await supabase
      .from(tableName)
      .select('*', { head: true });
    
    if (error) {
      // PostgreSQL error code 42P01 = "relation does not exist"
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return { exists: false, error: 'Tabla no existe', code: error.code || '42P01' };
      }
      // Any other error with service_role likely means table exists but query failed
      // Log the error for debugging but don't fail the check
      console.warn(`   ⚠️  ${tableName}: ${error.message} (code: ${error.code})`);
      return { exists: true, error: null };
    }
    
    return { exists: true, error: null };
  } catch (err) {
    return { 
      exists: false, 
      error: err.message || 'Error desconocido',
      code: 'UNKNOWN'
    };
  }
}

/**
 * Validates connection to Supabase
 * @returns {Promise<boolean>}
 */
async function validateConnection() {
  try {
    // Try to query any table with head:true (no data fetched)
    const { error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    // Even if table doesn't exist, connection is valid if we get a proper PostgreSQL error
    // Connection errors would be different (network, auth, etc.)
    return !error || error.code === '42P01' || error.message.includes('does not exist');
  } catch (err) {
    return false;
  }
}

/**
 * Provides migration guidance based on missing tables
 * @param {string[]} missingTables - Array of missing table names
 */
function provideMigrationGuidance(missingTables) {
  console.log('❌ Tablas faltantes detectadas:\n');
  missingTables.forEach(table => {
    console.log(`   • ${table}`);
  });
  console.log('');
  console.log('🔧 Solución:\n');
  
  const needsPayoutMigration = missingTables.some(t =>
    ['network_commissions', 'payout_accounts', 'payout_preferences'].includes(t)
  );
  
  const needsFullSchema = missingTables.includes('profiles') || missingTables.length > 2;
  
  if (needsPayoutMigration && !needsFullSchema) {
    console.log('Ejecuta las migraciones de pagos:');
    console.log('1. Abre Supabase Dashboard → SQL Editor');
    console.log('2. Ejecuta: docs/database/migrations/20250106-create-payout-tables.sql');
    console.log('3. Ejecuta: supabase/migrations/20250214_add_payout_preferences_table.sql\n');
  }
  
  if (needsFullSchema) {
    console.log('Ejecuta el esquema completo:');
    console.log('1. Abre Supabase Dashboard → SQL Editor');
    console.log('2. Ejecuta: docs/database/database.sql\n');
  }
  
  console.log('📖 Guía detallada: EJECUTAR_MIGRACION.md\n');
}

/**
 * Main diagnostic function
 */
async function main() {
  console.log('🔍 Verificando estado de la base de datos...\n');
  
  // Display connection info
  console.log('📡 Conexión a Supabase:');
  console.log(`   URL: ${supabaseUrl}`);
  console.log(`   Service Key: ${supabaseServiceKey.substring(0, SERVICE_KEY_PREVIEW_LENGTH)}...\n`);
  
  // Validate connection
  console.log('🔌 Validando conexión...');
  const isConnected = await validateConnection();
  
  if (!isConnected) {
    console.error('❌ No se pudo conectar a Supabase');
    console.error('   Verifica que las credenciales sean correctas\n');
    process.exit(1);
  }
  
  console.log('✅ Conexión exitosa\n');
  
  // Check all tables concurrently for better performance
  console.log('📊 Estado de las tablas:\n');
  
  const tableChecks = REQUIRED_TABLES.map(async (table) => ({
    table,
    result: await checkTable(table)
  }));
  
  const results = await Promise.all(tableChecks);
  
  // Display results
  const resultsMap = {};
  results.forEach(({ table, result }) => {
    resultsMap[table] = result;
    
    if (result.exists) {
      console.log(`   ✅ ${table.padEnd(25)} - Existe`);
    } else {
      const errorDetail = result.code ? ` (${result.code})` : '';
      console.log(`   ❌ ${table.padEnd(25)} - ${result.error}${errorDetail}`);
    }
  });
  
  console.log('');
  
  // Analyze results
  const missingTables = results
    .filter(({ result }) => !result.exists)
    .map(({ table }) => table);
  
  if (missingTables.length === 0) {
    console.log('✅ Todas las tablas necesarias existen\n');
    console.log('Si aún ves el error "Failed to load payout settings":');
    console.log('1. Verifica que estés autenticado en la aplicación');
    console.log('2. Revisa la consola del navegador (F12) para más detalles');
    console.log('3. Reinicia el servidor de desarrollo: npm run dev\n');
    process.exit(0);
  } else {
    provideMigrationGuidance(missingTables);
    process.exit(2);
  }
}

// Execute with proper error handling
main().catch(err => {
  console.error('\n❌ Error crítico al ejecutar el diagnóstico:');
  console.error(`   ${err.message}\n`);
  if (err.stack) {
    console.error('Stack trace:');
    console.error(err.stack);
  }
  process.exit(1);
});
