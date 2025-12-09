## 🏗️ Principios de Arquitectura

### Organización del Código

- **Feature-First**: Organizar siempre por funcionalidad, nunca por tipo de archivo  
- **Separación de Responsabilidades**: Implementar patrones que separen lógica de negocio, presentación y datos  
- **Modularidad**: Crear módulos reutilizables y auto-contenidos  
- **Inyección de Dependencias**: Evitar dependencias hardcoded

### Patrones de Diseño Obligatorios

- **Repository Pattern**: Para acceso a datos  
- **Factory Pattern**: Para creación de objetos complejos  
- **Observer Pattern**: Para manejo de eventos y estado reactivo  
- **Error Boundary Pattern**: Para manejo resiliente de errores

### UX Mobile Obligatorio

- **Loading States**: Estados de carga claros y rápidos  
- **Error States**: Manejo de errores mobile-friendly  
- **Empty States**: Estados vacíos informativos  
- **Pull to Refresh**: Actualización por gesto cuando aplique  
- **Infinite Scroll**: Paginación optimizada para móvil  
- **Haptic Feedback**: Feedback táctil en acciones importantes  
- **Safe Areas**: Respeto por notch y áreas seguras

### Principios Mobile-First

- **Mobile-First Design**: Diseñar SIEMPRE primero para móvil, luego escalar a desktop  
- **Responsive Design**: Breakpoints obligatorios: 320px, 768px, 1024px, 1440px  
- **Touch-Friendly**: Elementos táctiles mínimo 44px x 44px  
- **Performance Mobile**: Optimización específica para conexiones lentas

## 🔒 Seguridad Obligatoria

### Variables y Configuración

- **Zero Hardcoding**: Nunca valores privados fijos en código fuente  
- **Variables de Entorno**: Todas las configuraciones sensibles en variables de entorno  
- **Plantilla de Variables**: Crear archivo de ejemplo con todas las variables necesarias para desarrollo  
- **Rotación de Secrets**: Implementar rotación automática de claves sensibles

### Headers y Protección

- **Security Headers**: CSP, HSTS, X-Frame-Options, CSRF tokens  
- **Input Validation**: Validación estricta en cliente Y servidor  
- **Output Encoding**: Escapar toda salida hacia el usuario  
- **Rate Limiting**: Implementar límites de requests por usuario/IP  
- **CORS Policy**: Configuración restrictiva de CORS

### Autenticación y Autorización

- **Principio de Menor Privilegio**: Acceso mínimo necesario  
- **Session Management**: Manejo seguro de sesiones  
- **Multi-Factor Authentication**: Soporte para 2FA cuando sea posible  
- **Audit Logs**: Registro de acciones críticas del usuario

## 🧠 Principios para Comprensión de IA

### Estructura de Proyecto Predecible

- **Naming Conventions**: Nombres descriptivos y consistentes  
- **File Organization**: Estructura lógica que refleje la funcionalidad  
- **Dependency Tree**: Dependencias claras y documentadas  
- **API Contracts**: Interfaces bien definidas entre módulos

### 📁 Archivos GitHub Obligatorios

- **LICENSE**: Elegir MIT, Apache-2.0 o GPL-3.0  
- **README.md**: Setup, arquitectura y guías completas  
- **CONTRIBUTING.md**: Guías detalladas para contribuir  
- **CODE\_OF\_CONDUCT.md**: Código de conducta del proyecto  
- **SECURITY.md**: Política de seguridad y reporte de vulnerabilidades

### Templates y Configuración

- **.gitignore**: Plantilla completa para Node.js/Next.js  
- **issue\_templates/**: Bug report y feature request  
- **PR templates**: Plantillas para pull requests  
- **Workflows**: GitHub Actions configurados

### Documentación para IA

- **Context Comments**: Comentarios que explican el "por qué" y contexto de negocio  
- **Decision Records**: Documentar decisiones arquitectónicas importantes  
- **API Documentation**: Specs completas de endpoints y contratos  
- **Data Flow Documentation**: Cómo fluyen los datos en el sistema  
- **State Management Documentation**: Cómo se gestiona el estado global y local

### Metadatos del Proyecto

- **Package.json Completo**: Scripts, dependencias y metadatos claros  
- **Schema Definitions**: Esquemas de datos explícitos y tipados  
- **Configuration Files**: Archivos de configuración bien comentados  
- **Environment Documentation**: Explicación de diferentes entornos (dev y prod)

## 🛡️ Validación y Tipos

### Validación Obligatoria

- **Schema Validation**: Validación de esquemas en entrada y salida de datos  
- **Type Safety**: Tipado estricto en todo el código  
- **Runtime Validation**: Validación en tiempo de ejecución  
- **Error Handling**: Manejo consistente y predecible de errores

### Contratos de Datos

- **API Schemas**: Definición explícita de contratos de API  
- **Database Schemas**: Esquemas de base de datos documentados  
- **Event Schemas**: Estructura de eventos y mensajes  
- **Configuration Schemas**: Validación de archivos de configuración

## 🧪 Testing y Calidad Obligatorios

### Cobertura de Testing

- **Unit Tests**: Coverage mínimo 80% en lógica de negocio crítica  
- **Integration Tests**: Testing de integración entre módulos  
- **E2E Tests**: Testing de flujos completos de usuario  
- **Contract Tests**: Validación de contratos entre servicios

### Testing Mobile Obligatorio

- **Network Testing**: Pruebas en 3G lento, 4G, WiFi  
- **Orientation Testing**: Portrait y landscape  
- **Touch Testing**: Gestos táctiles y accesibilidad  
- **Performance Testing**: Core Web Vitals en móvil

### Calidad de Código

- **Static Analysis**: Análisis estático automatizado  
- **Code Complexity**: Límites en complejidad ciclomática  
- **Dependency Analysis**: Análisis de vulnerabilidades en dependencias  
- **Performance Testing**: Testing de performance automatizado

## 🔄 CI/CD y Automatización

### Pipeline Obligatorio

- **Automated Testing**: Ejecución automática de todos los tests  
- **Security Scanning**: Análisis de vulnerabilidades automatizado  
- **Code Quality Gates**: No permitir código que no cumple estándares  
- **Automated Deployment**: Deploy automático tras validaciones

### Monitoreo y Observabilidad

- **Error Tracking**: Sistema de tracking de errores en producción  
- **Performance Monitoring**: Métricas de performance en tiempo real  
- **Health Checks**: Endpoints de salud del sistema  
- **Audit Trails**: Logs de acciones críticas

## 🌐 Resilencia y Disponibilidad

### Patrones de Resilencia

- **Circuit Breaker**: Para prevenir cascada de fallos  
- **Retry Logic**: Reintentos con backoff exponencial  
- **Timeout Management**: Timeouts apropiados en todas las operaciones  
- **Graceful Degradation**: Funcionalidad reducida ante fallos

### Performance

- **Resource Optimization**: Optimización de recursos y assets  
- **Load Balancing**: Distribución de carga cuando aplique

## 📊 Observabilidad para IA

### Métricas y Logs

- **Structured Logging**: Logs estructurados y searchables  
- **Business Metrics**: Métricas de negocio relevantes  
- **Technical Metrics**: CPU, memoria, latencia, throughput  
- **User Experience Metrics**: Core Web Vitals, user journeys

### Debugging y Troubleshooting

- **Debug Information**: Información suficiente para debugging  
- **Correlation IDs**: Trazabilidad de requests a través del sistema  
- **Error Context**: Contexto completo en mensajes de error  
- **Performance Profiling**: Capacidad de profiling en producción

## 🔧 Estándares de Versionado y Releases

### Control de Versiones

- **Semantic Versioning**: Versionado semántico estricto  
- **Release Notes**: Notas de release automatizadas  
- **Changelog**: Changelog automático basado en commits

### Gestión de Dependencias

- **Dependency Pinning**: Versiones específicas de dependencias críticas  
- **Security Updates**: Actualizaciones de seguridad automatizadas  
- **Deprecation Strategy**: Plan para deprecar funcionalidades obsoletas  
- **Compatibility Matrix**: Documentar compatibilidades entre versiones

---

## 🎯 Filosofía Central para IA

**Principio Fundamental**: Toda decisión de código debe ser **auditable**, **reproducible** y **comprensible** por cualquier IA que analice el proyecto en el futuro.

**Regla de Oro**: Si una IA no puede entender el propósito, funcionamiento y contexto de un módulo en 30 segundos de análisis, el código necesita mejor documentación o refactoring.

**Objetivo**: Crear sistemas que sean **self-explaining** para facilitar mantenimiento, debugging y evolución asistida por IA.

Prueba el nuevo código en los test y si pasa agregalo al proyecto original, Nunca modifiques los test para que pasen con el nuevo código, por seguridad para no romper nada NO hagas eso.
Ejecuta es run lint y run typecheck para ver si todo esta bien y al final ejecuta run build para ver que todo esta correcto.