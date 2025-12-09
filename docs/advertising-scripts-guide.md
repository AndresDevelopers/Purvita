# Guía de Scripts de Publicidad

Esta guía explica cómo configurar y gestionar los scripts de publicidad (Facebook Pixel, TikTok Pixel, Google Tag Manager) en el panel de administración.

## 📋 Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Acceso a la Configuración](#acceso-a-la-configuración)
- [Facebook Pixel](#facebook-pixel)
- [TikTok Pixel](#tiktok-pixel)
- [Google Tag Manager](#google-tag-manager)
- [Importante: Páginas de Afiliados](#importante-páginas-de-afiliados)
- [Verificación](#verificación)

## Descripción General

Los scripts de publicidad permiten rastrear conversiones, eventos y comportamiento de usuarios en tu sitio web. Esta funcionalidad te permite configurar:

- **Facebook Pixel**: Para rastrear conversiones de anuncios de Facebook/Instagram
- **TikTok Pixel**: Para rastrear conversiones de anuncios de TikTok
- **Google Tag Manager**: Para gestionar múltiples etiquetas de seguimiento en un solo lugar

**⚠️ IMPORTANTE**: Estos scripts **SOLO** se inyectan en las páginas públicas principales del sitio. **NO** se inyectan en las páginas personalizadas de afiliados para proteger la privacidad de los afiliados y evitar conflictos de seguimiento.

## Acceso a la Configuración

1. Inicia sesión en el panel de administración
2. En el menú lateral, busca **"Scripts de Publicidad"** o **"Advertising Scripts"**
3. Haz clic para acceder a la página de configuración

## Facebook Pixel

### Obtener el Código de Facebook Pixel

1. Ve a [Facebook Events Manager](https://business.facebook.com/events_manager)
2. Selecciona tu Pixel o crea uno nuevo
3. Ve a **"Configuración"** → **"Instalación del Pixel"**
4. Copia el código completo del Pixel (incluye las etiquetas `<script>`)

### Configurar en el Admin

1. Activa el switch **"Habilitar Facebook Pixel"**
2. Ingresa el **ID del Pixel** (ejemplo: `1234567890`)
3. Pega el **código completo del script** en el campo de texto
4. Haz clic en **"Guardar Configuración"**

### Ejemplo de Código

```html
<!-- Facebook Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'TU_PIXEL_ID');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=TU_PIXEL_ID&ev=PageView&noscript=1"
/></noscript>
<!-- End Facebook Pixel Code -->
```

## TikTok Pixel

### Obtener el Código de TikTok Pixel

1. Ve a [TikTok Ads Manager](https://ads.tiktok.com/)
2. Ve a **"Assets"** → **"Events"**
3. Selecciona tu Pixel o crea uno nuevo
4. Copia el código de instalación completo

### Configurar en el Admin

1. Activa el switch **"Habilitar TikTok Pixel"**
2. Ingresa el **ID del Pixel**
3. Pega el **código completo del script** en el campo de texto
4. Haz clic en **"Guardar Configuración"**

### Ejemplo de Código

```html
<!-- TikTok Pixel Code -->
<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
  ttq.load('TU_PIXEL_ID');
  ttq.page();
}(window, document, 'ttq');
</script>
<!-- End TikTok Pixel Code -->
```

## Google Tag Manager

### Obtener el Código de Google Tag Manager

1. Ve a [Google Tag Manager](https://tagmanager.google.com/)
2. Selecciona tu contenedor o crea uno nuevo
3. Ve a **"Admin"** → **"Install Google Tag Manager"**
4. Copia el código del `<head>` (el código del `<body>` no es necesario para esta implementación)

### Configurar en el Admin

1. Activa el switch **"Habilitar Google Tag Manager"**
2. Ingresa el **ID del Contenedor** (ejemplo: `GTM-XXXXXX`)
3. Pega el **código completo del script** en el campo de texto
4. Haz clic en **"Guardar Configuración"**

### Ejemplo de Código

```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXX');</script>
<!-- End Google Tag Manager -->
```

## Importante: Páginas de Afiliados

Los scripts de publicidad **NO se inyectan** en las siguientes páginas:

- Páginas con rutas que contienen `/ref/` (ejemplo: `/en/ref/ABC123`)
- Páginas con rutas que contienen `/affiliate/`
- Páginas con parámetro de query `?ref=` (ejemplo: `/?ref=XYZ789`)

Esto es para:
- ✅ Proteger la privacidad de los afiliados
- ✅ Evitar conflictos de seguimiento entre el sitio principal y páginas de afiliados
- ✅ Asegurar que solo se rastreen conversiones del sitio principal

## Verificación

### Verificar que los Scripts se Cargaron

1. Abre tu sitio web en una página **NO de afiliado** (ejemplo: la página principal)
2. Abre las **Herramientas de Desarrollador** del navegador (F12)
3. Ve a la pestaña **"Network"** o **"Red"**
4. Recarga la página
5. Busca las peticiones a:
   - Facebook: `connect.facebook.net/en_US/fbevents.js`
   - TikTok: `analytics.tiktok.com/i18n/pixel/events.js`
   - Google Tag Manager: `googletagmanager.com/gtm.js`

### Verificar que NO se Cargan en Páginas de Afiliados

1. Abre una página de afiliado (ejemplo: `/en/ref/ABC123`)
2. Abre las **Herramientas de Desarrollador** (F12)
3. Ve a la pestaña **"Network"** o **"Red"**
4. Recarga la página
5. Verifica que **NO** aparezcan las peticiones mencionadas arriba

## Soporte

Si tienes problemas con la configuración de los scripts de publicidad:

1. Verifica que hayas copiado el código completo (incluidas las etiquetas `<script>`)
2. Asegúrate de que el ID del Pixel/Contenedor sea correcto
3. Revisa la consola del navegador para ver si hay errores
4. Contacta al equipo de soporte técnico

