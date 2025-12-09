/**
 * Script para crear la ruta física del admin bypass dinámicamente
 * basándose en NEXT_PUBLIC_ADMIN_BYPASS_URL
 *
 * Este script:
 * 1. Lee la URL configurada en NEXT_PUBLIC_ADMIN_BYPASS_URL
 * 2. Elimina TODAS las carpetas de bypass anteriores (excepto las rutas estándar)
 * 3. Crea la nueva carpeta con la URL configurada
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const bypassUrl = process.env.NEXT_PUBLIC_ADMIN_BYPASS_URL || 'purvitaadmin';
const langDir = path.join(__dirname, '..', 'src', 'app', '[lang]');
const routePath = path.join(langDir, bypassUrl);
const pageFilePath = path.join(routePath, 'page.tsx');

// Lista de carpetas que NO deben eliminarse (rutas estándar de la aplicación)
const protectedFolders = [
  'admin-bypass',
  'affiliate',
  'analytics',
  'auth',
  'cart',
  'checkout',
  'classes',
  'company-team',
  'contact',
  'dashboard',
  'income-calculator',
  'login',
  'logout',
  'marketing',
  'orders',
  'privacy',
  'products',
  'profile',
  'register',
  'settings',
  'subscription',
  'subscriptions',
  'team',
  'teams',
  'terms',
  'wallet',
];

// Función para verificar si una carpeta es una ruta de bypass antigua
function isOldBypassRoute(folderName) {
  // No es una carpeta protegida
  if (protectedFolders.includes(folderName)) {
    return false;
  }

  // No es la carpeta actual configurada
  if (folderName === bypassUrl) {
    return false;
  }

  // No es un archivo
  const folderPath = path.join(langDir, folderName);
  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    return false;
  }

  // Verificar si tiene un page.tsx que parece ser de bypass
  const pagePath = path.join(folderPath, 'page.tsx');
  if (fs.existsSync(pagePath)) {
    const content = fs.readFileSync(pagePath, 'utf8');
    // Si contiene "DYNAMIC ADMIN BYPASS" o "AdminBypassPage", es una ruta de bypass
    if (content.includes('DYNAMIC ADMIN BYPASS') || content.includes('AdminBypassPage')) {
      return true;
    }
  }

  return false;
}

// Limpiar rutas de bypass antiguas
console.log('\n🔍 Buscando rutas de bypass antiguas...');
const folders = fs.readdirSync(langDir);
let removedCount = 0;

folders.forEach(folder => {
  if (isOldBypassRoute(folder)) {
    const oldRoutePath = path.join(langDir, folder);
    console.log(`🗑️  Eliminando ruta antigua: ${folder}`);
    fs.rmSync(oldRoutePath, { recursive: true, force: true });
    removedCount++;
  }
});

if (removedCount > 0) {
  console.log(`✅ Eliminadas ${removedCount} ruta(s) de bypass antigua(s)\n`);
} else {
  console.log(`✅ No se encontraron rutas antiguas para eliminar\n`);
}

// Crear el directorio si no existe
if (!fs.existsSync(routePath)) {
  fs.mkdirSync(routePath, { recursive: true });
  console.log(`✅ Created directory: ${routePath}`);
} else {
  console.log(`ℹ️  Directory already exists: ${routePath}`);
}

// Contenido del archivo page.tsx
const pageContent = `import { redirect } from 'next/navigation';

/**
 * ✅ DYNAMIC ADMIN BYPASS ROUTE
 *
 * Esta ruta fue generada automáticamente por scripts/setup-bypass-route.js
 * basándose en NEXT_PUBLIC_ADMIN_BYPASS_URL=${bypassUrl}
 *
 * IMPORTANTE: Esta página redirige SIEMPRE al admin login (con o sin token).
 */
export default async function AdminBypassPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  // Redirigir SIEMPRE al admin login (sin validar token)
  redirect(\`/admin/login?lang=\${lang}\`);
}
`;

// Escribir el archivo
fs.writeFileSync(pageFilePath, pageContent, 'utf8');
console.log(`✅ Created file: ${pageFilePath}`);
console.log(`\n🎉 Admin bypass route configured for: /${bypassUrl}`);
console.log(`   Access it at: http://localhost:9001/es/${bypassUrl}`);
console.log(`   Redirects to: /admin/login?lang=es\n`);

