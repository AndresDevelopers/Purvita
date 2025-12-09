export type SeoCategory = 'marketing' | 'auth' | 'app' | 'system';

export type SeoPageId =
  | 'global'
  | 'home'
  | 'products'
  | 'product-detail'
  | 'subscriptions'
  | 'subscription-checkout'
  | 'checkout'
  | 'cart'
  | 'team'
  | 'teams'
  | 'terms'
  | 'privacy'
  | 'classes'
  | 'income-calculator'
  | 'dashboard'
  | 'profile'
  | 'wallet'
  | 'settings'
  | 'settings-notifications'
  | 'settings-privacy'
  | 'settings-password'
  | 'settings-language'
  | 'settings-theme'
  | 'auth-login'
  | 'auth-register'
  | 'quick-login'
  | 'affiliate-store'
  | 'affiliate-product'
  | 'affiliate-cart'
  | 'affiliate-checkout';

export interface SeoPageDefinition {
  id: SeoPageId;
  name: string;
  description: string;
  category: SeoCategory;
  routeExamples: string[];
  matchers: RegExp[];
  recommendedStructuredData?: string;
  priority: 'high' | 'medium' | 'low';
}

const EXACT_LOCALE_ROOT = new RegExp('^/[a-zA-Z-]{2}/?$');
const withLocale = (pattern: string) => new RegExp(`^/[a-zA-Z-]{2}${pattern}`);

export const SEO_PAGE_DEFINITIONS: readonly SeoPageDefinition[] = [
  {
    id: 'global',
    name: 'Global (fallback de toda la web)',
    description:
      'Valores predeterminados usados cuando una página no tiene configuración específica. Se recomienda replicar aquí los valores de marca principales.',
    category: 'system',
    routeExamples: ['/', '/es', '/en'],
    matchers: [],
    recommendedStructuredData: 'Organization / WebSite',
    priority: 'high',
  },
  {
    id: 'home',
    name: 'Página de inicio',
    description: 'Landing principal visible para buscadores y visitantes nuevos.',
    category: 'marketing',
    routeExamples: ['/es', '/en'],
    matchers: [EXACT_LOCALE_ROOT],
    recommendedStructuredData: 'WebSite / BreadcrumbList',
    priority: 'high',
  },
  {
    id: 'products',
    name: 'Catálogo de productos',
    description: 'Listado general de productos disponibles.',
    category: 'marketing',
    routeExamples: ['/es/products', '/en/products'],
    matchers: [withLocale('/products/?$')],
    recommendedStructuredData: 'CollectionPage / OfferCatalog',
    priority: 'high',
  },
  {
    id: 'product-detail',
    name: 'Detalle de producto',
    description: 'Página dinámica para cada producto individual.',
    category: 'marketing',
    routeExamples: ['/es/products/tu-producto'],
    matchers: [withLocale('/products/[^/]+/?$')],
    recommendedStructuredData: 'Product',
    priority: 'high',
  },
  {
    id: 'subscriptions',
    name: 'Planes de suscripción',
    description: 'Página con los planes y membresías disponibles.',
    category: 'marketing',
    routeExamples: ['/es/subscriptions'],
    matchers: [withLocale('/subscriptions/?$')],
    recommendedStructuredData: 'CollectionPage / OfferCatalog',
    priority: 'high',
  },
  {
    id: 'subscription-checkout',
    name: 'Detalle de suscripción',
    description: 'Vista previa de un plan o checkout corto de suscripción.',
    category: 'marketing',
    routeExamples: ['/es/subscription'],
    matchers: [withLocale('/subscription/?$')],
    recommendedStructuredData: 'Offer / Service',
    priority: 'medium',
  },
  {
    id: 'checkout',
    name: 'Checkout general',
    description: 'Resumen final de compra y confirmación de pago.',
    category: 'app',
    routeExamples: ['/es/checkout'],
    matchers: [withLocale('/checkout/?$')],
    recommendedStructuredData: 'Order',
    priority: 'medium',
  },
  {
    id: 'cart',
    name: 'Carrito de compras',
    description: 'Resumen del carrito antes de proceder al pago.',
    category: 'app',
    routeExamples: ['/es/cart'],
    matchers: [withLocale('/cart/?$')],
    recommendedStructuredData: 'ShoppingCart',
    priority: 'medium',
  },
  {
    id: 'team',
    name: 'Equipo corporativo',
    description: 'Información del equipo público o líderes del negocio.',
    category: 'marketing',
    routeExamples: ['/es/team'],
    matchers: [withLocale('/team/?$')],
    recommendedStructuredData: 'Organization / Person',
    priority: 'medium',
  },
  {
    id: 'teams',
    name: 'Árbol de equipo',
    description: 'Visualización de la red o árbol de afiliados.',
    category: 'app',
    routeExamples: ['/es/teams'],
    matchers: [withLocale('/teams/?$')],
    recommendedStructuredData: 'Organization',
    priority: 'medium',
  },
  {
    id: 'terms',
    name: 'Términos y condiciones',
    description: 'Contenido legal obligatorio que Google espera indexar.',
    category: 'marketing',
    routeExamples: ['/es/terms'],
    matchers: [withLocale('/terms/?$')],
    recommendedStructuredData: 'LegalService',
    priority: 'high',
  },
  {
    id: 'privacy',
    name: 'Política de privacidad',
    description: 'Declaración de privacidad requerida por Google.',
    category: 'marketing',
    routeExamples: ['/es/privacy'],
    matchers: [withLocale('/privacy/?$')],
    recommendedStructuredData: 'PrivacyPolicy',
    priority: 'high',
  },
  {
    id: 'classes',
    name: 'Clases y contenido educativo',
    description: 'Landing con catálogo de clases disponibles.',
    category: 'marketing',
    routeExamples: ['/es/classes'],
    matchers: [withLocale('/classes/?$')],
    recommendedStructuredData: 'Course / Event',
    priority: 'medium',
  },
  {
    id: 'income-calculator',
    name: 'Calculadora de ingresos',
    description: 'Herramienta para proyectar ingresos y captar leads.',
    category: 'marketing',
    routeExamples: ['/es/income-calculator'],
    matchers: [withLocale('/income-calculator/?$')],
    recommendedStructuredData: 'FinancialProduct',
    priority: 'medium',
  },
  {
    id: 'dashboard',
    name: 'Dashboard de miembro',
    description: 'Resumen privado del desempeño del miembro.',
    category: 'app',
    routeExamples: ['/es/dashboard'],
    matchers: [withLocale('/dashboard/?$')],
    recommendedStructuredData: 'SoftwareApplication',
    priority: 'low',
  },
  {
    id: 'profile',
    name: 'Perfil de usuario',
    description: 'Página privada con información de perfil.',
    category: 'app',
    routeExamples: ['/es/profile'],
    matchers: [withLocale('/profile/?$')],
    recommendedStructuredData: 'ProfilePage',
    priority: 'low',
  },
  {
    id: 'wallet',
    name: 'Billetera digital',
    description: 'Gestión de fondos y transacciones.',
    category: 'app',
    routeExamples: ['/es/wallet'],
    matchers: [withLocale('/wallet/?$')],
    recommendedStructuredData: 'FinancialProduct',
    priority: 'medium',
  },
  {
    id: 'settings',
    name: 'Configuración general',
    description: 'Centro de preferencias del usuario.',
    category: 'app',
    routeExamples: ['/es/settings'],
    matchers: [withLocale('/settings/?$')],
    recommendedStructuredData: 'SoftwareApplication',
    priority: 'low',
  },
  {
    id: 'settings-notifications',
    name: 'Preferencias de notificaciones',
    description: 'Ajustes de alertas y comunicación.',
    category: 'app',
    routeExamples: ['/es/settings/notifications'],
    matchers: [withLocale('/settings/notifications/?$')],
    recommendedStructuredData: 'SoftwareApplication',
    priority: 'low',
  },
  {
    id: 'settings-privacy',
    name: 'Privacidad del usuario',
    description: 'Control de visibilidad y permisos.',
    category: 'app',
    routeExamples: ['/es/settings/privacy'],
    matchers: [withLocale('/settings/privacy/?$')],
    recommendedStructuredData: 'SoftwareApplication',
    priority: 'low',
  },
  {
    id: 'settings-password',
    name: 'Cambio de contraseña',
    description: 'Formulario para gestionar la contraseña.',
    category: 'app',
    routeExamples: ['/es/settings/password'],
    matchers: [withLocale('/settings/password/?$')],
    recommendedStructuredData: undefined,
    priority: 'low',
  },
  {
    id: 'settings-language',
    name: 'Idioma de la interfaz',
    description: 'Selección de idioma preferido.',
    category: 'app',
    routeExamples: ['/es/settings/language'],
    matchers: [withLocale('/settings/language/?$')],
    recommendedStructuredData: undefined,
    priority: 'low',
  },
  {
    id: 'settings-theme',
    name: 'Tema visual',
    description: 'Preferencias de apariencia (claro/oscuro).',
    category: 'app',
    routeExamples: ['/es/settings/theme'],
    matchers: [withLocale('/settings/theme/?$')],
    recommendedStructuredData: undefined,
    priority: 'low',
  },
  {
    id: 'auth-login',
    name: 'Inicio de sesión',
    description: 'Pantalla de acceso para miembros existentes.',
    category: 'auth',
    routeExamples: ['/es/auth/login'],
    matchers: [withLocale('/auth/login/?$')],
    recommendedStructuredData: 'LoginAction',
    priority: 'medium',
  },
  {
    id: 'auth-register',
    name: 'Registro',
    description: 'Formulario de alta de nuevos miembros.',
    category: 'auth',
    routeExamples: ['/es/auth/register'],
    matchers: [withLocale('/auth/register/?$')],
    recommendedStructuredData: 'RegisterAction',
    priority: 'high',
  },
  {
    id: 'quick-login',
    name: 'Acceso rápido',
    description: 'Flujo de acceso directo desde invitaciones.',
    category: 'auth',
    routeExamples: ['/es/quick-login'],
    matchers: [withLocale('/quick-login/?$')],
    recommendedStructuredData: 'LoginAction',
    priority: 'medium',
  },
  {
    id: 'affiliate-store',
    name: 'Tienda de afiliado',
    description: 'Página personalizada de tienda para afiliados activos. Cada afiliado tiene su propia URL única.',
    category: 'marketing',
    routeExamples: ['/es/affiliate/john-code', '/en/affiliate/jane-code'],
    matchers: [withLocale('/affiliate/[^/]+/?$')],
    recommendedStructuredData: 'Store / ProductList',
    priority: 'high',
  },
  {
    id: 'affiliate-product',
    name: 'Producto en tienda de afiliado',
    description: 'Detalle de producto en contexto de afiliado. Incluye tracking del afiliado.',
    category: 'marketing',
    routeExamples: ['/es/affiliate/john-code/product/producto-1'],
    matchers: [withLocale('/affiliate/[^/]+/product/[^/]+/?$')],
    recommendedStructuredData: 'Product',
    priority: 'high',
  },
  {
    id: 'affiliate-cart',
    name: 'Carrito de afiliado',
    description: 'Carrito de compras en contexto de afiliado.',
    category: 'marketing',
    routeExamples: ['/es/affiliate/john-code/cart'],
    matchers: [withLocale('/affiliate/[^/]+/cart/?$')],
    recommendedStructuredData: 'ShoppingCart',
    priority: 'medium',
  },
  {
    id: 'affiliate-checkout',
    name: 'Checkout de afiliado',
    description: 'Proceso de pago en contexto de afiliado.',
    category: 'marketing',
    routeExamples: ['/es/affiliate/john-code/checkout'],
    matchers: [withLocale('/affiliate/[^/]+/checkout/?$')],
    recommendedStructuredData: 'Order',
    priority: 'medium',
  },
] as const;

export const ORDERED_SEO_PAGES = SEO_PAGE_DEFINITIONS.filter((definition) => definition.id !== 'global');

export const resolveSeoPageIdFromPath = (pathname: string): SeoPageId => {
  const sanitizedPath = pathname.split('?')[0] ?? '/';
  const normalized = sanitizedPath.endsWith('/') && sanitizedPath !== '/' ? sanitizedPath.slice(0, -1) : sanitizedPath;

  for (const definition of SEO_PAGE_DEFINITIONS) {
    if (definition.matchers.length === 0) {
      continue;
    }

    if (definition.matchers.some((matcher) => matcher.test(normalized))) {
      return definition.id;
    }
  }

  return 'global';
};
