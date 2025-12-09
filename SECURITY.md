# Política de Seguridad

## Versiones soportadas

Nos comprometemos a mantener actualizaciones de seguridad para la última versión principal publicada.

| Versión | Estado |
| ------- | ------ |
| 1.x.x   | ✅ Soportada |

## Reporte de vulnerabilidades

Agradecemos y valoramos los reportes responsables. Para informar un incidente de seguridad:

1. Envía un correo cifrado o plano a [security@purvita.network](mailto:security@purvita.network) con:
   - Descripción clara de la vulnerabilidad y su impacto potencial.
   - Pasos para reproducir el problema o pruebas de concepto.
   - Información del entorno afectado (versión, sistema operativo, navegador, etc.).
2. Como alternativa, crea un reporte privado mediante GitHub Security Advisories.
3. No publiques información sensible en issues públicas ni redes sociales.

### Plazos y seguimiento

- Confirmaremos la recepción en un máximo de **48 horas**.
- Proporcionaremos una evaluación inicial en un plazo de **5 días hábiles**.
- Trabajaremos contigo para coordinar divulgación responsable y, si corresponde, publicación de parches y notas de seguridad.

### Buenas prácticas para colaboradores

- Nunca incluyas secretos ni claves en commits. Usa variables de entorno y actualiza `.env.example` cuando añadas una nueva.
- Realiza validaciones estrictas de entrada y salida usando los esquemas definidos con Zod.
- Asegura encabezados de seguridad (CSP, HSTS, X-Frame-Options), protección CSRF y políticas CORS restrictivas al modificar el backend.
- Implementa límites de velocidad, manejo seguro de sesiones y registros de auditoría al introducir nuevas rutas.

Gracias por contribuir a mantener segura la comunidad PūrVita.
