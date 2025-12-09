# Guía de contribución a PūrVita

¡Gracias por tu interés en colaborar! Esta guía describe cómo proponer cambios de forma segura, consistente y alineada con los estándares del proyecto.

## Cómo puedo contribuir

### Reportar bugs

1. Revisa que el bug no exista ya en la sección de [Issues](https://github.com/purvita-network/purvita/issues).
2. Si no encuentras un reporte similar, crea uno nuevo describiendo:
   - Resumen claro del problema.
   - Pasos para reproducirlo (idealmente con gifs o capturas).
   - Resultado esperado vs resultado actual.
   - Información del entorno (SO, navegador, versión de Node.js, etc.).
   - Registros relevantes (logs, stack traces, respuestas HTTP).

### Proponer mejoras o nuevas funcionalidades

1. Abre una issue de tipo _feature request_ describiendo la necesidad y su impacto en la experiencia de usuario o negocio.
2. Explica brevemente la solución sugerida, dependencias involucradas y cualquier consideración de arquitectura.
3. Espera la retroalimentación del equipo para alinear prioridades antes de iniciar el desarrollo.

### Pull Requests

1. Haz un fork del repositorio y crea una rama desde `main` con un nombre descriptivo (`feature/contacto-resend`, `fix/admin-roles`, etc.).
2. Sigue la organización **feature-first**: cada módulo debe agrupar componentes, hooks, servicios y estilos relacionados con la funcionalidad que implementa.
3. Mantén los commits atómicos y con mensajes en modo imperativo ("Agrega validación", "Corrige layout móvil").
4. Ejecuta las comprobaciones locales obligatorias antes de enviar el PR:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
5. Adjunta al PR evidencia de las pruebas (capturas, resultados de comandos) y resume los cambios clave, impactos en la arquitectura y posibles riesgos.
6. Solicita revisión y atiende los comentarios puntualmente. Si haces _force push_, agrega una nota detallando los ajustes.

## Estándares de estilo

### Código

- Usa TypeScript estricto y evita `any` no tipados.
- No hardcodees credenciales ni valores sensibles; utiliza variables de entorno y actualiza `.env.example` cuando añadas una nueva.
- Respeta los patrones definidos: Repository, Factory, Observer y Error Boundary.
- Mantén componentes y servicios pequeños, documentados y con responsabilidades claras.
- Añade comentarios contextuales cuando el motivo de una decisión no sea evidente.

### Mensajes de commit

- Presente e imperativo ("Corrige", "Implementa").
- Máximo 72 caracteres en el encabezado.
- Agrega descripciones adicionales en el cuerpo si el contexto lo requiere.
- Referencia issues y PRs cuando corresponda (`Refs #123`).

### Documentación

- Actualiza la documentación relevante (README, docs/, comentarios) cada vez que cambies la arquitectura, contratos de API o comportamiento observable.
- Mantén la información sincronizada en todos los idiomas disponibles.

## Configuración del entorno

1. Duplica `.env.example` como `.env.local` y completa cada variable descrita.
2. Ejecuta las migraciones SQL disponibles en `docs/database/` según el módulo que estés modificando.
3. Usa `npm run dev` para desarrollar con recarga en caliente.
4. Activa las herramientas de accesibilidad y pruebas móviles al trabajar en vistas (Device Toolbar de Chrome, Lighthouse, etc.).

## Calidad, pruebas y cobertura

- Cubre al menos el 80 % de la lógica crítica con pruebas unitarias e integración.
- Añade pruebas end-to-end cuando afectes flujos principales (registro, compra, contacto).
- No modifiques pruebas existentes solo para que pasen; si fallan, investiga y corrige la causa raíz.
- Adjunta los resultados de Vitest y cualquier herramienta adicional (por ejemplo, `npx vitest --run --coverage`).

## Comunicación y soporte

- Para dudas rápidas utiliza los hilos de discusión en la issue correspondiente.
- Para temas de arquitectura o decisiones estratégicas crea un registro en `docs/adr/` siguiendo el formato existente.
- Los reportes de seguridad deben enviarse según la política descrita en [SECURITY.md](SECURITY.md).

Gracias por ayudar a que PūrVita siga creciendo con calidad y transparencia.
