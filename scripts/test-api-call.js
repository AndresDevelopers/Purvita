#!/usr/bin/env node

/**
 * Test API Call Script
 *
 * Generic API endpoint testing tool with flexible configuration.
 *
 * Usage:
 *   node scripts/test-api-call.js <endpoint> [options]
 *   npm run test:api <endpoint> [options]
 *
 * Options:
 *   --user-id <id>      User ID for x-user-id header
 *   --method <method>   HTTP method (GET, POST, PUT, DELETE) [default: GET]
 *   --body <json>       Request body as JSON string
 *   --header <key:val>  Additional headers (can be used multiple times)
 *   --base-url <url>    Base URL [default: http://localhost:9002]
 *   --timeout <ms>      Request timeout in milliseconds [default: 10000]
 *
 * Examples:
 *   # Test profile summary
 *   node scripts/test-api-call.js /api/profile/summary --user-id abc-123
 *
 *   # Test with POST and body
 *   node scripts/test-api-call.js /api/products --method POST --body '{"name":"Test"}'
 *
 *   # Test with custom headers
 *   node scripts/test-api-call.js /api/data --header "Authorization:Bearer token"
 *
 * Exit codes:
 *   0 - API call successful
 *   1 - Invalid arguments or configuration
 *   2 - API call failed
 */

require('dotenv').config({ path: '.env.local' });

// Use native fetch (Node.js 18+)
const fetch = globalThis.fetch;

// Constants
const DEFAULT_BASE_URL = process.env.BASE_URL || 'http://localhost:9002';
const DEFAULT_TIMEOUT = 10000; // 10 seconds
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
    console.log('   node scripts/test-api-call.js <endpoint> [options]\n');
    console.log('Opciones:');
    console.log('   --user-id <id>      User ID para header x-user-id');
    console.log('   --method <method>   Método HTTP (GET, POST, PUT, DELETE) [default: GET]');
    console.log('   --body <json>       Cuerpo de la petición como JSON string');
    console.log('   --header <key:val>  Headers adicionales (puede usarse múltiples veces)');
    console.log('   --base-url <url>    URL base [default: http://localhost:9002]');
    console.log('   --timeout <ms>      Timeout en milisegundos [default: 10000]\n');
    console.log('Ejemplos:');
    console.log('   node scripts/test-api-call.js /api/profile/summary --user-id abc-123');
    console.log('   node scripts/test-api-call.js /api/products --method POST --body \'{"name":"Test"}\'');
    console.log('   node scripts/test-api-call.js /api/data --header "Authorization:Bearer token"\n');
}

/**
 * Parses and validates command line arguments
 * @returns {Object} Parsed configuration
 */
function parseArgs() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0].startsWith('--')) {
        printUsage();
        process.exit(0);
    }

    const config = {
        endpoint: args[0],
        userId: null,
        method: 'GET',
        body: null,
        headers: {},
        baseUrl: DEFAULT_BASE_URL,
        timeout: DEFAULT_TIMEOUT,
    };

    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];

        switch (arg) {
            case '--user-id':
                if (!nextArg) {
                    console.error('❌ Error: --user-id requiere un valor\n');
                    process.exit(1);
                }
                if (!isValidUUID(nextArg)) {
                    console.error('❌ Error: user-id debe ser un UUID válido\n');
                    console.error('Formato esperado: 12345678-1234-1234-1234-123456789abc\n');
                    process.exit(1);
                }
                config.userId = nextArg;
                i++;
                break;

            case '--method':
                if (!nextArg) {
                    console.error('❌ Error: --method requiere un valor\n');
                    process.exit(1);
                }
                const method = nextArg.toUpperCase();
                if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
                    console.error('❌ Error: método inválido. Use GET, POST, PUT, DELETE o PATCH\n');
                    process.exit(1);
                }
                config.method = method;
                i++;
                break;

            case '--body':
                if (!nextArg) {
                    console.error('❌ Error: --body requiere un valor\n');
                    process.exit(1);
                }
                try {
                    config.body = JSON.parse(nextArg);
                } catch (error) {
                    console.error('❌ Error: --body debe ser JSON válido\n');
                    console.error('Ejemplo: --body \'{"key":"value"}\'\n');
                    process.exit(1);
                }
                i++;
                break;

            case '--header':
                if (!nextArg) {
                    console.error('❌ Error: --header requiere un valor\n');
                    process.exit(1);
                }
                const [key, ...valueParts] = nextArg.split(':');
                const value = valueParts.join(':');
                if (!key || !value) {
                    console.error('❌ Error: --header debe tener formato "key:value"\n');
                    process.exit(1);
                }
                config.headers[key.trim()] = value.trim();
                i++;
                break;

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

            default:
                console.error(`❌ Error: opción desconocida "${arg}"\n`);
                printUsage();
                process.exit(1);
        }
    }

    // Validate endpoint
    if (!config.endpoint.startsWith('/')) {
        console.error('❌ Error: el endpoint debe comenzar con "/"\n');
        console.error('Ejemplo: /api/profile/summary\n');
        process.exit(1);
    }

    return config;
}

/**
 * Analyzes and displays error details
 * @param {Object} data - Error response data
 * @param {string} endpoint - The endpoint that was called
 */
function analyzeError(data, endpoint) {
    console.log('\n🔍 Análisis del error:');

    if (data.error === 'Database tables not initialized') {
        console.log('   → Las tablas no existen en la base de datos');
        console.log('   → Ejecuta las migraciones SQL necesarias en Supabase\n');
        return;
    }

    if (data.error === 'Missing x-user-id header') {
        console.log('   → Falta el header x-user-id');
        console.log('   → Usa: --user-id <uuid>\n');
        return;
    }

    if (data.error) {
        console.log(`   → ${data.error}\n`);
    }

    if (data.details) {
        console.log(`   → Detalles: ${data.details}\n`);

        if (data.details.includes('does not exist')) {
            console.log('   💡 Solución: Ejecuta las migraciones SQL en Supabase');
            console.log('      Revisa la carpeta docs/database/migrations/\n');
        }
    }

    if (data.message) {
        console.log(`   → Mensaje: ${data.message}\n`);
    }
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
        const url = `${config.baseUrl}${config.endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...config.headers,
        };

        // Add user-id header if provided
        if (config.userId) {
            headers['x-user-id'] = config.userId;
        }

        const options = {
            method: config.method,
            headers,
            signal: controller.signal,
        };

        // Add body for non-GET requests
        if (config.body && config.method !== 'GET') {
            options.body = JSON.stringify(config.body);
        }

        const response = await fetch(url, options);

        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Formats and displays response data
 * @param {any} data - Response data
 * @param {number} maxLength - Maximum length to display
 */
function displayResponse(data, maxLength = 2000) {
    const jsonString = JSON.stringify(data, null, 2);

    if (jsonString.length > maxLength) {
        console.log(jsonString.substring(0, maxLength));
        console.log(`\n... (truncado, ${jsonString.length - maxLength} caracteres más)`);
    } else {
        console.log(jsonString);
    }
}

/**
 * Tests the API endpoint
 * @param {Object} config - Request configuration
 */
async function testApiCall(config) {
    console.log('🧪 Probando llamada a API...\n');
    console.log('📋 Configuración:');
    console.log(`   Endpoint: ${config.endpoint}`);
    console.log(`   Método: ${config.method}`);
    console.log(`   Base URL: ${config.baseUrl}`);
    console.log(`   URL completa: ${config.baseUrl}${config.endpoint}`);

    if (config.userId) {
        console.log(`   User ID: ${config.userId}`);
    }

    if (Object.keys(config.headers).length > 0) {
        console.log('   Headers adicionales:');
        Object.entries(config.headers).forEach(([key, value]) => {
            // Ocultar valores sensibles
            const displayValue = key.toLowerCase().includes('auth') || key.toLowerCase().includes('token')
                ? value.substring(0, 10) + '...'
                : value;
            console.log(`      ${key}: ${displayValue}`);
        });
    }

    if (config.body) {
        console.log('   Body:');
        console.log('      ' + JSON.stringify(config.body, null, 2).split('\n').join('\n      '));
    }

    console.log(`   Timeout: ${config.timeout}ms\n`);

    try {
        const startTime = Date.now();
        const response = await makeApiCall(config);
        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`📡 Respuesta recibida en ${duration}ms`);
        console.log(`   Status: ${response.status} ${response.statusText}`);
        console.log(`   Headers:`);

        // Display important response headers
        const importantHeaders = ['content-type', 'cache-control', 'x-ratelimit-remaining', 'x-response-time'];
        importantHeaders.forEach(header => {
            const value = response.headers.get(header);
            if (value) {
                console.log(`      ${header}: ${value}`);
            }
        });

        console.log('');

        // Try to parse response as JSON
        let data;
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (response.ok) {
            console.log('✅ Respuesta exitosa:\n');
            if (typeof data === 'string') {
                console.log(data);
            } else {
                displayResponse(data);
            }
            console.log('\n✅ La API funciona correctamente!\n');
            process.exit(0);
        } else {
            console.error('❌ Error en la respuesta:\n');
            if (typeof data === 'string') {
                console.error(data);
            } else {
                displayResponse(data);
            }
            analyzeError(typeof data === 'object' ? data : { error: data }, config.endpoint);
            process.exit(2);
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`❌ Timeout: El servidor no respondió en ${config.timeout / 1000} segundos\n`);
        } else {
            console.error('❌ Error al hacer la llamada:\n');
            console.error(`   ${error.message}\n`);
        }

        console.error('🔍 Posibles causas:');
        console.error('   1. El servidor no está corriendo (ejecuta: npm run dev)');
        console.error('   2. La URL base es incorrecta (verifica --base-url)');
        console.error('   3. El endpoint no existe o tiene un typo');
        console.error('   4. Problema de red o firewall');
        console.error('   5. El servidor requiere autenticación adicional\n');

        process.exit(2);
    }
}

// Main execution
const config = parseArgs();
testApiCall(config);
