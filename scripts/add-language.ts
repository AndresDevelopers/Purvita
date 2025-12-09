#!/usr/bin/env tsx
/**
 * Script para agregar un nuevo idioma al sistema i18n
 * 
 * Uso:
 *   npm run add-language -- --code fr --name "Français"
 *   npm run add-language -- --code pt --name "Português" --auto-translate
 */

import * as fs from 'fs';
import * as path from 'path';

interface LanguageConfig {
  code: string;
  name: string;
  autoTranslate?: boolean;
}

const LOCALES_DIR = path.join(process.cwd(), 'src/i18n/dictionaries/locales');
const FLAGS_DIR = path.join(process.cwd(), 'public/flags');

function parseArgs(): LanguageConfig {
  const args = process.argv.slice(2);
  const config: Partial<LanguageConfig> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--code' && args[i + 1]) {
      config.code = args[i + 1].toLowerCase();
      i++;
    } else if (args[i] === '--name' && args[i + 1]) {
      config.name = args[i + 1];
      i++;
    } else if (args[i] === '--auto-translate') {
      config.autoTranslate = true;
    }
  }

  if (!config.code || !config.name) {
    console.error('❌ Error: Se requieren --code y --name');
    console.log('\nUso:');
    console.log('  npm run add-language -- --code fr --name "Français"');
    console.log('  npm run add-language -- --code pt --name "Português" --auto-translate');
    process.exit(1);
  }

  return config as LanguageConfig;
}

function createLanguageFile(code: string, name: string): void {
  const filePath = path.join(LOCALES_DIR, `${code}.ts`);

  if (fs.existsSync(filePath)) {
    console.log(`⚠️  El archivo ${code}.ts ya existe. Saltando...`);
    return;
  }

  const content = `import type { DictionaryOverrides } from '../types';
import { sanitizeAppNameForEmailDomain } from '../default';

/**
 * ${name} translations
 * 
 * Solo necesitas traducir las claves que quieres sobrescribir.
 * El resto se heredará del diccionario default (inglés).
 * 
 * Para ver todas las claves disponibles, revisa:
 * src/i18n/dictionaries/default.ts
 */
export const create${code.charAt(0).toUpperCase() + code.slice(1)}Dictionary = (
  appName: string,
): DictionaryOverrides => ({
  appName,

  navigation: {
    products: "Products", // TODO: Traducir
    dashboard: "Dashboard", // TODO: Traducir
    team: "Team", // TODO: Traducir
    classes: "Classes", // TODO: Traducir
    orders: "Orders", // TODO: Traducir
    cart: "Cart", // TODO: Traducir
    resources: "Resources", // TODO: Traducir
    login: "Log In", // TODO: Traducir
    register: "Sign Up", // TODO: Traducir
  },

  landing: {
    heroTitle: "Empowering Health, Enriching Lives", // TODO: Traducir
    heroSubtitle: \`Join \${appName} and embark on a journey towards better health and financial freedom.\`, // TODO: Traducir
    explorePlans: "Explore Plans", // TODO: Traducir
    joinNow: "Join Now", // TODO: Traducir
  },

  // Agrega más traducciones aquí según necesites
  // Puedes copiar secciones completas de es.ts como referencia
});
`;

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`✅ Creado: ${filePath}`);
}

function updateIndexFile(code: string, _name: string): void {
  const indexPath = path.join(LOCALES_DIR, 'index.ts');
  let content = fs.readFileSync(indexPath, 'utf-8');

  const capitalizedCode = code.charAt(0).toUpperCase() + code.slice(1);
  const importStatement = `import { create${capitalizedCode}Dictionary } from './${code}';`;
  const factoryEntry = `  ${code}: create${capitalizedCode}Dictionary,`;

  // Verificar si ya existe
  if (content.includes(importStatement)) {
    console.log(`⚠️  El idioma ${code} ya está registrado en index.ts. Saltando...`);
    return;
  }

  // Agregar import
  const lastImportIndex = content.lastIndexOf('import');
  const endOfLastImport = content.indexOf(';', lastImportIndex) + 1;
  content = content.slice(0, endOfLastImport) + '\n' + importStatement + content.slice(endOfLastImport);

  // Agregar factory
  const factoriesStart = content.indexOf('export const localeFactories = {');
  const factoriesEnd = content.indexOf('} satisfies', factoriesStart);
  const lastFactoryLine = content.lastIndexOf(',', factoriesEnd);
  content = content.slice(0, lastFactoryLine + 1) + '\n' + factoryEntry + content.slice(lastFactoryLine + 1);

  fs.writeFileSync(indexPath, content, 'utf-8');
  console.log(`✅ Actualizado: ${indexPath}`);
}

function createFlagPlaceholder(code: string): void {
  const flagPath = path.join(FLAGS_DIR, `${code}.png`);

  if (fs.existsSync(flagPath)) {
    console.log(`⚠️  La bandera ${code}.png ya existe. Saltando...`);
    return;
  }

  console.log(`\n📝 NOTA: Necesitas agregar manualmente la bandera:`);
  console.log(`   Archivo: public/flags/${code}.png`);
  console.log(`   Tamaño recomendado: 32x32px o 64x64px`);
  console.log(`   Puedes descargar banderas de: https://flagicons.lipis.dev/`);
}

function showNextSteps(code: string, _name: string): void {
  console.log('\n' + '='.repeat(60));
  console.log('🎉 ¡Idioma agregado exitosamente!');
  console.log('='.repeat(60));
  console.log(`\n📋 Próximos pasos:\n`);
  console.log(`1. Edita el archivo de traducciones:`);
  console.log(`   src/i18n/dictionaries/locales/${code}.ts`);
  console.log(`\n2. Traduce las claves marcadas con "TODO: Traducir"`);
  console.log(`   Puedes usar src/i18n/dictionaries/locales/es.ts como referencia`);
  console.log(`\n3. Agrega la bandera del país:`);
  console.log(`   public/flags/${code}.png`);
  console.log(`\n4. ¡Listo! El idioma aparecerá automáticamente en:`);
  console.log(`   - Selector de idiomas del header`);
  console.log(`   - Rutas: /${code}/dashboard, /${code}/products, etc.`);
  console.log(`   - Panel admin: ?lang=${code}`);
  console.log(`\n5. Para probar:`);
  console.log(`   npm run dev`);
  console.log(`   Visita: http://localhost:3000/${code}`);
  console.log('\n' + '='.repeat(60));
}

function showAutoTranslateInfo(): void {
  console.log('\n💡 TIP: Traducción automática');
  console.log('='.repeat(60));
  console.log('Para traducir automáticamente, puedes usar:');
  console.log('1. DeepL API (mejor calidad): https://www.deepl.com/pro-api');
  console.log('2. Google Translate API: https://cloud.google.com/translate');
  console.log('3. Herramientas online: https://translate.google.com');
  console.log('\nO puedes crear un script personalizado que use estas APIs.');
  console.log('='.repeat(60));
}

// Main
async function main() {
  console.log('\n🌍 Generador de Idiomas - PūrVita Network\n');

  const config = parseArgs();

  console.log(`Agregando idioma: ${config.name} (${config.code})\n`);

  // Crear archivos
  createLanguageFile(config.code, config.name);
  updateIndexFile(config.code, config.name);
  createFlagPlaceholder(config.code);

  // Mostrar siguientes pasos
  showNextSteps(config.code, config.name);

  if (config.autoTranslate) {
    showAutoTranslateInfo();
  }
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

