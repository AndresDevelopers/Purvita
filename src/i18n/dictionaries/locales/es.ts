import type { DictionaryOverrides } from '../types';
import { sanitizeAppNameForEmailDomain } from '../default';

export const createEsDictionary = (
  appName: string,
): DictionaryOverrides => {
  const dictionary = {




    appName,



    navigation: {



      products: "Productos",



      dashboard: "Panel",



      team: "Equipo",



      classes: "Clases",



      orders: "Pedidos",



      cart: "Carrito",



      resources: "Recursos",





      login: "Iniciar Sesión",



      register: "Registrarse",



    },

    marketing: {
      title: 'Herramientas de marketing',
      subtitle: 'Accede a recursos listos para compartir y fortalecer tu marca.',
    },

    settings: {

      title: "Configuración",

      description: "Controla tus preferencias de cuenta, privacidad y experiencia en la app.",

      sections: {

        account: {

          title: "Cuenta",

          items: {

            profile: {

              title: "Perfil",

              description: "Administra la información de tu perfil.",

            },

            password: {

              title: "Contraseña",

              description: "Actualiza tu contraseña y mantén tu cuenta segura.",

            },

            marketing: {

              title: "Marketing",

              description: "Consulta tus enlaces, materiales y campañas de marketing.",

            },

            analytics: {

              title: "Analíticas",

              description: "Visualiza métricas y estadísticas de tu tienda.",

            },

            subscription: {

              title: "Suscripción",

              description: "Consulta el estado, cambia métodos de pago o cancela las renovaciones automáticas.",

            },

            email: {

              title: "Correo Electrónico",

              description: "Actualiza tu dirección de correo electrónico.",

            },

          },

        },

        network: {

          title: "Red Multinivel",

          items: {

            team: {

              title: "Mi Red",

              description: "Gestiona tu equipo y visualiza tu red multinivel.",

            },

            wallet: {

              title: "Monedero",

              description: "Consulta tu balance y retira tus comisiones de red.",

            },

          },

        },

        store: {

          title: "Tienda",

          items: {

            customization: {

              title: "Personalización de Tienda",

              description: "Personaliza la apariencia de tu tienda de afiliado.",

            },

          },

          errors: {

            subscriptionRequired: "Suscripción Requerida",

            accountWaitlisted: "Cuenta en Lista de Espera",

            accessDenied: "Acceso Denegado",

            needsSubscription: "Necesitas una suscripción activa para personalizar tu tienda.",

            waitlistedMessage: "Tu cuenta está en lista de espera. La personalización de tienda no está disponible.",

            noPermission: "No tienes permiso para personalizar esta tienda.",

            viewPlans: "Ver Planes de Suscripción",

            backToStore: "Volver a la Tienda",

          },

        },

        notifications: {

          title: "Notificaciones",

          items: {

            preferences: {

              title: "Ajustes de notificaciones",

              description: "Elige qué alertas y actualizaciones deseas recibir.",

            },

          },

        },

        privacy: {

          title: "Privacidad",

          items: {

            privacy: {

              title: "Controles de privacidad",

              description: "Ajusta quién puede ver tu actividad y datos.",

            },

          },

        },

        app: {

          title: "Configuración de la app",

          items: {

            language: {

              title: "Idioma",

              description: "Cambia el idioma de la aplicación.",

            },

            theme: {

              title: "Tema",

              description: "Alterna entre modo claro, oscuro o según el sistema.",

            },

          },

        },

      },

      subscriptionPage: {

        backButton: "Volver a configuración",

        intro: "Cobraremos automáticamente tu método de pago guardado en cada ciclo. Cancela aquí para detener futuras renovaciones.",

      },

    },



    analytics: {

      title: "Analíticas",

      description: "Visualiza y analiza el rendimiento de tu tienda",

      basicTab: "Básico",

      advancedTab: "Avanzado",

      settingsButton: "Configuración",

      refreshButton: "Actualizar",

      period: {

        today: "Hoy",

        yesterday: "Ayer",

        last7Days: "Últimos 7 días",

        last30Days: "Últimos 30 días",

        last90Days: "Últimos 90 días",

        thisMonth: "Este mes",

        lastMonth: "Mes pasado",

      },

      infoText: "Estas métricas se calculan en tiempo real basadas en la actividad de tu tienda. Recolectamos datos sobre visitas, productos vistos, items agregados al carrito y compras completadas para ayudarte a entender el comportamiento de tus clientes.",

      analysisPeriod: "Período de Análisis",

      dataCollected: {
        title: "Datos Recolectados",
        description: "Información recopilada automáticamente para generar tus analíticas en tiempo real",
        active: "Activo",
        collecting: "Recolectando",
        items: [
          "📊 Visitas y visitantes únicos a tu tienda",
          "👁️ Productos más vistos y populares",
          "🛒 Productos agregados al carrito",
          "💰 Compras completadas y valor de órdenes",
          "📈 Tasas de conversión de visitantes a clientes",
        ],
        visits: {
          title: "Visitas y Tráfico",
          description: "Rastreamos cada visita a tu tienda, visitantes únicos y páginas vistas para medir tu alcance.",
        },
        products: {
          title: "Interacción con Productos",
          description: "Monitoreamos qué productos ven tus clientes y cuáles generan más interés.",
        },
        cart: {
          title: "Actividad del Carrito",
          description: "Registramos cuando los clientes agregan productos al carrito para entender su intención de compra.",
        },
        purchases: {
          title: "Compras Completadas",
          description: "Seguimiento de todas las transacciones exitosas, valores de órdenes e ingresos generados.",
        },
        conversion: {
          title: "Tasas de Conversión",
          description: "Calculamos automáticamente el porcentaje de visitantes que se convierten en clientes.",
        },
      },

      metrics: {

        totalVisits: "Total de Visitas",

        uniqueVisitors: "Visitantes Únicos",

        pageViews: "Vistas de Página",

        totalOrders: "Total de Pedidos",

        totalRevenue: "Ingresos Totales",

        avgOrderValue: "Valor Promedio del Pedido",

        conversionRate: "Tasa de Conversión",

        topProducts: "Productos Más Vendidos",

        views: "Vistas",

        addToCart: "Añadidos al Carrito",

        purchases: "Compras",

        revenue: "Ingresos",

      },

      advanced: {

        title: "Analíticas Avanzadas",

        description: "Obtén insights profundos sobre tu negocio",

        comingSoon: "Analíticas Avanzadas Muy Pronto",

        unlockMessage: "Desbloquea embudos de conversión, análisis de cohortes, CLV y más.",

        unlockButton: "Actualizar Ahora",

        funnel: {

          title: "Embudo de Conversión",

          productViews: "Vistas de Producto",

          addToCart: "Añadido al Carrito",

          beginCheckout: "Inicio de Compra",

          addPaymentInfo: "Info de Pago Añadida",

          purchase: "Compra Completada",

          cartConversion: "Conversión a Carrito",

          checkoutConversion: "Conversión a Checkout",

          paymentConversion: "Conversión de Pago",

          overallConversion: "Conversión General",

        },

        devices: {

          title: "Distribución por Dispositivo",

          desktop: "Escritorio",

          mobile: "Móvil",

          tablet: "Tablet",

        },

        timeSeries: {

          title: "Tendencia Temporal",

          date: "Fecha",

          visits: "Visitas",

          orders: "Pedidos",

          revenue: "Ingresos",

        },

      },

      privacy: {

        title: "Consentimiento de Privacidad",

        description: "Respetamos tu privacidad. Elige tus preferencias de seguimiento.",

        trackingLabel: "Permitir seguimiento",

        trackingDescription: "Ayúdanos a mejorar tu experiencia permitiendo el seguimiento de analíticas.",

        anonymizeIpLabel: "Anonimizar dirección IP",

        anonymizeIpDescription: "Tu dirección IP será anonimizada para proteger tu privacidad.",

        acceptButton: "Aceptar",

        declineButton: "Rechazar",

        updateButton: "Actualizar Preferencias",

        privacyPolicy: "Al continuar, aceptas nuestra Política de Privacidad.",

        learnMore: "Más información",

      },

      errors: {
        subscriptionRequired: "Suscripción Requerida",
        accountWaitlisted: "Cuenta en Lista de Espera",
        accessDenied: "Acceso Denegado",
        needsSubscription: "Necesitas una suscripción activa para acceder a las analíticas de tu tienda.",
        waitlistedMessage: "Tu cuenta está en lista de espera. Las funciones de tienda no están disponibles.",
        noPermission: "No tienes permiso para ver las analíticas de esta tienda.",
        viewPlans: "Ver Planes de Suscripción",
        backToStore: "Volver a la Tienda",
      },

      back: "Volver",

      analysisPeriodDescription: "Selecciona el rango de tiempo para visualizar tus métricas",

      trends: {
        revenueOrders: "Tendencia de Ingresos y Pedidos",
        revenueOrdersDescription: "Evolución de tus ventas en el período seleccionado",
        visits: "Tendencia de Visitas",
        visitsDescription: "Tráfico de visitantes en el período seleccionado",
      },

      funnel: {
        title: "Embudo de Conversión",
        description: "Visualiza el recorrido de tus clientes desde la visita hasta la compra",
        visits: "Visitas",
        productViews: "Vistas de Productos",
        addToCart: "Agregados al Carrito",
        purchases: "Compras Completadas",
        conversionRate: "Tasa de conversión",
        dropOff: "abandono",
      },

    },



    landing: {



      heroTitle: "Potenciando la Salud, Enriqueciendo Vidas",



      heroSubtitle: `Únete a ${appName} y emprende un viaje hacia una mejor salud y libertad financiera. Nuestros innovadores planes de salud y comunidad de apoyo están diseñados para ayudarte a lograr tus objetivos de bienestar y construir un negocio próspero.`,



      explorePlans: "Explorar Planes",



      joinNow: "Únete Ahora",



      aboutTitle: `Acerca de ${appName}`,



      aboutText1: `En ${appName}, creemos que la verdadera riqueza es la salud. Somos una comunidad apasionada dedicada a promover el bienestar holístico a través de nuestros productos premium de salud y una oportunidad de negocio única. Nuestra misión es empoderar a las personas para que tomen control de su salud y futuro financiero.`,



      aboutText2: `Fundada en los principios de integridad, calidad y comunidad, ${appName} ofrece un camino hacia una vida más saludable y próspera. Somos más que una empresa; somos una familia de personas afines apoyándonos mutuamente en el camino al éxito.`,



      howItWorksTitle: "Cómo Funciona",



      howItWorksSubtitle: `Nuestro modelo de marketing multinivel está diseñado para tu éxito. Es simple, gratificante y ofrece un potencial ilimitado de crecimiento. Aquí te mostramos cómo puedes comenzar y prosperar con ${appName}.`,



      howItWorks: {



        step1Title: "Únete a Nuestra Comunidad",



        step1Desc: `Regístrate y conviértete en distribuidor de ${appName}. Obtendrás acceso a nuestros productos, materiales de capacitación y una red de apoyo.`,



        step2Title: "Comparte los Productos",



        step2Desc: `Comparte tu pasión por la salud y el bienestar introduciendo los productos de ${appName} a otros. Gana comisiones por tus ventas.`,



        step3Title: "Construye tu Equipo",



        step3Desc: "Invita a otros a unirse a tu equipo. Mientras los mentorías y apoyas, ganarás ingresos adicionales de sus ventas, creando un negocio sostenible.",



      },



      plansTitle: "Nuestros Planes de Salud",



      perMonth: "/mes",



      selectPlan: "Seleccionar plan",



      mostPopular: "Más popular",





      plans: {



        basic: {



          title: "Básico",



          price: "$49",



          features: [



            "Cobertura de salud esencial",



            "Acceso a programas básicos de bienestar",



            "Soporte al cliente 24/7"



          ]



        },



        premium: {



          title: "Premium",



          price: "$99",



          features: [



            "Cobertura de salud integral",



            "Acceso a programas avanzados de bienestar",



            "Entrenamiento personalizado de salud",



            "Soporte prioritario al cliente"



          ]



        },



        elite: {



          title: "Elite",



          price: "$149",



          features: [



            "Cobertura completa de salud",



            "Acceso a todos los programas de bienestar",



            "Asesor de salud dedicado",



            "Soporte VIP al cliente",



            "Beneficios exclusivos para miembros"



          ]



        }



      },



      opportunitySection: {

        phases: [

          {

            id: 'phase-0',

            title: "Fase 0 · Registro",

            visibilityTag: "Visible",

            descriptor: "Accede al kit de negocio en cuanto completes tu registro.",

            requirement: "Activa tu cuenta con la suscripción mensual.",

            monthlyInvestment: "Compromiso mensual: {{price}}",

            rewards: [

              "Orientación sobre la oportunidad de negocio",

              "Enlace personal de afiliado",

              "Biblioteca de videos para reclutamiento",

              "Acceso al e-commerce para comenzar a vender",

            ],

            commissionHighlight: "Comisión de e-commerce: 8% por venta",

            order: 0,

          },

          {

            id: 'phase-1',

            title: "Fase 1 · Primeros Socios",

            visibilityTag: "Visible",

            descriptor: "Recluta a dos miembros que paguen su suscripción mensual.",

            requirement: "Incorpora a dos socios activos.",

            monthlyInvestment: "Contribución del equipo: 2 suscripciones × {{price}}",

            rewards: [

              "Elige un producto gratis (valor $65)",

              "Recibe $3 como saldo en tu cuenta",

            ],

            accountBalanceHighlight: "Saldo después de Fase 1: $3",

            commissionHighlight: "La comisión de e-commerce sube al 15% por venta",

            order: 1,

          },

          {

            id: 'phase-2',

            title: "Fase 2 · Duplica tu Equipo",

            visibilityTag: "Visible",

            descriptor:

              "Ayuda a que cada uno de tus dos socios reclute a dos personas (tu segundo nivel).",

            requirement: "Acompaña el ingreso de cuatro nuevos miembros en tu segundo nivel.",

            monthlyInvestment: "Crecimiento de la red: 4 nuevas suscripciones",

            rewards: [

              "Productos gratis valorados en $125",

              "Recibe $9 como saldo en tu cuenta",

            ],

            accountBalanceHighlight: "Saldo después de Fase 2: $9",

            commissionHighlight: "La comisión de e-commerce sube al 30% por venta",

            order: 2,

          },

          {

            id: 'phase-3',

            title: "Fase 3 · Impulso de la Red",

            descriptor:

              "Mantén el impulso mientras tu equipo continúa duplicándose más allá del segundo nivel.",

            requirement: "Guía a tu organización para sostener suscripciones activas.",

            monthlyInvestment: "Hito de liderazgo",

            rewards: [

              "Productos gratis valorados en $240",

              "Recibe $506 como saldo en tu cuenta",

            ],

            accountBalanceHighlight: "Saldo después de Fase 3: $506",

            commissionHighlight: "La comisión de e-commerce sube al 40% por venta",

            order: 3,

          },

        ],

      },



      testimonialsSection: {

        title: "Lo Que Dicen Nuestros Miembros",

        testimonials: [

          {

            id: 'testimonial-1',

            name: "Historia de Éxito de Sarah",

            quote: `"${appName} cambió por completo mi vida. Ahora soy más saludable, feliz y financieramente estable."`,

            role: null,

            imageUrl: null,

            order: 0,

          },

          {

            id: 'testimonial-2',

            name: "Transformación de Mark",

            quote: `"Perdí peso, gané energía y construí un negocio exitoso con ${appName}. ¡El apoyo es increíble!"`,

            role: null,

            imageUrl: null,

            order: 1,

          },

          {

            id: 'testimonial-3',

            name: "Impacto en la Comunidad",

            quote: `"Ser parte de la comunidad de ${appName} ha sido maravilloso. Trabajamos juntos para alcanzar nuestras metas y hacer la diferencia."`,

            role: null,

            imageUrl: null,

            order: 2,

          },

        ],

      },



      featuredProductsSection: {

        title: "Productos Destacados",

        subtitle: "Descubre los esenciales de bienestar que nuestros miembros aman en este momento.",

        emptyState: "No hay productos destacados disponibles por ahora. Vuelve pronto.",

      },



      contactSection: {

        title: "Contáctanos",

        description: "¿Tienes preguntas? Nos encantará escucharte. Escríbenos y te responderemos lo antes posible.",

        contactInfo: {

          phone: "(123) 456-7890",

          email: `contacto@${sanitizeAppNameForEmailDomain(appName)}.com`,

          address: "123 Avenida Bienestar, Ciudad Salud, USA",

        },

        form: {

          nameLabel: "Nombre completo",

          namePlaceholder: "Tu Nombre",

          emailLabel: "Correo electrónico",

          emailPlaceholder: "Tu Correo",

          messageLabel: "¿Cómo podemos ayudarte?",

          messagePlaceholder: "Tu Mensaje",

          sendButton: "Enviar Mensaje",

          sendingLabel: "Enviando...",

          successMessage: "¡Gracias por escribirnos! Te responderemos muy pronto.",

          errorMessage: "No pudimos enviar tu mensaje. Inténtalo nuevamente.",

          helperText: "Respondemos en menos de un día hábil.",

        },

        recipientEmail: `contacto@${sanitizeAppNameForEmailDomain(appName)}.com`,

      },

      teamSection: {

        title: "Nuestro Equipo",

        subtitle: "Conoce a las personas que hacen posible nuestra misión de transformar vidas.",

        members: [

          {

            id: 'team-member-1',

            name: "María González",

            role: "Directora Ejecutiva",

            description: "Líder visionaria con más de 15 años de experiencia en salud y bienestar.",

            imageUrl: null,

            order: 0,

          },

          {

            id: 'team-member-2',

            name: "Carlos Rodríguez",

            role: "Director de Operaciones",

            description: "Experto en optimización de procesos y desarrollo de equipos de alto rendimiento.",

            imageUrl: null,

            order: 1,

          },

          {

            id: 'team-member-3',

            name: "Ana Martínez",

            role: "Directora de Marketing",

            description: "Especialista en estrategias digitales y construcción de comunidades.",

            imageUrl: null,

            order: 2,

          },

          {

            id: 'team-member-4',

            name: "Luis Fernández",

            role: "Director de Producto",

            description: "Innovador apasionado por crear soluciones que mejoran la calidad de vida.",

            imageUrl: null,

            order: 3,

          },

        ],

      },

      header: {

        landingLinks: [

          { id: 'about', label: 'Sobre Nosotros', href: '#about', requiresAuth: false, order: 0 },

          { id: 'how-it-works', label: 'Cómo Funciona', href: '#how-it-works', requiresAuth: false, order: 1 },

          { id: 'income-calculator', label: 'Calculadora de Ingresos', href: 'income-calculator', requiresAuth: false, order: 2 },

          { id: 'faq', label: 'Preguntas Frecuentes', href: '#faq', requiresAuth: false, order: 3 },

          { id: 'testimonials', label: 'Testimonios', href: '#testimonials', requiresAuth: false, order: 4 },

          { id: 'contact', label: 'Contacto', href: '#contact', requiresAuth: false, order: 5 },

        ],

        authenticatedLinks: [

          { id: 'dashboard', label: 'Panel', href: '/dashboard', requiresAuth: true, order: 0 },

          { id: 'products', label: 'Productos', href: '/products', requiresAuth: true, order: 1 },

          { id: 'team', label: 'Equipo', href: '/team', requiresAuth: true, order: 2 },

          { id: 'classes', label: 'Clases', href: '/classes', requiresAuth: true, order: 3 },

        ],

        primaryAction: {

          label: 'Crear Cuenta',

          href: '/auth/register',

        },

        secondaryAction: {

          label: 'Iniciar Sesión',

          href: '/auth/login',

        },

        showCart: true,

      },

      footer: {

        tagline: 'Impulsamos salud y abundancia en comunidad.',

        navigationLinks: [

          { id: 'products', label: 'Productos', href: '/products', order: 0 },

          { id: 'how-it-works', label: 'Cómo Funciona', href: '#how-it-works', order: 1 },

          { id: 'contact', label: 'Contacto', href: '#contact', order: 2 },

        ],

        legalLinks: [

          { id: 'privacy', label: 'Aviso de Privacidad', href: '/privacy', order: 0 },

          { id: 'terms', label: 'Términos de Servicio', href: '/terms', order: 1 },

        ],

        socialLinks: [

          { id: 'facebook', platform: 'facebook', label: 'Facebook', href: '#', order: 0 },

          { id: 'twitter', platform: 'twitter', label: 'Twitter', href: '#', order: 1 },

          { id: 'instagram', platform: 'instagram', label: 'Instagram', href: '#', order: 2 },

          { id: 'linkedin', platform: 'linkedin', label: 'LinkedIn', href: '#', order: 3 },

        ],

        showLanguageSwitcher: true,

        showThemeSwitcher: true,

      },


      privacy: {

        intro: "Tu privacidad es importante para nosotros. Es política de {{appName}} respetar tu privacidad respecto a cualquier información que podamos recopilar de ti a través de nuestro sitio web y otros sitios que poseemos y operamos.",

        sections: {

          informationWeCollect: {

            title: "1. Información que Recopilamos",

            content: "Solo solicitamos información personal cuando realmente la necesitamos para proporcionarte un servicio. La recopilamos por medios justos y legales, con tu conocimiento y consentimiento. También te informamos por qué la estamos recopilando y cómo se utilizará.",

            details: "Podemos recopilar la siguiente información: nombre, información de contacto incluyendo dirección de correo electrónico, información demográfica como código postal, preferencias e intereses, y otra información relevante para encuestas de clientes y/o ofertas."

          },

          howWeUseInformation: {

            title: "2. Cómo Utilizamos la Información",

            content: "Utilizamos la información que recopilamos para comprender tus necesidades y proporcionarte un mejor servicio, y en particular por las siguientes razones: registro interno, para mejorar nuestros productos y servicios, y para enviar periódicamente correos electrónicos promocionales sobre nuevos productos, ofertas especiales u otra información que creemos que puede interesarte utilizando la dirección de correo electrónico que has proporcionado."

          },

          security: {

            title: "3. Seguridad",

            content: "Estamos comprometidos a garantizar que tu información sea segura. Para prevenir el acceso o divulgación no autorizados, hemos implementado procedimientos físicos, electrónicos y administrativos adecuados para salvaguardar y asegurar la información que recopilamos en línea."

          }

        }

      },


      terms: {

        intro: "Bienvenido a {{appName}}. Estos términos y condiciones describen las reglas y regulaciones para el uso de nuestro sitio web y servicios. Al acceder a este sitio web asumimos que aceptas estos términos y condiciones. No continúes usando {{appName}} si no estás de acuerdo con aceptar todos los términos y condiciones establecidos en esta página.",

        sections: {

          license: {

            title: "1. Licencia para Usar el Sitio Web",

            content: "A menos que se indique lo contrario, {{appName}} y/o sus licenciadores poseen los derechos de propiedad intelectual de todo el material en {{appName}}. Todos los derechos de propiedad intelectual están reservados. Puedes acceder a esto desde {{appName}} para tu propio uso personal sujeto a las restricciones establecidas en estos términos y condiciones.",

            restrictions: {

              title: "No debes:",

              items: [

                "Republicar material de {{appName}}",

                "Vender, alquilar o sublicenciar material de {{appName}}",

                "Reproducir, duplicar o copiar material de {{appName}}",

                "Redistribuir contenido de {{appName}}"

              ]

            }

          },

          userContent: {

            title: "2. Contenido del Usuario",

            content: "En estos términos y condiciones, \"tu contenido de usuario\" significa material (incluyendo sin limitación texto, imágenes, material de audio, material de video y material audiovisual) que envías a este sitio web, para cualquier propósito. Concedes a {{appName}} una licencia mundial, irrevocable, no exclusiva y libre de regalías para usar, reproducir, adaptar, publicar, traducir y distribuir tu contenido de usuario en cualquier medio existente o futuro."

          },

          limitationOfLiability: {

            title: "3. Limitación de Responsabilidad",

            content: "En ningún caso {{appName}}, ni ninguno de sus funcionarios, directores y empleados, serán responsables de nada que surja de o en cualquier forma conectado con tu uso de este sitio web ya sea que tal responsabilidad sea bajo contrato. {{appName}}, incluyendo sus funcionarios, directores y empleados no serán responsables de cualquier responsabilidad indirecta, consecuente o especial que surja de o en cualquier forma relacionada con tu uso de este sitio web."

          }

        }

      },



      faqTitle: "Preguntas Frecuentes",



      faqSubtitle: "¿Tienes preguntas? Tenemos respuestas a los temas que la gente pregunta más.",



      faq: {



        q1: `¿Qué es ${appName}?`,



        a1: `${appName} es una empresa de bienestar holístico que ofrece productos premium y un modelo de asociación gratificante. Te ayudamos a elevar tu salud mientras construyes un negocio sostenible.`,



        q2: "¿Cómo gano dinero?",



        a2: "Gana ingresos compartiendo nuestros productos, desbloqueando comisiones en cada venta y mentorizando a otros. A medida que crece tu equipo, también lo hace tu potencial de ganancias.",



        q3: "¿Los productos son seguros?",



        a3: "Por supuesto. Cada fórmula pasa por pruebas rigurosas y se elabora con ingredientes de alta calidad y origen ético para apoyar tu bienestar diario.",



        q4: "¿Cómo funciona la facturación de la suscripción?",



        a4: "Si activas y pagas tu suscripción, cobraremos automáticamente el mismo método de pago cada mes en la fecha de activación, a menos que la canceles. Puedes cambiar tu método de pago cuando quieras; de lo contrario, usaremos el que registraste. Si no hay fondos o el cobro es rechazado, tu suscripción se cancelará automáticamente y te notificaremos al correo registrado.",



      },



      aboutImageAlt: "Imagen Acerca de Nosotros",

    },



    teams: {

      title: "Estructura del equipo",

      subtitle: "Controla cómo crece tu red en cada nivel del plan.",


      level1: "Socios Nivel 1",

      level2: "Socios Nivel 2",

      activeCount: "{{count}} activos",

      empty: "Aún no tienes socios. Comparte tu enlace afiliado para comenzar a construir.",

      phaseTag: "Fase {{value}}",

      locked: {

        title: "Activa tu membresía",

        description:

          "Realiza el pago mensual para desbloquear tu enlace afiliado, el material de reclutamiento y la vista genealogía.",

        action: "Ir a suscripción",

      },


      statusBadge: {

        active: "Activo",

        past_due: "Vencido",

        unpaid: "Inactivo",

        canceled: "Cancelado",

        waitlisted: "En lista de espera",

      },

      messaging: {

        action: "Enviar mensaje",

        actionAria: "Enviar mensaje a {{email}}",

        dialog: {

          title: "Mensaje para {{email}}",

          bodyLabel: "Comparte una nota rápida con tu socio.",

          placeholder: "Escribe tu mensaje…",

          cancel: "Cancelar",

          send: "Enviar mensaje",

          sending: "Enviando…",

          successTitle: "Mensaje enviado",

          successDescription: "Tu socio recibirá este mensaje al instante.",

          errorTitle: "No pudimos enviar el mensaje",

          errorDescription: "Inténtalo nuevamente en unos minutos.",

          validationError: "Escribe un mensaje antes de enviarlo.",

        },

      },

      plan: {

        title: "Beneficios del multinivel",

        description: "Cada fase libera nuevas comisiones, bonos y productos gratis conforme tu red se expande.",

        requirements: "Requisitos",

        rewards: "Beneficios",

        phases: {

          phase0: {

            title: "Fase 0 · Activación",

            helper: "Confirma tu pago de suscripción.",

            requirements: ["Mantener una suscripción activa y pagada."],

            rewards: [

              "Desbloquea tu enlace afiliado y video de reclutamiento.",

              "Accede a la plataforma de ecommerce.",

              "Recibe {{commission}} de comisión por tus ventas personales.",

            ],

          },

          phase1: {

            title: "Fase 1 · Reclutamiento directo",

            helper: "Ayuda a dos referidos directos a activar su membresía.",

            requirements: [

              "Tener dos referidos directos con suscripción activa y pagada.",

            ],

            rewards: [

              "Elige un producto gratis valorado en {{freeProductValue}}.",

              "{{walletCredit}} acreditados en tu billetera.",

              "Incrementa la comisión de ecommerce a {{commission}} en tus ventas personales.",

            ],

          },

          phase2: {

            title: "Fase 2 · Segundo nivel",

            helper: "Apoya a cada referido directo para que reclute dos miembros activos.",

            requirements: [

              "Mantener activos a tus dos socios directos.",

              "Alcanzar cuatro miembros activos en tu segundo nivel.",

            ],

            rewards: [

              "Recibe productos gratis valorados en {{freeProductValue}}.",

              "{{walletCredit}} acreditados en tu billetera.",

              "Incrementa la comisión de ecommerce a {{commission}} en tus ventas personales.",

            ],

          },

          phase3: {

            title: "Fase 3 · Retención",

            helper: "Mantén la estructura de Fase 2 durante dos ciclos de cobro consecutivos.",

            requirements: [

              "Sostener los requisitos de la Fase 2 durante dos ciclos de suscripción adicionales.",

              "Registrar dos renovaciones pagadas después de alcanzar la Fase 2.",

            ],

            rewards: [

              "Recibe productos gratis valorados en {{freeProductValue}}.",

              "{{walletCredit}} acreditados en tu billetera.",

              "Incrementa la comisión de ecommerce a {{commission}} en tus ventas personales.",

            ],

          },

        },

      },

    },

    compensation: {

      title: "Compensación y capacidad",

      description:

        "Sincronizado en vivo con la configuración del administrador para que tu equipo vea las reglas de comisión actualizadas.",

      loading: "Cargando configuración de compensación…",

      error: "No pudimos cargar la configuración de compensación.",

      retry: "Reintentar",

      rates: {

        title: "Detalle de comisiones",

        base: {

          label: "Comisión base",

          helper: "Aplica a tus ventas personales de producto.",

        },

        referral: {

          label: "Bono por referido",

          helper: "Se paga cuando tus referidos directos activan su membresía.",

        },

        leadership: {

          label: "Pool de liderazgo",

          helper: "Bono compartido entre los equipos con mejor desempeño.",

        },

        payoutFrequency: {

          label: "Frecuencia de pago",

          helper: "Cadencia configurada para depositar comisiones.",

        },

        currency: {

          label: "Moneda de pago",

          helper: "Todas las comisiones se pagan en esta moneda.",

        },

        frequencyOptions: {

          weekly: "Semanal",

          biweekly: "Quincenal",

          monthly: "Mensual",

        },

      },

      earnings: {

        title: "Ganancias por nivel",

        helper: "Consulta cuánto ganas por cada miembro activo en cada nivel.",

        empty: "Aún no hay compensaciones configuradas por nivel.",

        perMember: "por miembro",

        levelLabel: "Nivel",

      },

      capacity: {

        title: "Capacidad por nivel",

        helper: "Cantidad máxima de miembros permitidos por nivel según el administrador.",

        empty: "Aún no hay límites de capacidad configurados.",

        membersSuffix: "miembros",

        levelLabel: "Nivel",

      },

    },



    subscriptionManagement: {

      title: "Suscripción",

      description: "Mantén tu negocio activo con la membresía mensual.",

      activateButton: "Activar por {{price}}/mes",
      activateButtonWithPrice: "Activar por {{price}}/mes",

      statusLabel: "Estado",

      nextCharge: "Próximo cobro",

      waitlistLabel: "Lista de espera",

      waitlistDescription:

        "Estás en lista de espera porque la comunidad alcanzó el límite de 1,000 miembros. Los beneficios se activarán en cuanto se libere un espacio.",

      statuses: {

        active: "Activa",

        past_due: "Vencida",

        unpaid: "Inactiva",

        canceled: "Cancelada",

      },

      manage: {

        sectionTitle: "Gestionar suscripción",

        sectionDescription: "Actualiza tu método de pago o cancela cuando lo necesites.",

        updateButton: "Actualizar método de pago",

        cancelButton: "Cancelar suscripción",

        cancelDisabledLabel: "Renovaciones automáticas desactivadas",

        cancelSuccess: "Las renovaciones automáticas quedaron desactivadas. Mantendrás el acceso hasta el {{date}}.",

        cancelSuccessNoDate: "Las renovaciones automáticas quedaron desactivadas. Mantendrás el acceso por el tiempo ya pagado.",

        cancelSuccessFallback:

          "Las renovaciones automáticas quedaron desactivadas. Mantendrás el acceso por el tiempo ya pagado.",

        cancelAlready: "Las renovaciones automáticas ya estaban desactivadas. Tu acceso continúa hasta el {{date}}.",

        cancelAlreadyNoDate: "Las renovaciones automáticas ya estaban desactivadas. Tu acceso continúa por el tiempo ya pagado.",

        cancelAlreadyFallback: "Las renovaciones automáticas ya estaban desactivadas para esta suscripción.",

        cancelError: "No pudimos cancelar tu suscripción. Intenta de nuevo en unos minutos.",

        pendingCancellation: "Las renovaciones automáticas están desactivadas. Tus beneficios continúan hasta el {{date}}.",

        pendingCancellationNoDate: "Las renovaciones automáticas están desactivadas. Tus beneficios continúan por el tiempo ya pagado.",

        pendingCancellationFallback:

          "Las renovaciones automáticas están desactivadas. Mantendrás los beneficios hasta que termine tu periodo actual.",

        dialog: {

          title: "¿Cancelar la suscripción?",

          description:

            "Detendremos los próximos cobros de inmediato y conservarás tus beneficios hasta que finalice el periodo de facturación en curso.",

          confirm: "Sí, cancelar",

          cancel: "Conservar suscripción",

        },

      },

      activeThroughLabel: "Activa hasta",

      paymentDialog: {

        title: "Elige cómo pagar",

        description: "Selecciona un método de pago para activar tu suscripción.",

        loading: "Cargando métodos de pago…",

        noProviders: "No hay métodos de pago habilitados en este momento.",

        providerLoadError: "No pudimos cargar tus métodos de pago. Inténtalo nuevamente.",

        sessionError: "Inicia sesión nuevamente para continuar.",

        planUnavailable: "No hay un plan de suscripción disponible en este momento.",

        providerError: "Selecciona un método de pago para continuar.",

        paypalLabel: "PayPal",

        stripeLabel: "Stripe",

        walletLabel: "Saldo en billetera",

        walletBalanceLabel: "Saldo: {{amount}}",

        walletInsufficient: "Tu saldo no es suficiente para activar la suscripción.",

        testBadge: "Modo prueba",

        testNotice: "Los cobros se realizarán en modo sandbox y no usarán dinero real.",

        confirm: "Continuar",

        confirmLoading: "Procesando…",

        cancel: "Cancelar",

        genericError: "No pudimos iniciar el proceso de pago.",

        missingRedirect: "Falta la URL de redirección del pago.",

        walletSuccess: "Cargamos {{amount}} de tu billetera y activamos tu membresía.",

        walletWaitlisted: "Cargamos {{amount}} de tu billetera. Quedarás activa cuando se libere un cupo.",

      },

      invoiceHistory: {

        title: "Facturas de suscripción",

        description: "Consulta los comprobantes generados al activar o renovar tu membresía.",

        searchPlaceholder: "Buscar facturas...",

        viewArchived: "Ver archivadas ({{count}})",

        showActive: "Mostrar facturas activas",

        archiveSelected: "Archivar {{count}} seleccionadas",

        unarchiveSelected: "Desarchivar {{count}} seleccionadas",

        archiving: "Archivando…",

        unarchiving: "Restaurando…",

        loading: "Cargando facturas…",

        empty: "Aún no tienes facturas de suscripción.",

        selectAll: "Seleccionar todas las facturas",

        archivedBadge: "Archivada",

        loadError: "No pudimos cargar las facturas",

        archiveSuccess: "Archivamos {{count}} factura(s).",

        archiveError: "No pudimos archivar las facturas",

        unarchiveSuccess: "Restauramos {{count}} factura(s).",

        unarchiveError: "No pudimos restaurar las facturas",

        periodEndEmpty: "—",

        table: {

          date: "Fecha",

          amount: "Monto",

          status: "Estado",

          periodEnd: "Cubre hasta",

          method: "Método",

          invoice: "Factura",

        },

        statuses: {

          paid: "Pagada",

          failed: "Fallida",

          refunded: "Reembolsada",

        },

        methods: {

          stripe: "Stripe",

          paypal: "PayPal",

          wallet: "Saldo en billetera",

        },

        loadingInvoice: "Cargando factura…",

        viewInvoice: "Ver factura",

        invoiceViewerHint: "Usa las opciones de tu navegador para imprimir o guardar esta factura.",

        invoiceErrorDescription: "No pudimos cargar esta factura. Intenta nuevamente.",

      },

      email: {

        cancellation: {

          userRequested: {

            subject: `Tu suscripción de ${appName} fue cancelada`,

            greeting: "Hola {{name}}",

            message: [

              "Procesamos tu solicitud de cancelación y detuvimos los próximos cargos.",

              "Puedes volver a tu panel cuando quieras para reactivar la membresía.",

            ],

            footer: `Gracias por ser parte de ${appName}.`,

          },

          paymentFailure: {

            subject: `Cancelamos tu suscripción de ${appName} tras un pago fallido`,

            greeting: "Hola {{name}}",

            message: [

              "No pudimos procesar tu último pago de suscripción, así que cancelamos el plan para proteger tu cuenta.",

              "Actualiza tu método de pago y reactiva la membresía cuando estés lista.",

            ],

            footer: "Si fue un error, inicia sesión para reiniciar tu membresía.",

          },

        },

      },

    },



    wallet: {

      title: "Billetera",

      balanceLabel: "Saldo disponible",

      withdrawCta: "Solicitar retiro",

      withdrawDescription: "Completa la verificación KYC y acumula al menos $20 antes de retirar.",

      kycWarning: "Completa la verificación KYC para habilitar los retiros.",

      table: {

        header: {

          reason: "Motivo",

          amount: "Monto",

          date: "Fecha",

        },

        empty: "Aún no tienes movimientos.",

      },

      reasons: {

        phase_bonus: "Bono de fase",

        sale_commission: "Comisión por venta",

        withdrawal: "Retiro",



        purchase: "Compra de productos",

      },

    },



    products: {



      title: "Nuestro Catálogo de Productos",



      subtitle: "Productos exclusivos para mejorar tu estilo de vida.",



      viewDetails: "Ver Detalles",



      addToCart: "Añadir al Carrito",

      addingToCart: "Agregando…",

      addedToCartTitle: "Producto agregado al carrito",

      addedToCartDescription: "Agregamos {{product}} a tu carrito.",

      loginToAddToCart: "Inicia sesión para agregar este producto al carrito.",

      loginAction: "Iniciar sesión",

      checkingAvailability: "Verificando disponibilidad…",

      unavailableInCountry: "Este producto no está disponible en tu país.",



      searchPlaceholder: "Buscar por nombre o beneficio",

      filterTrigger: "Filtros",

      filtersTitle: "Refinar resultados",

      categoriesLabel: "Categoría",

      priceRangeLabel: "Rango de precios",

      ratingLabel: "Calificación mínima",

      allRatingsOption: "Todas las calificaciones",

      clearFilters: "Restablecer filtros",

      resultsCount: "{{count}} productos para tu bienestar",

      noResultsTitle: "Ningún producto coincide con tus filtros",

      noResultsDescription: "Ajusta los filtros o busca otro objetivo de bienestar.",

      quickView: "Vista rápida",

      quickViewClose: "Cerrar vista rápida",

      quickViewGoToProduct: "Ver ficha completa",

      quickViewDescriptionLabel: "Detalle de la fórmula",

      pullToRefreshHint: "Desliza hacia abajo para refrescar el catálogo",

      refreshingLabel: "Actualizando catálogo…",

      loadingMoreLabel: "Cargando más productos",

      activeFiltersLabel: "Filtros activos",

      categoryPillLabel: "Enfoque: {{category}}",

      ratingAriaLabel: "Calificación {{rating}} de 5",



      allProducts: "Todos los Productos",



      emptyTitle: "Productos disponibles muy pronto",



      emptyDescription: "No encontramos productos en este momento. Vuelve a intentarlo más tarde.",



      errorTitle: "No pudimos cargar los productos",



      errorDescription: "Ocurrió un error al cargar el catálogo. Por favor, intenta nuevamente en unos instantes.",



    },



    productDetails: {

      heroBadge: "Ritual diario",

      fallbackTagline: "Un suplemento natural para potenciar tu bienestar.",

      fallbackHeroSupporting:

        "ParVita es un suplemento restaurador elaborado con una mezcla de ingredientes naturales que apoya tu energía, enfoque y calma durante el día.",

      shippingLabel: "Envío",

      shippingValue: "Envío exprés gratuito en 2 días dentro de Estados Unidos",

      guaranteeLabel: "Garantía",

      guaranteeValue: "Promesa de reembolso de 30 días",

      supportLabel: "Soporte",

      supportValue: "Incluye seguimiento con un coach de bienestar",

      priceLabel: "Precio",

      stockStatusLabel: "Disponible para envío inmediato",

      stockLowLabel: "Solo quedan {{count}} botellas",

      shareLabel: "Compartir producto",

      addToRoutineLabel: "Agregar a mi ritual",

      quickHighlightsTitle: "Por qué te encantará",

      usageTitle: "Cómo usarlo",

      usageReminder:

        "Consulta a tu profesional de la salud antes de iniciar un nuevo suplemento.",

      ingredientsTitle: "Ingredientes",

      wellnessTitle: "Beneficios para tu bienestar",

      insightsTitle: "Tips para tu ritual",

      ratingTitle: "Reseñas de clientes",

      ratingSummaryLabel: "{{rating}} de 5",

      ratingCountLabel: "Basado en {{count}} reseñas verificadas",

      ratingDescription: "Las personas reportan resultados visibles en las primeras dos semanas de uso constante.",

      ratingVerifiedLabel: "Comprador verificado",

      reviewListTitle: "Reseñas recientes",

      reviewCta: "Leer todas las reseñas",

      reviewEmptyState: "Aún no hay reseñas. Sé la primera persona en compartir tu experiencia.",

      reviewFormTitle: "Comparte tu experiencia",

      reviewFormAuthPrompt: "Inicia sesión para dejar una reseña y calificación.",

      reviewFormAuthCta: "Iniciar sesión",

      reviewFormRatingLabel: "Tu calificación",

      reviewFormCommentLabel: "Tu reseña",

      reviewFormCommentPlaceholder: "Cuéntanos tu experiencia...",

      reviewFormCommentHint: "Mínimo 10 caracteres.",

      reviewFormSubmit: "Enviar reseña",

      reviewFormSubmitting: "Enviando reseña...",

      reviewFormSuccessTitle: "¡Gracias por tu reseña!",

      reviewFormSuccessDescription: "Tu opinión ayuda a la comunidad.",

      reviewFormErrorTitle: "No pudimos enviar la reseña",

      reviewFormErrorDescription: "Inténtalo nuevamente en unos momentos.",

      reviewBackToProduct: "Volver al producto",

      reviewListCountLabel: "{{count}} reseñas en total",

      calloutLabel: "Pureza verificada en laboratorio",

      calloutDescription: "Cada lote es verificado por terceros para asegurar potencia y pureza.",

      relatedProducts: "Productos Relacionados",

      defaults: {

        tagline: "Un suplemento natural para potenciar tu bienestar.",

        heroSupporting:

          "Formulado con botánicos ricos en nutrientes, ParVita brinda energía sostenible, mejora el enfoque y mantiene la calma sin aditivos sintéticos.",

        quickHighlights: [

          "Adaptógenos estudiados clínicamente para equilibrar el estrés diario",

          "Endulzado de forma natural sin rellenos artificiales",

          "Certificado vegano, libre de OGM y sin gluten",

        ],

        usage: [

          "Toma 1-2 pumps debajo de la lengua cada mañana.",

          "Mantén el líquido 30 segundos antes de tragar para máxima absorción.",

          "Acompaña con agua o infusión para mantenerte hidratado durante el día.",

        ],

        ingredients: [

          "Extracto orgánico de hoja de moringa",

          "Raíz de ashwagandha",

          "Vitamina B12 (metilcobalamina)",

          "Aceite MCT prensado en frío derivado del coco",

        ],

        wellness: [

          "Apoya energía sostenida",

          "Promueve el equilibrio inmunológico",

          "Ayuda a reducir el estrés cotidiano",

          "Mejora el enfoque y la claridad",

        ],

        insights: [

          "Disfrútalo con el estómago vacío poco después de despertar.",

          "Combínalo con estiramientos suaves para activar la circulación.",

          "Registra tu ánimo y energía en la app de PurVita para medir el progreso.",

        ],

        rating: {

          average: 4.7,

          count: 128,

        },

        reviews: [

          {

            id: "sonia-carter",

            author: "Sonia Carter",

            timeAgo: "Hace 2 días",

            rating: 5,

            comment:

              "Ahora ParVita es parte de mi rutina diaria y la diferencia es increíble. Mi energía se mantiene estable y me siento clara y tranquila toda la mañana.",

          },

          {

            id: "liam-barnett",

            author: "Liam Barnett",

            timeAgo: "Hace 1 semana",

            rating: 4,

            comment:

              "Gran sabor y fácil de usar. Noté mejoras en mi enfoque desde la primera semana. ¡Muy recomendado!",

          },

          {

            id: "amelia-ross",

            author: "Amelia Ross",

            timeAgo: "Hace 3 semanas",

            rating: 5,

            comment:

              "Una dosis me mantiene equilibrada todo el día. Noté mejoras en mi digestión y ánimo. ParVita ya es parte de mi ritual.",

          },

        ],

      },

      products: {},

    },



    auth: {



      loginTitle: "Bienvenido de Nuevo",



      loginSubtitle: "Inicia sesión para acceder a tu panel.",



      emailLabel: "Correo Electrónico",



      passwordLabel: "Contraseña",



      loggingIn: "Iniciando sesión...",



      registerTitle: "Crear una Cuenta",



      registerSubtitle: "Únete a nuestra red y comienza tu viaje.",



      nameLabel: "Nombre Completo",



      referralLabel: "Código de Referido (Opcional)",



      referralPlaceholder: "Ingresa el código de tu referente",



      referralInvalid: "No encontramos un patrocinador para ese código de referido.",



      referralResolved: "Patrocinador confirmado: {{value}}",



      referralResolvedAnonymous: "¡Patrocinador confirmado! Tu cuenta se unirá automáticamente a su red.",



      registrationCodeLabel: "Código de registro",



      registrationCodePlaceholder: "Ingresa el código de acceso",



      registrationCodeHelp: "Utiliza el código más reciente distribuido por el equipo.",



      registrationCodeChecking: "Validando el código de registro...",



      registrationCodeInvalid: "El código de acceso es inválido o ya expiró.",



      registrationCodeRequired: "Necesitas un código de registro válido para continuar.",



      registrationCodeVerified: "Código verificado. Completa el formulario para finalizar tu registro.",



      noAccount: "¿No tienes una cuenta?",



      haveAccount: "¿Ya tienes una cuenta?",



      demoInfo: "Esto es una demostración. Simplemente haz clic en el botón de Iniciar Sesión para continuar.",



      unexpectedError: "Ocurrió un error inesperado",



      forgotPassword: "¿Olvidaste tu contraseña?",



      forgotPasswordTitle: "Restablecer contraseña",



      forgotPasswordSubtitle: "Ingresa tu dirección de correo electrónico y te enviaremos un enlace para restablecer tu contraseña.",



      sendResetLink: "Enviar enlace de restablecimiento",



      sendingResetLink: "Enviando...",



      resetLinkSent: "¡Enlace enviado! Revisa tu bandeja de entrada.",



      backToLogin: "Volver al inicio de sesión",



      resetPasswordTitle: "Crear Nueva Contraseña",



      resetPasswordSubtitle: "Ingresa tu nueva contraseña a continuación",



      newPasswordLabel: "Nueva Contraseña",



      resetPasswordButton: "Restablecer Contraseña",



      resettingPassword: "Restableciendo...",



      passwordResetSuccess: "¡Contraseña restablecida exitosamente!",



      invalidResetLink: "Enlace de restablecimiento inválido o expirado",

      passwordConfirmLabel: "Confirmar Contraseña",
      passwordConfirmPlaceholder: "Vuelve a ingresar tu contraseña",
      passwordsDoNotMatch: "Las contraseñas no coinciden",
    },

    mfa: {
      title: "Autenticación de Dos Factores",
      description: "Añade una capa extra de seguridad a tu cuenta requiriendo un código de verificación además de tu contraseña.",
      enable: {
        title: "Activar 2FA",
        description: "Protege tu cuenta con autenticación de dos factores",
        button: "Activar Autenticación de Dos Factores",
        scanning: "Configurando...",
      },
      setup: {
        title: "Configurar Autenticación de Dos Factores",
        description: "Escanea el código QR con tu aplicación de autenticación (Google Authenticator, Authy, etc.)",
        step1: "1. Descarga una aplicación de autenticación si no tienes una",
        step2: "2. Escanea el código QR o ingresa la clave secreta manualmente",
        step3: "3. Ingresa el código de 6 dígitos de tu aplicación para verificar",
        qrCodeAlt: "Código QR para Autenticación de Dos Factores",
        manualEntry: "¿No puedes escanear? Ingresa este código manualmente:",
        copySecret: "Copiar",
        secretCopied: "¡Copiado!",
        verificationCode: "Código de Verificación",
        verificationPlaceholder: "000000",
        verifyButton: "Verificar y Activar",
        verifying: "Verificando...",
        cancelButton: "Cancelar",
      },
      enabled: {
        title: "2FA Está Activado",
        description: "Tu cuenta está protegida con autenticación de dos factores",
        disableButton: "Desactivar 2FA",
        disabling: "Desactivando...",
        lastUpdated: "Activado el",
      },
      disable: {
        title: "Desactivar Autenticación de Dos Factores",
        description: "¿Estás seguro de que quieres desactivar la autenticación de dos factores?",
        warning: "Esto hará tu cuenta menos segura. Solo necesitarás tu contraseña para iniciar sesión.",
        confirmButton: "Sí, Desactivar 2FA",
        cancelButton: "Cancelar",
      },
      verify: {
        title: "Autenticación de Dos Factores",
        description: "Ingresa el código de 6 dígitos de tu aplicación de autenticación",
        codeLabel: "Código de Autenticación",
        codePlaceholder: "000000",
        verifyButton: "Verificar",
        verifying: "Verificando...",
        rememberDevice: "Recordar este dispositivo por 30 días",
        useBackupCode: "Usar código de respaldo",
        resendCode: "¿No recibiste el código?",
      },
      errors: {
        enrollmentFailed: "Error al configurar la autenticación de dos factores. Por favor intenta de nuevo.",
        verificationFailed: "Verificación fallida. Por favor revisa tu código e intenta de nuevo.",
        invalidCode: "Código de verificación inválido. Por favor intenta de nuevo.",
        expiredCode: "El código de verificación ha expirado. Por favor solicita uno nuevo.",
        tooManyAttempts: "Demasiados intentos fallidos. Por favor espera un momento e intenta de nuevo.",
        genericError: "Ocurrió un error. Por favor intenta más tarde.",
      },
      success: {
        enabled: "La autenticación de dos factores ha sido activada exitosamente.",
        disabled: "La autenticación de dos factores ha sido desactivada.",
        verified: "Verificación exitosa.",
      },
    },


    errors: {



      unexpected: "Ocurrió un error inesperado",



    },



    footer: {



      copy: "Todos los derechos reservados.",



      navigation: "Navegación",



      legal: "Legal",



      followUs: "Síguenos",



      privacy: "Política de Privacidad",



      terms: "Términos de Servicio",



      privacyTitle: "Política de Privacidad",



      termsTitle: "Términos de Servicio"



    },



    dashboard: {



      title: "Panel de Control",



      welcomeTitle: "¡Bienvenido a tu Panel de Control!",



      welcomeSubtitle: "Aquí es donde puedes seguir tu progreso y gestionar tu cuenta.",



      content: "Esta área es perfecta para mostrar gráficos personalizados, actividad reciente o enlaces rápidos a acciones importantes. Todos los datos que ves en esta página son de demostración y serán reemplazados con información en tiempo real de tu cuenta.",



      subscriptionStatus: "Estado de Suscripción",



      active: "Activa",



      monthlyEarnings: "Ganancias Mensuales",



      directReferrals: "Referidos Directos",



      firstLevelCommissions: "Comisiones 1er Nivel",



      home: {



        summary: {

          loading: "Cargando tu resumen de negocio...",

          error: "No pudimos cargar tu panel en este momento. Intenta de nuevo.",

          cards: {

            phase: {

              title: "Fase actual",

              label: "Fase",

            },

            commission: {

              title: "Comisión e-commerce",

              helper: "Se aplica a tus ventas personales",

              lockedTitle: "Activa tu suscripción",

              lockedDescription: "Confirma tu pago mensual para desbloquear las comisiones de e-commerce personales.",

            },

            wallet: {

              title: "Saldo de billetera",

            },

            subscription: {

              title: "Estado de suscripción",

              active: "Activa",

              pastDue: "Vencida",

              unpaid: "Inactiva",

              canceled: "Cancelada",

              nextCharge: "Próximo cobro",

              waitlistLabel: "Lista de espera",

            },

          },

          progress: {
            title: "Progreso del equipo",
            level1: "Socios activos Nivel 1",
            level2: "Socios activos Nivel 2",
            helper: "Alcanza 2 socios directos y 4 en tu segundo nivel para desbloquear la Fase 2.",
          },

          affiliate: {

            title: "Enlace afiliado",

            description: "Comparte este enlace para inscribir nuevos socios bajo ti.",

            copy: "Copiar enlace",

            copied: "¡Enlace copiado!",

          },

          waitlist: {

            badge: "Lista de espera",

            description:

              "Tu pago está confirmado pero alcanzamos el cupo máximo. Los beneficios se activarán automáticamente al liberar espacio.",

          },



          phaseBenefits: {

            title: "Beneficios desbloqueados",

            description: "Consulta las ventajas disponibles según tu fase activa.",

            empty: "Activa tu suscripción o avanza de fase para ver tus recompensas.",

          },

        },

        noSubscription: {
          title: "Sin Suscripción Activa",
          description: "Actualmente no tienes una suscripción activa. Puedes seguir navegando y comprando productos, pero para acceder a beneficios exclusivos como comisiones y red de afiliados, necesitas activar una suscripción.",
          viewPlans: "Ver Planes",
          goToShop: "Ir a la Tienda",
          noActiveSubscription: "Sin suscripción activa",
          viewAvailablePlans: "Ver planes disponibles →",
        },

        accountOverview: {
          title: "Resumen de Cuenta",
          mlmEarnings: "Resumen de Ganancias MLM",
          affiliateEarnings: "Resumen de Ganancias Afiliado",
          currentBalance: "Saldo Actual",
          phaseCommission: "Comisión por Fase",
          phase: "Fase",
          subscriptionStatus: "Estado de Suscripción",
          mlmSubscription: "Suscripción MLM",
          affiliateSubscription: "Suscripción Afiliado",
        },

        affiliateStore: {
          title: "Tu Tienda de Afiliado",
          description: "Tienes acceso a tu tienda personalizada para vender productos y ganar comisiones.",
          storeLink: "Enlace de tu tienda",
          copy: "Copiar",
          viewStore: "Ver Tienda",
          customize: "Personalizar",
          analytics: "Analíticas",
          activeMessage: "Tu suscripción de afiliado está activa. Comparte tu enlace de tienda para ganar comisiones por cada venta.",
        },

        welcome: "Bienvenido de nuevo, {{userName}}",



        performanceOverview: {



          title: "Resumen de Rendimiento",



          metrics: {



            personalSales: {



              label: "Ventas Personales",



              value: "$1,250",



              change: "+15%",



            },



            teamSales: {



              label: "Ventas del Equipo",



              value: "$5,780",



              change: "+10%",



            },



            commissions: {



              label: "Comisiones Generadas",



              value: "$450",



              change: "+20%",



            },



          },



        },



        teamActivity: {



          title: "Actividad del Equipo",



          columns: {



            member: "Miembro",



            level: "Nivel",



            sales: "Ventas",



            status: "Estado",



          },



          members: [



            {



              name: "Emily Carter",



              level: "Nivel 1",



              sales: "$2,500",



              status: "active",



            },



            {



              name: "David Lee",



              level: "Nivel 1",



              sales: "$1,800",



              status: "active",



            },



            {



              name: "Olivia Brown",



              level: "Nivel 2",



              sales: "$1,200",



              status: "active",



            },



            {



              name: "Ethan Clark",



              level: "Nivel 2",



              sales: "$800",



              status: "inactive",



            },



            {



              name: "Sophia Green",



              level: "Nivel 2",



              sales: "$500",



              status: "active",



            },



          ],



          statuses: {



            active: "Activo",



            inactive: "Inactivo",



          },



        },



        productSalesSummary: {



          title: "Resumen de Ventas de Productos",



          topSelling: {



            label: "Productos Más Vendidos",



            value: "$3,500",



            change: "+12% este mes",



          },



          products: [



            {



              name: "Vitality Boost",



              value: 30,



            },



            {



              name: "Immunity Shield",



              value: 50,



            },



            {



              name: "Sleep Well",



              value: 80,



              highlight: true,



            },



            {



              name: "Digestive Aid",



              value: 20,



            },



          ],



        },



      },

    },



    checkout: {



      title: "Finalizar Compra",



      breadcrumbCart: "Carrito",



      breadcrumbCheckout: "Finalizar Compra",



      shippingInformation: "Información de Envío",



      fullName: "Nombre Completo",



      address: "Dirección",



      city: "Ciudad",



      state: "Estado",



      zipCode: "Código Postal",



      country: "País",



      phoneNumber: "Número de Teléfono",



      paymentMethod: "Método de Pago",



      creditCard: "Tarjeta de Crédito",



      paypal: "PayPal",



      stripe: "Stripe",



      wallet: "Saldo Personal",



      walletBalanceLabel: "Saldo disponible",



      walletInsufficient: "Tu saldo personal no es suficiente para completar este pago.",



      walletPaymentSuccess: "Hemos descontado el monto de tu saldo personal exitosamente.",



      walletPaymentError: "No pudimos descontar el monto de tu saldo personal. Intenta con otro método o contacta soporte.",



      walletVerificationRequired: "Esta transacción requiere verificación adicional por seguridad. Contacta soporte si el problema persiste.",



      saveForNextTime: "Guardaremos tus datos de checkout para la próxima compra.",



      paypalRedirect: "Serás redirigido a PayPal para completar tu pago.",



      noPaymentMethods: "No hay métodos de pago activos. Contacta al administrador.",



      paymentProvidersError: "No pudimos cargar los métodos de pago. Actualiza e inténtalo de nuevo.",



      profileLoadError: "No pudimos cargar tus datos guardados. Completa la información manualmente.",



      selectPaymentMethod: "Elige un método de pago para continuar.",



      validationError: "Revisa los campos resaltados para continuar.",



      processingPayment: "Procesando pago...",



      paymentError: "No pudimos iniciar el pago. Por favor, verifica tu conexión e intenta de nuevo. Si el problema persiste, contacta al administrador.",



      redirectError: "El proveedor de pago no devolvió una URL de redirección. Por favor, intenta de nuevo o contacta al soporte técnico.",

      paymentServiceUnavailable: "El servicio de pago está temporalmente no disponible. Por favor, intenta más tarde o contacta al administrador para verificar la configuración.",

      paymentConfigurationError: "El sistema de pagos no está configurado correctamente. Por favor, contacta al administrador del sitio.",
      successMessage: "¡Pedido realizado con éxito!",



      paymentDescription: `${appName} - pago de pedido`,



      cardNumber: "Número de Tarjeta",



      expirationDate: "Fecha de Expiración",



      cvv: "CVV",



      nameOnCard: "Nombre en la Tarjeta",

      fillAllFields: "Por favor completa todos los campos requeridos",



      orderSummary: "Resumen del Pedido",



      subtotal: "Subtotal",



      shipping: "Envío",



      taxes: "Impuestos",



      discounts: "Descuentos",



      total: "Total",

      subtotalLabel: "Subtotal",

      freeProductDiscount: "Regalo de Producto Gratis",

      storeCreditDiscount: "Crédito de Tienda",
      productDiscount: "Descuentos del producto",

      totalSavings: "🎉 ¡Estás ahorrando {{amount}}!",

      phaseRewardSaving: "recompensa ahorrándote",

      youreSaving: "¡Estás ahorrando",



      completePurchase: "Completar Compra",



      paypalOld: {



        title: "Pagar con PayPal",



        description: "Pago seguro y rápido.",



        redirect: "Serás redirigido al sitio web de PayPal para completar tu pago.",



        button: "Continuar a PayPal"



      }



    },



    cart: {



      title: "Tu Carrito",



      products: "Productos",



      subscriptionOptions: "Opciones de Suscripción",



      oneTimePurchase: "Compra Única",



      monthlySubscription: "Suscripción Mensual (10% de descuento)",



      paymentMethod: "Método de Pago",



      creditCard: "Tarjeta de Crédito",



      paypal: "PayPal",



      stripe: "Stripe",



      wallet: "Saldo Personal",



      walletBalanceLabel: "Saldo disponible",



      modeBadge: {
        test: "Modo de prueba",
        live: "Modo en vivo",
      },



      testModeTitle: "Pagos de prueba activos",



      testModeDescription:
        "Los pagos utilizan credenciales sandbox. No se realizará ningún cargo real mientras pruebas el flujo.",



      testModeInstructionsTitle: "Para probar este pago:",



      liveModeTitle: "Pagos reales activos",



      liveModeDescription:
        "Los pagos se procesarán con dinero real mediante el proveedor seleccionado.",



      walletInsufficient: "Tu saldo personal no es suficiente para cubrir esta compra.",



      noPaymentMethods: "No hay métodos de pago disponibles por el momento. Ponte en contacto con soporte.",



      paymentProvidersError: "No pudimos cargar los métodos de pago. Actualiza la página para intentarlo de nuevo.",



      selectPaymentMethodHint: "Por favor selecciona un método de pago para continuar",



      cannotProceedHint: "No se puede proceder con el pago",



      required: "Requerido",



      proceedToCheckout: "Proceder al Pago",



      emptyCart: "Tu carrito está vacío",



      remove: "Eliminar",



      quantity: "Cantidad",



      total: "Total",

      subtotal: "Subtotal",

      freeProductDiscount: "Regalo de Producto Gratis",

      storeCreditDiscount: "Crédito de Tienda",
      productDiscount: "Descuentos del producto",
      totalSavings: "¡Ahorraste ${{amount}}!",

      orderSummaryTitle: "Resumen del Pedido",

      discountApplied: "Descuento Aplicado",

      phaseRewardApplied: "Recompensa Mensual Aplicada",

      youSaved: "Ahorraste",



      dailyGreens: "PÅ«rVita Daily Greens",



      dailyGreensDesc: "Una mezcla de verduras orgánicas, frutas y vegetales para apoyar la nutrición diaria.",



      proteinBlend: "PÅ«rVita Protein Blend",



      proteinBlendDesc: "Polvo de proteína de alta calidad para la recuperación muscular y la salud general.",



    },



    team: {



      title: "Mi Equipo",



      subtitle: "Aquí están tus referidos directos.",



      table: {



        member: "Miembro",



        joinDate: "Fecha de Ingreso",



        status: "Estado",



        commissions: "Comisiones"



      },



      statusActive: "Activo",



      statusInactive: "Inactivo",



      referral: {



        title: "Recomienda y Gana",



        description: "Comparte tu código o enlace para hacer crecer tu red.",



        yourCode: "Tu Código de Referido",



        yourLink: "Tu Enlace de Referido"



      },



      copied: {



        title: "¡Copiado!",



        description: "El texto ha sido copiado a tu portapapeles."



      }



    },

    siteModes: {

      maintenance: {

        title: "Sitio en mantenimiento",

        description: "Actualmente estamos realizando mantenimiento programado. Por favor, regresa pronto.",

        info: "Mientras tanto, puedes volver a consultar en breve o contactar a tu administrador si necesitas asistencia urgente.",

        socialTitle: "Mantente conectado con nosotros",

        socialPlatforms: {

          facebook: "Facebook",

          instagram: "Instagram",

          youtube: "YouTube",

          x: "X (Twitter)",

          whatsapp: "WhatsApp",

        },

        badge: "Modo de Mantenimiento",

        footerNote: "Esta página se actualizará automáticamente cuando volvamos a estar en línea",

      },

      comingSoon: {

        title: "Nuestro sitio está en construcción",

        description: "Estaremos en línea muy pronto",

        emailLabel: "Suscríbete para recibir notificaciones:",

        emailPlaceholder: "Ingresa tu correo",

        emailSubtitle: "Sé de las primeras personas en enterarse cuando lancemos.",

        submit: "Suscribirse",

        submitting: "Suscribiéndote...",

        successTitle: "¡Estás en la lista!",

        successDescription: "Gracias por unirte a la lista de espera. Te contactaremos pronto.",

        alreadyTitle: "Ya estás suscrito",

        alreadyDescription: "Te avisaremos tan pronto como estemos en línea.",

        errorTitle: "Algo salió mal",

        errorDescription: "Por favor, inténtalo de nuevo.",

        missingConfig: "La lista de espera aún no está disponible. Por favor, inténtalo más tarde.",

        countdownUnits: {
          days: "Días",
          hours: "Horas",
          minutes: "Minutos",
          seconds: "Segundos",
        },

        socialTitle: "Síguenos para más novedades",

        socialDescription: "Únete a la comunidad en redes sociales mientras ultimamos detalles del lanzamiento.",

        socialPlatforms: {

          facebook: "Facebook",

          instagram: "Instagram",

          youtube: "YouTube",

          x: "X (Twitter)",

          whatsapp: "WhatsApp",

        },

        countdownTitle: "",

        countdownLabel: "",

        countdownNumericLabel: "Días restantes",

        countdownExpired: "Estamos dando los últimos retoques.",

        waitlistUnavailableTitle: "Lista de espera no disponible por ahora",

        waitlistUnavailableDescription: "Estamos preparando la experiencia de lanzamiento. Vuelve pronto para registrarte.",

        footerNote: "Todos los derechos reservados.",

      },

    },



    admin: {



      title: "Panel de Admin",

      menuLabel: "Menú",



      dashboard: "Panel",



      users: "Usuarios",

      // Textos comunes del admin
      common: {
        loading: "Cargando...",
        loadingData: "Cargando datos...",
        error: "Error",
        success: "Éxito",
        save: "Guardar",
        saving: "Guardando...",
        cancel: "Cancelar",
        delete: "Eliminar",
        edit: "Editar",
        create: "Crear",
        add: "Agregar",
        remove: "Eliminar",
        confirm: "Confirmar",
        actions: "Acciones",
        noData: "No hay datos disponibles",
        retry: "Reintentar",
        refresh: "Actualizar",
        total: "Total",
        active: "Activo",
        inactive: "Inactivo",
        suspended: "Suspendido",
        system: "Sistema",
        systemRole: "Rol del Sistema",
        noRole: "Sin Rol",
        level: "Nivel",
        subscription: "Suscripción",
        noSubscription: "Sin suscripción",
        mlmSubscription: "🌐 MLM",
        affiliateSubscription: "🛒 Afiliado",
        pastDue: "Vencido",
        canceled: "Cancelado",
        incomplete: "Incompleto",
        trialing: "En prueba",
        unpaid: "Sin pagar",
        user: "Usuario",
        more: "más",
        order: "Orden",
        price: "Precio",
        features: "Características",
        status: "Estado",
        planActions: "Acciones del plan",
        setAsDefault: "Establecer como predeterminado",
        confirmDelete: "¿Estás seguro de que quieres eliminar este elemento?",
        confirmDeletePlan: "¿Estás seguro de que quieres eliminar este plan?",
        confirmDeleteProduct: "¿Estás seguro de que quieres eliminar este producto?",
      },

      // Gestión de planes
      plansManagement: {
        title: "Gestión de planes",
        description: "Administra los planes de suscripción disponibles",
        addPlan: "Agregar plan",
        loadingPlans: "Cargando planes...",
        noPlans: "No hay planes",
        planDeleted: "Plan eliminado",
        planDeletedDesc: "El plan se ha eliminado correctamente.",
        planUpdated: "Plan actualizado",
        planUpdatedDesc: "El plan se ha establecido como predeterminado.",
        orderUpdated: "Orden actualizado",
        orderUpdatedDesc: "El orden de los planes se ha actualizado.",
        errorLoadingPlans: "No se pudieron cargar los planes.",
        errorDeletingPlan: "No se pudo eliminar el plan.",
        errorSettingDefault: "No se pudo establecer el plan por defecto.",
        errorUpdatingOrder: "No se pudo actualizar el orden.",
        editPlan: "Editar Plan",
        editPlanDesc: "Editar detalles del plan para",
        planTitle: "Título del Plan",
        planPrice: "Precio del Plan",
        planDescription: "Descripción del Plan",
        planFeatures: "Características del Plan",
        planFeaturesPlaceholder: "Ingrese cada característica en una nueva línea",
      },

      // Gestión de productos
      productsManagement: {
        loadingProducts: "Cargando productos...",
        noProducts: "No hay productos",
        productDeleted: "Producto eliminado",
        productDeletedDesc: "El producto se ha eliminado correctamente.",
        errorLoadingProducts: "No se pudieron cargar los productos.",
        errorDeletingProduct: "No se pudo eliminar el producto.",
        bulkDeleteSuccess: "Productos eliminados",
        bulkDeleteSuccessDesc: "{{count}} productos eliminados correctamente.",
        bulkDeletePartial: "Error parcial",
        bulkDeletePartialDesc: "Se eliminaron {{success}} productos, pero {{error}} fallaron.",
        bulkDeleteError: "No se pudieron eliminar los productos.",
      },

      userForm: {
        role: "Rol",
        selectRole: "Seleccionar rol",
        noRoleAssigned: "Sin rol asignado",
        roleDescription: "Define los permisos del usuario en el panel de administración.",
      },

      roles: {
        menuLabel: "Roles",
        title: "Gestión de Roles",
        description: "Crea y administra roles con permisos específicos para controlar el acceso en la plataforma.",
        createRole: "Crear Rol",
        editRole: "Editar Rol",
        deleteRole: "Eliminar Rol",
        roleName: "Nombre del Rol",
        roleDescription: "Descripción",
        permissions: "Permisos",
        selectPermissions: "Seleccionar Permisos",
        noRoles: "No se encontraron roles",
        noRolesDescription: "Crea tu primer rol para comenzar a gestionar permisos.",
        table: {
          name: "Nombre",
          description: "Descripción",
          permissions: "Permisos",
          users: "Usuarios",
          actions: "Acciones",
        },
        form: {
          nameLabel: "Nombre del Rol",
          namePlaceholder: "ej., Gerente, Editor, Visualizador",
          descriptionLabel: "Descripción",
          descriptionPlaceholder: "Describe qué puede hacer este rol",
          permissionsLabel: "Permisos",
          permissionsDescription: "Selecciona los permisos que debe tener este rol",
          save: "Guardar Rol",
          saving: "Guardando...",
          cancel: "Cancelar",
        },
        permissionsList: {
          viewDashboard: "Ver Panel",
          manageUsers: "Gestionar Usuarios",
          manageProducts: "Gestionar Productos",
          manageOrders: "Gestionar Pedidos",
          managePayments: "Gestionar Pagos",
          managePlans: "Gestionar Planes",
          manageContent: "Gestionar Contenido",
          manageSettings: "Gestionar Configuración",
          viewReports: "Ver Reportes",
          manageSecurity: "Gestionar Seguridad",
        },
        deleteDialog: {
          title: "Eliminar Rol",
          description: "¿Estás seguro de que quieres eliminar este rol? Esta acción no se puede deshacer.",
          confirm: "Eliminar",
          cancel: "Cancelar",
        },
        toast: {
          createSuccess: "Rol creado exitosamente",
          createError: "Error al crear el rol",
          updateSuccess: "Rol actualizado exitosamente",
          updateError: "Error al actualizar el rol",
          deleteSuccess: "Rol eliminado exitosamente",
          deleteError: "Error al eliminar el rol",
        },
      },

      products: "Productos",

      orders: {
        menuLabel: "Pedidos",
        title: "Pedidos del día",
        description: "Consulta los pedidos pagados, cantidades y destinos antes de coordinarlos con la bodega.",
        toolbar: {
          dateLabel: "Seleccionar día",
          timezoneLabel: "Zona horaria",
          timezoneHint: "Las horas se muestran en UTC.",
          todayLabel: "Hoy",
          refreshLabel: "Actualizar",
          download: {
            label: "Descargar CSV",
            busyLabel: "Preparando",
            hint: "Descarga los pedidos del día con datos de cliente, dirección y totales para la bodega.",
            fileNamePrefix: "pedidos-dia",
          },
          pullToRefresh: {
            idle: "Desliza hacia abajo para actualizar",
            armed: "Suelta para actualizar",
            triggered: "Actualizando pedidos…",
          },
        },
        summary: {
          totalOrders: "Pedidos",
          totalUnits: "Unidades",
          totalRevenue: "Ingresos brutos",
          totalShipping: "Envíos",
          totalTax: "Impuestos",
          totalDiscount: "Descuentos",
        },
        list: {
          orderIdLabel: "Pedido",
          createdAtLabel: "Creado",
          statusLabel: "Estado",
          purchaseSourceLabel: "Origen de Compra",
          customerLabel: "Cliente",
          contactLabel: "Contacto",
          emailLabel: "Correo",
          phoneLabel: "Teléfono",
          addressLabel: "Dirección de envío",
          itemsLabel: "Artículos",
          productLabel: "Producto",
          quantityLabel: "Cant.",
          unitPriceLabel: "Precio unitario",
          lineTotalLabel: "Total de línea",
          currencyLabel: "Moneda",
          totals: {
            orderTotal: "Total del pedido",
            shipping: "Envío",
            tax: "Impuestos",
            discount: "Descuento",
            net: "Total a despachar",
          },
          noItemsLabel: "Este pedido aún no tiene artículos registrados.",
          statusBadges: {
            draft: "Borrador",
            pending: "Pendiente",
            paid: "Pagado",
            failed: "Fallido",
            canceled: "Cancelado",
            refunded: "Reembolsado",
          },
          purchaseSourceBadges: {
            main_store: "Tienda Principal",
            affiliate_store: "Tienda de Afiliado",
          },
        },
        empty: {
          title: "Sin pedidos en esta fecha",
          description: "No registramos pedidos pagados en el día seleccionado. Elige otra fecha o actualiza nuevamente.",
          actionLabel: "Actualizar",
        },
        error: {
          title: "No pudimos cargar los pedidos",
          description: "No fue posible comunicarnos con el servicio de logística. Revisa tu conexión e inténtalo de nuevo.",
          retryLabel: "Reintentar",
        },
        meta: {
          generatedAtLabel: "Última sincronización",
        },
      },

      warehouse: {
        menuLabel: "Bodega",
        title: "Seguimiento de bodega",
        description:
          "Registra manualmente los avances logísticos para que clientes y soporte conozcan el estado real de cada pedido.",
        empty: {
          title: "Sin actualizaciones",
          description: "Agrega la primera nota para informar cuando el paquete salga de la bodega.",
        },
        error: {
          title: "No se pudo cargar el seguimiento",
          description: "No logramos conectar con el servicio de bodega. Revisa tu conexión e inténtalo de nuevo.",
          retry: "Reintentar",
        },
        form: {
          title: "Nueva actualización",
          description: "Comparte el último estado logístico, la ubicación y la empresa responsable del envío.",
          submit: "Crear registro",
          submitting: "Creando...",
          update: "Actualizar",
          updating: "Guardando...",
          cancel: "Cancelar",
          autoTrackingNote:
            "El sistema genera automáticamente un código de seguimiento único. Compártelo con el cliente si lo solicita.",
          fields: {
            orderId: "ID de la orden",
            status: "Estado",
            trackingCode: "Código de seguimiento",
            location: "Ubicación",
            note: "Nota interna",
            estimatedDelivery: "Entrega estimada",
            responsibleCompany: "Empresa responsable",
            eventTime: "Fecha del evento",
          },
          orderLookup: {
            label: "Buscar orden",
            placeholder: "Escribe al menos 3 caracteres...",
            helper: "Busca por código de orden para vincular la actualización automáticamente.",
            empty: "Ninguna orden coincide con tu búsqueda.",
            loading: "Buscando órdenes...",
            error: "No fue posible buscar órdenes. Intenta nuevamente.",
            select: "Selecciona una orden antes de guardar la actualización.",
            selectedLabel: "Orden seleccionada",
            change: "Cambiar orden",
          },
        },
        filters: {
          searchPlaceholder: "Buscar por orden, código o ubicación...",
          statusLabel: "Todos los estados",
          clear: "Limpiar filtros",
        },
        timeline: {
          heading: "Orden",
          customer: "Cliente",
          email: "Correo",
          updatedAt: "Actualizado {{value}}",
          responsibleCompany: "Empresa responsable",
          trackingCode: "Código de seguimiento",
          estimatedDelivery: "Entrega estimada",
          location: "Ubicación",
          note: "Nota",
        },
        statusBadges: {
          pending: "Pendiente",
          packed: "Empacado",
          in_transit: "En tránsito",
          delivered: "Entregado",
          delayed: "Retrasado",
          canceled: "Cancelado",
        },
        loadMore: "Cargar más",
        loading: "Cargando actualizaciones...",
      },

      videos: "Videos",

      tutorials: {
        menuLabel: "Tutoriales",
        title: "Gestión de Tutoriales",
        description: "Crea y administra tutoriales de incorporación que guíen a los nuevos usuarios a través de la plataforma.",
        form: {
          addTutorial: "Agregar Tutorial",
          saveTutorial: "Guardar",
          deleteTutorial: "Eliminar",
          addStep: "Agregar Paso",
          active: "Activo",
          titleEs: "Título (ES)",
          titleEn: "Título (EN)",
          descriptionEs: "Descripción (ES)",
          descriptionEn: "Descripción (EN)",
          stepTitle: "Paso",
          stepTitleEs: "Título del Paso (ES)",
          stepTitleEn: "Título del Paso (EN)",
          stepDescriptionEs: "Descripción (ES)",
          stepDescriptionEn: "Descripción (EN)",
          imageUrl: "URL de Imagen (opcional)",
          noTutorials: "No hay tutoriales creados aún. Haz clic en \"Agregar Tutorial\" para comenzar.",
          deleteConfirm: "¿Estás seguro de que quieres eliminar este tutorial?",
          languageTabs: {
            spanish: "Español",
            english: "English",
          },
          targeting: {
            title: "Dónde mostrar este tutorial",
            showOnAllPages: "Mostrar en todas las páginas",
            specificPages: "Páginas específicas (una por línea)",
            placeholder: "/dashboard\n/products\n/team\n/orders",
            hint: "Ingresa las rutas de las páginas donde quieres que aparezca este tutorial. Ejemplo: /dashboard, /products, /team",
          },
        },
      },



      pays: {
        menuLabel: "Pagos",
        title: "Pagos",
        description:
          "Administra las pasarelas de pago, valida credenciales de prueba y asegura que la facturación esté lista para tu equipo.",
      },



      subscriptions: "Suscripciones",
      plans: "Planes",



      paymentHistory: {
        menuLabel: "Historial de pagos",
        title: "Historial de pagos",
        description: "Controla pagos completados, próximos cobros y registros manuales en un solo panel.",
        refreshLabel: "Actualizar",
        pullingLabel: "Suelta para actualizar",
        stats: {
          total: "Registros totales",
          paid: "Pagados",
          pending: "Pendientes",
          overdue: "Atrasados",
          upcoming: "Próximos",
        },
        filters: {
          all: "Todos",
          paid: "Pagados",
          pending: "Pendientes",
          overdue: "Atrasados",
          upcoming: "Próximos",
        },
        table: {
          user: "Miembro",
          amount: "Monto",
          dueDate: "Fecha de vencimiento",
          status: "Estado",
          nextCharge: "Próximo cobro",
          method: "Método",
          actions: "Acciones",
          manualLabel: "Registro manual",
          statusLabels: {
            paid: "Pagado",
            pending: "Pendiente",
            overdue: "Atrasado",
            upcoming: "Próximo",
          },
          markPaid: "Marcar como pagado",
          markPending: "Marcar como pendiente",
          markOverdue: "Marcar como atrasado",
          approvePayout: "Aprobar pago",
          rejectPayout: "Rechazar",
          empty: "No hay pagos para mostrar todavía.",
        },
        manualPayment: {
          triggerLabel: "Registrar pago manual",
          title: "Registrar pago manual",
          description: "Registra un pago fuera de línea para mantener alineado el historial con tus pasarelas.",
          userIdLabel: "ID del miembro",
          userIdPlaceholder: "Ingresa el ID del usuario",
          userNameLabel: "Nombre completo",
          userEmailLabel: "Correo electrónico",
          amountLabel: "Monto recibido",
          methodLabel: "Método de pago",
          notesLabel: "Notas",
          paidAtLabel: "Fecha del pago",
          cancelLabel: "Cancelar",
          submitLabel: "Guardar pago",
          amountHint: "Incluye impuestos o descuentos ya aplicados al monto final.",
          notesPlaceholder: "Agrega notas internas para tu equipo (opcional)",
          searchingUser: "Buscando usuario...",
          userNotFound: "Usuario no encontrado",
          loadingProviders: "Cargando métodos de pago...",
          noProvidersConfigured: "No hay proveedores de pago configurados. Por favor configura los métodos de pago en ajustes.",
        },
        empty: {
          title: "Sin actividad de pagos",
          description: "Los pagos manuales o vencidos aparecerán aquí cuando los registres o sincronices tu proveedor.",
          actionLabel: "Limpiar filtros",
        },
        error: {
          title: "No pudimos cargar los pagos",
          description: "Intenta actualizar o verifica tu conexión.",
          retryLabel: "Reintentar",
        },
        schedule: {
          title: "Cadencia de cobros",
          description: "Configura cuándo se generan los cargos recurrentes y cómo se envían recordatorios.",
          paymentModeLabel: "Modo de pago",
          paymentModeOptions: {
            manual: "Aprobación manual",
            automatic: "Procesamiento automático",
          },
          paymentModeHint: {
            manual: "Todos los pagos requerirán aprobación manual del administrador antes de procesarse.",
            automatic: "Los pagos se procesarán automáticamente según el calendario configurado.",
          },
          frequencyLabel: "Frecuencia",
          frequencyOptions: {
            weekly: "Semanal",
            biweekly: "Quincenal",
            monthly: "Mensual",
          },
          dayOfMonthLabel: "Día del mes de cobro",
          weekdayLabel: "Día de la semana de cobro",
          defaultAmountLabel: "Monto de cobro predeterminado",
          defaultAmountHint: "Se usa para completar pagos manuales y recordatorios.",
          remindersLabel: "Días de recordatorio (separados por coma)",
          remindersHint: "Ejemplo: 3,1 envía recordatorios tres y un día antes del cobro.",
          submitLabel: "Actualizar calendario",
          savingLabel: "Guardando…",
          lastUpdatedLabel: "Última actualización",
        },
      },

      salesHistory: {
        menuLabel: "Historial de Ventas",
        title: "Historial de Ventas",
        description: "Ver todas las compras y suscripciones pagadas desde la tienda principal y páginas de afiliados",
        refreshLabel: "Actualizar",
        stats: {
          totalRevenue: "Ingresos Totales",
          orders: "Órdenes",
          subscriptions: "Suscripciones",
          mainStore: "Tienda Principal",
          affiliateStore: "Tienda de Afiliados",
        },
        dateFilters: {
          title: "Rango de Fechas",
          description: "Filtrar ventas por rango de fechas",
          quickFilters: "Filtros Rápidos",
          all: "Todo el Tiempo",
          today: "Hoy",
          week: "Últimos 7 Días",
          month: "Últimos 30 Días",
          year: "Último Año",
          startDate: "Fecha de Inicio",
          endDate: "Fecha de Fin",
          clear: "Limpiar",
        },
        filtersTitle: "Filtros",
        filtersDescription: "Buscar y filtrar registros de ventas",
        searchPlaceholder: "Buscar por nombre, correo o ID...",
        filters: {
          all: "Todos",
          orders: "Órdenes",
          subscriptions: "Suscripciones",
          allSources: "Todas las Fuentes",
          mainStore: "Principal",
          affiliate: "Afiliados",
        },
        table: {
          type: "Tipo",
          customer: "Cliente",
          amount: "Monto",
          source: "Origen",
          gateway: "Pasarela",
          date: "Fecha",
        },
        typeLabels: {
          order: "Orden",
          subscription: "Suscripción",
        },
        sourceLabels: {
          mainStore: "Tienda Principal",
          affiliateStore: "Tienda de Afiliados",
        },
        noResults: "No se encontraron ventas",
      },

      broadcasts: {
        menuLabel: "Mensajería",
        title: "Mensajería masiva",
        description: "Envía anuncios segmentados a toda tu comunidad desde un solo lugar.",
        segments: {
          allUsers: {
            title: "Todos los miembros",
            description: "Envía una actualización a todos los perfiles registrados excepto los suspendidos.",
          },
          activeSubscribers: {
            title: "Suscriptores activos",
            description: "Contacta a los miembros que tienen la suscripción activa y pagada hoy.",
          },
          lapsedSubscribers: {
            title: "Suscriptores inactivos",
            description: "Recupera a quienes pagaron una suscripción y actualmente están cancelados o vencidos.",
          },
          productPurchasers: {
            title: "Compradores de un producto",
            description: "Comparte novedades con los miembros que adquirieron un producto específico.",
          },
          specificUser: {
            title: "Miembro individual",
            description: "Envía un mensaje personalizado a un miembro sin salir del panel.",
          },
        },
        form: {
          subjectLabel: "Asunto",
          subjectPlaceholder: "Actualización de la comunidad",
          bodyLabel: "Mensaje",
          bodyPlaceholder: "Comparte contexto, próximos pasos y fechas importantes para tu comunidad.",
          sendLabel: "Enviar anuncio",
          sendingLabel: "Enviando...",
          successTitle: "Anuncio enviado",
          successDescription: "{count} destinatarios recibieron tu mensaje.",
          previewHeading: "Vista previa de la audiencia",
          previewEmpty: "Elige un segmento para ver los primeros destinatarios.",
          previewCountLabel: "{count} destinatarios",
          environmentWarning: "Configura tu proveedor de correo antes de enviar anuncios.",
          missingSenderWarning: "Define CONTACT_FROM_EMAIL y CONTACT_FROM_NAME para habilitar el remitente.",
          productLabel: "Selecciona un producto",
          productPlaceholder: "Elige un producto",
          userLabel: "Selecciona un miembro",
          userPlaceholder: "Busca por nombre o correo",
          userEmpty: "Escribe para buscar un miembro.",
          userSearchHint: "Ingresa al menos dos caracteres para buscar en los registros.",
          pullToRefresh: {
            idle: "Desliza hacia abajo para refrescar los conteos",
            armed: "Suelta para refrescar",
            triggered: "Actualizando segmentos…",
          },
          validation: {
            subject: "Agrega un asunto con al menos 3 caracteres.",
            body: "Escribe al menos 20 caracteres antes de enviar.",
            selection: "Selecciona un producto o miembro para este anuncio.",
          },
        },
        errors: {
          overview: "No pudimos cargar la información de mensajería.",
          send: "No logramos enviar tu anuncio.",
          preview: "No pudimos obtener la vista previa de destinatarios.",
        },
        previewSampleLabel: "Primeros destinatarios listos",
      },


      seo: "SEO",

      saving: "Guardando...",

      siteContent: {

        menuLabel: "Contenido",

        title: "Branding y contenido de la landing",

        description: "Configura el nombre, logo y los textos públicos que ven los visitantes.",

        localeLabel: "Idioma del contenido",

        errorTitle: "No se pudo cargar la información",

        errorLoading: "No pudimos cargar la configuración actual.",

        retry: "Reintentar",

        footerNote:
          "Los cambios se reflejan al instante en la landing page y en toda la aplicación.",
        save: "Guardar",
        saving: "Guardando...",
        successTitle: "Cambios guardados",
        successDescription: "La configuración del sitio se ha actualizado correctamente.",
        errorDescription: "No pudimos guardar los cambios. Por favor, inténtalo de nuevo.",

        submit: {

          label: "Guardar configuración",

          saving: "Guardando...",

        },

        tabs: {

          header: "Header",

          landing: "Landing",

          footer: "Footer",

          affiliate: "Páginas de Afiliados",

        },

        toast: {

          loadError: {

            title: "Error al cargar la configuración",

            description: "No se pudo obtener la información actual. Inténtalo de nuevo.",

          },

          success: {

            title: "Configuración actualizada",

            description: "El branding y el contenido de la landing se guardaron correctamente.",

          },

          error: {

            title: "No se pudieron guardar los cambios",

            description: "Revisa los campos obligatorios e inténtalo nuevamente.",

          },

        },

        branding: {

          title: "Identidad de la marca",

          description:

            "Se usa en el encabezado, pie de página, metadatos y en toda la experiencia.",

          fields: {

            appName: "Nombre de la aplicación",

            logoUrl: "Logo (URL)",

            faviconUrl: "Favicon (URL)",

            description: "Descripción corta",

          },

        },

        landing: {

          title: "Contenido de la landing page",

          description:

            "Personaliza el hero, la sección Sobre nosotros y las preguntas frecuentes para el idioma seleccionado.",

        },

        hero: {

          title: "Sección hero",

          description:

            "Define el mensaje principal y la imagen de fondo que aparecen al inicio de la página.",

          fields: {

            title: "Título principal",

            subtitle: "Subtítulo principal",

            backgroundImageUrl: "Imagen de fondo (URL)",

          },

        },

        about: {

          title: "Sección sobre nosotros",

          description: "Cuenta la historia de la marca y refuerza la propuesta de valor.",

          fields: {

            title: "Título de la sección",

            description: "Descripción principal",

            secondaryDescription: "Descripción secundaria (opcional)",

            imageUrl: "Imagen ilustrativa (URL opcional)",

          },

        },

        howItWorks: {

          title: "Cómo funciona",

          description:

            "Describe los pasos que deben seguir distribuidores o clientes. Debe existir al menos un paso.",

          addStep: "Agregar paso",

          removeStep: "Eliminar",

          stepLabel: "Paso {{index}}",

          fields: {

            sectionTitle: "Título de la sección",

            sectionSubtitle: "Subtítulo de la sección",

            stepTitle: "Título del paso",

            stepDescription: "Descripción del paso",

            stepImageUrl: "Imagen del paso (URL opcional)",

          },

        },

        opportunity: {

          title: "Oportunidad de negocio",

          description:

            "Define el roadmap y el mensaje de la cuota mensual que muestra la sección de oportunidad.",

          addPhase: "Agregar fase",

          removePhase: "Eliminar",

          phaseLabel: "Fase {{index}}",

          fields: {

            title: "Título de la sección",

            duplicationNote: "Nota de duplicación",

            subtitle: "Subtítulo de la sección",

            networkCap: "Capacidad visible de red",

            monthlyFeeLabel: "Etiqueta de la cuota mensual",

            monthlyFeeAmount: "Monto de la cuota mensual",

            monthlyFeeDescription: "Descripción de la cuota mensual",

            summaryTitle: "Título de resumen (opcional)",

            summaryDescription: "Descripción de resumen (opcional)",

            phaseTitle: "Título de la fase",

            visibilityTag: "Etiqueta de visibilidad (opcional)",

            descriptor: "Descripción de la fase",

            requirement: "Requisito para avanzar",

            monthlyInvestment: "Inversión mensual",

            rewards: "Recompensas (una por línea)",

            accountBalance: "Resumen de saldo (opcional)",

            commission: "Resumen de comisión",

          },

        },

        testimonials: {

          title: "Testimonios",

          description: "Comparte historias y resultados de tus miembros o clientes.",

          addTestimonial: "Agregar testimonio",

          removeTestimonial: "Eliminar",

          itemLabel: "Testimonio {{index}}",

          fields: {

            title: "Título de la sección",

            name: "Nombre o título",

            quote: "Mensaje principal",

            role: "Rol o nota (opcional)",

            imageUrl: "Imagen (URL opcional)",

          },

        },

        featuredProducts: {

          title: "Productos destacados",

          description: "Configura el mensaje y el estado vacío del catálogo destacado.",

          fields: {

            title: "Título de la sección",

            subtitle: "Subtítulo o descripción",

            emptyState: "Mensaje cuando no hay productos",

          },

        },

        contact: {

          title: "Contacto",

          description: "Actualiza la información visible y los placeholders del formulario.",

          fields: {

            title: "Título de la sección",

            description: "Descripción de la sección",

            phone: "Teléfono de contacto",

            email: "Correo de contacto",

            address: "Dirección física",

            recipientEmail: "Correo destinatario",

            namePlaceholder: "Placeholder nombre",

            emailPlaceholder: "Placeholder correo",

            messagePlaceholder: "Placeholder mensaje",

            sendButton: "Texto del botón",

          },

        },

        team: {

          title: "Equipo",

          description: "Gestiona los miembros del equipo que se mostrarán en la landing page y en la página de equipo.",

          addMember: "Agregar miembro",

          removeMember: "Eliminar",

          itemLabel: "Miembro {{index}}",

          featuredMembersLabel: "Miembros destacados en landing (máx. 4)",

          featuredMembersHelper: "Selecciona hasta 4 miembros para mostrar en la sección de equipo de la landing page.",

          fields: {

            title: "Título de la sección",

            subtitle: "Subtítulo de la sección",

            name: "Nombre completo",

            role: "Cargo o posición",

            description: "Descripción breve (opcional)",

            imageUrl: "Imagen (URL opcional)",

          },

        },

        featuredTeam: {

          title: "Miembros Destacados del Equipo",

          description: "Selecciona hasta 3 miembros del equipo para destacar en la landing page. Primero agrega miembros en la pestaña Equipo.",

          sectionTitle: "Título de la Sección",

          sectionTitlePlaceholder: "Conoce a Nuestro Equipo",

          sectionSubtitle: "Subtítulo de la Sección",

          sectionSubtitlePlaceholder: "Las personas detrás de nuestro éxito",

          selectTitle: "Seleccionar Miembros Destacados",

          selectedCount: "{{count}} de 3 seleccionados",

          unnamedMember: "Miembro sin nombre",

          noRole: "Sin cargo",

          noMembersTitle: "No hay miembros del equipo disponibles",

          noMembersDescription: "Primero agrega miembros del equipo en la pestaña Equipo, luego vuelve aquí para seleccionar hasta 3 miembros destacados para la landing page.",

          saveChanges: "Guardar cambios",

        },

        faqs: {

          title: "Preguntas frecuentes",

          description:

            "Agrega respuestas a las preguntas más comunes. Puedes dejar esta sección vacía si no la necesitas.",

          addFaq: "Agregar pregunta",

          remove: "Eliminar",

          empty: "Aún no hay preguntas registradas.",

          questionLabel: "Pregunta",

          questionPlaceholder: "Pregunta",

          answerPlaceholder: "Respuesta",

          imageLabel: "Imagen (URL opcional)",

        },

        affiliateOpportunity: {

          title: "Oportunidad de Afiliados",

          description: "Configura la sección de promoción del programa de afiliados en la landing page.",

          refresh: "Actualizar",

          loadError: "No se pudo cargar la configuración. Haz clic en Actualizar para reintentar.",

          fields: {

            title: "Título",

            titlePlaceholder: "Programa de Afiliados",

            subtitle: "Subtítulo",

            subtitlePlaceholder: "Gana comisiones promocionando nuestros productos",

            description: "Descripción (opcional)",

            descriptionPlaceholder: "Descripción detallada del programa de afiliados...",

            commissionLabel: "Etiqueta de Comisión",

            commissionLabelPlaceholder: "Comisión por venta",

            commissionLabelHelp: "El porcentaje se obtiene automáticamente de la configuración de afiliados.",

            ctaText: "Texto del Botón (CTA)",

            ctaTextPlaceholder: "Únete Ahora",

            ctaLink: "Enlace del Botón",

            ctaLinkPlaceholder: "/register",

            imageUrl: "URL de Imagen (opcional)",

            imageUrlPlaceholder: "https://...",

          },

          benefits: {

            title: "Beneficios",

            addBenefit: "Agregar Beneficio",

            empty: "No hay beneficios configurados. Agrega beneficios para mostrar en la sección.",

            benefitLabel: "Beneficio {{index}}",

            icon: "Icono",

            iconPlaceholder: "gift, store, trending-up",

            benefitTitle: "Título",

            benefitTitlePlaceholder: "Comisiones Atractivas",

            benefitDescription: "Descripción",

            benefitDescriptionPlaceholder: "Gana hasta un 15% de comisión por cada venta referida",

          },

        },

        header: {

          title: "Navegación y acciones del header",

          description:

            "Administra los enlaces públicos, las opciones autenticadas y los llamados a la acción que aparecen en el encabezado.",

          landingLinks: {

            title: "Navegación de la landing",

            description: "Enlaces visibles en la página pública.",

            add: "Agregar enlace",

            remove: "Eliminar",

            label: "Etiqueta",

            href: "URL o ancla",

          },

          authenticatedLinks: {

            title: "Navegación autenticada",

            description: "Enlaces mostrados después de iniciar sesión.",

            add: "Agregar enlace",

            remove: "Eliminar",

            label: "Etiqueta",

            requiresAuth: "Requiere autenticación",

          },

          actions: {

            title: "Botones de acción",

            description: "Define las acciones principales que aparecerán en el encabezado.",

            primaryLabel: "Etiqueta de la acción principal",

            primaryHref: "Enlace de la acción principal",

            secondaryLabel: "Etiqueta de la acción secundaria",

            secondaryHref: "Enlace de la acción secundaria",

            showCart: "Mostrar acceso directo al carrito al autenticarse",

            showCartDescription:

              "Permite que los usuarios accedan al carrito con un solo clic después de iniciar sesión.",

          },

        },

        footer: {

          title: "Contenido del footer",

          description:

            "Configura el eslogan, los enlaces de navegación y los perfiles sociales que aparecen al final de cada página.",

          taglineLabel: "Eslogan",

          navigation: {

            title: "Enlaces de navegación",

            description: "Destaca las áreas clave de la experiencia.",

            add: "Agregar enlace",

            remove: "Eliminar",

            label: "Etiqueta",

            href: "URL o ancla",

          },

          legal: {

            title: "Enlaces legales",

            description: "Incluye las políticas indispensables para tus usuarios.",

            add: "Agregar enlace",

            remove: "Eliminar",

            label: "Etiqueta",

            href: "URL",

          },

          social: {

            title: "Perfiles sociales",

            description: "Comparte los destinos donde tu comunidad puede seguirte.",

            add: "Agregar perfil",

            remove: "Eliminar",

            empty: "Añade al menos un perfil social.",

            label: "Etiqueta accesible",

            href: "URL del perfil",

            platform: "Plataforma",

          },

          branding: {

            title: "Bloque de marca",

            description: "Controla cómo se muestra el logo, el nombre y el eslogan en el footer.",

            showLogo: "Mostrar logo",

            showLogoDescription: "Activa o desactiva el logotipo dentro del bloque de branding del footer.",

            showAppName: "Mostrar nombre de la app",

            showAppNameDescription: "Controla si el nombre aparece junto al logo y en la línea legal.",

            appNameLabel: "Nombre mostrado en el footer",

            appNamePlaceholder: "Ej. PÅ«rVita Network",

            showDescription: "Mostrar descripción",

            showDescriptionDescription: "Activa el eslogan debajo de tu identidad visual.",

            orientation: "Orientación del logo",

          },

          toggles: {

            language: "Mostrar selector de idioma",

            theme: "Mostrar selector de tema",

          },

        },

      },

      videoEdit: {
        title: "Editar Video",
        cardTitle: "Editar Video de Clase",
        loading: "Cargando video...",
        fields: {
          title: "Título",
          titleRequired: "Título *",
          titlePlaceholder: "Ingresa el título del video",
          description: "Descripción",
          descriptionPlaceholder: "Ingresa una descripción opcional",
          category: "Categoría",
          categoryPlaceholder: "Ej: Fitness, Nutrición, Bienestar",
          categoryHelper: "Categoría opcional para organizar los videos",
          visibility: "Visibilidad",
          visibilityRequired: "Visibilidad *",
          visibilityPlaceholder: "Selecciona quién puede ver el video",
          visibilityHelper: "Define quién puede acceder a este video",
          youtubeId: "ID de YouTube",
          youtubeIdRequired: "ID de YouTube *",
          youtubeIdPlaceholder: "Ej: dQw4w9WgXcQ",
          youtubeIdHelper: "Ingresa solo el ID del video de YouTube (la parte después de 'v=' en la URL)",
          order: "Orden",
          orderPlaceholder: "0",
          orderHelper: "Número que determina el orden de aparición (menor número = aparece primero)",
          published: "Publicado",
        },
        visibility: {
          all: "Todos los usuarios autenticados",
          subscription: "Solo usuarios con suscripción activa",
          product: "Solo usuarios que compraron un producto específico",
        },
        actions: {
          save: "Actualizar Video",
          saving: "Actualizando...",
          cancel: "Cancelar",
        },
        toast: {
          notFound: {
            title: "Video no encontrado",
            description: "El video que intentas editar no existe.",
          },
          loadError: {
            title: "Error",
            description: "No se pudo cargar el video.",
          },
          validationError: {
            title: "Error",
            description: "Título y ID de YouTube son requeridos.",
          },
          updateSuccess: {
            title: "Video actualizado",
            description: "El video se ha actualizado correctamente.",
          },
          updateError: {
            title: "Error",
            description: "No se pudo actualizar el video.",
          },
        },
      },

      appSettings: {
        menuLabel: "Multinivel",
        pageTitle: "Arquitectura de compensaciones",
        pageDescription:
          "Ajusta las reglas globales de compensación para tu red multinivel y mantén pagos predecibles en cada nivel.",
        title: "Configuración de la compensación",
        description:
          "Define cómo se reparten las comisiones, los bonos de liderazgo y los cupos máximos para cada fase de tu organización.",
        loading: "Cargando configuración actual...",
        errors: {
          title: "Detectamos un problema",
          loadFailed: "No pudimos cargar la configuración de la aplicación.",
          saveFailed: "No pudimos guardar la configuración de la aplicación.",
          invalidPercentages: "Ingresa porcentajes válidos entre 0 y 100.",
          invalidLevelAmount: "Cada nivel necesita un monto válido en la moneda configurada.",
          duplicateLevels: "Cada nivel debe ser único.",
          invalidCapacity: "Cada nivel debe tener una capacidad válida.",
          missingCapacityLevel: "Cada capacidad debe corresponder a un nivel configurado.",
          invalidCommissionRate: "El porcentaje de ganancia del equipo debe ser un valor válido entre 0 y 100.",
          invalidDiscountRate: "La ganancia del grupo debe ser un valor válido entre 0 y 100.",
          invalidTeamLevelsVisible: "Los niveles visibles del equipo deben estar entre 1 y 10.",
          invalidCurrencyCode: "Cada moneda debe tener un código ISO de 3 letras válido.",
          missingCurrencyCode: "Indica una moneda antes de asignar países.",
          invalidCountryCode: "Los códigos de país deben usar el formato ISO de 2 letras.",
          duplicateCurrencyCode: "Los códigos de moneda deben ser únicos.",
          duplicateCountryAssignment: "Cada país solo puede pertenecer a una moneda.",
          multipleGlobalCurrencies: "Solo una moneda puede cubrir todos los países restantes.",
          missingCountrySelection:
            'Selecciona al menos un país o activa la opción "Todos" para cada moneda configurada.',
          missingGlobalCurrency:
            'Activa la opción "Todos" en al menos una moneda para cubrir el resto de países.',
          missingDefaultCurrency:
            'Incluye la moneda predeterminada en las asignaciones para que funcione como respaldo global.',
        },
        toast: {
          successTitle: "Configuración actualizada",
          successDescription: "El motor de crecimiento ya refleja los cambios.",
          errorTitle: "No se pudo actualizar",
        },
        phaseLevels: {
          title: "Configuración de Red Multinivel",
          description:
            "Define cuánto gana cada fase por compras del equipo y las recompensas personales cuando la suscripción está activa.",
          nameLabel: "Nombre de Fase",
          nameEnLabel: "Nombre (Inglés)",
          nameEsLabel: "Nombre (Español)",
          commissionLabel: "Ganancia de Ecommerce (%)",
          discountLabel: "Comisión de Venta Directa (%)",
          groupGainHint: "Porcentaje que gana el patrocinador cuando su afiliado directo (personas que reclutó) realiza una venta en su tienda personalizada. Ejemplo: ingresa 10 para 10%.",
          creditLabel: "Crédito de Recompensa",
          freeProductLabel: "Valor de Producto Gratis",
          add: "Agregar fase",
          remove: "Eliminar fase",
        },
        teamVisibility: {
          title: "Configuración de la página de equipo",
          description: "Controla cuántos niveles descendentes se muestran en la página de equipo por defecto.",
          levelsLabel: "Niveles visibles",
          levelsHint: "Los miembros con suscripción activa verán hasta este número de fases.",
        },
        compensation: {
          currencyLabel: "Moneda predeterminada",
          currencyHint: "Moneda principal para pagos cuando ningún país coincide con una preferencia regional.",
          visibilityTitle: "Monedas por país",
          visibilityDescription:
            "Asigna qué monedas verán los usuarios según su país en planes, productos y ganancias.",
          codeLabel: "Código de moneda",
          codeHint: "Usa un código ISO 4217 válido (p. ej., USD).",
          codeDefaultHint: "Actualiza la moneda predeterminada arriba para cambiar este valor.",
          countriesLabel: "Visible en países",
          countriesPlaceholder: "US, MX, CO",
          countriesHint:
            'Cada país solo puede pertenecer a una moneda. Activa "Todos" para cubrir automáticamente el resto de países.',
          countriesEmpty: "Selecciona países",
          countriesAll: "Todos",
          countriesSummary: "{{count}} países seleccionados",
          countriesDialogTitle: "Asigna visibilidad por país",
          countriesDialogDescription:
            "Elige en qué países se mostrará esta moneda. Cada país solo puede pertenecer a una moneda.",
          countriesSearchPlaceholder: "Busca por nombre o código ISO",
          countriesAllDescription:
            'Aplica esta moneda a todos los países que no estén asignados a otra moneda.',
          countriesAllLabel: "Todos los países",
          countriesUnavailable: "Ya asignado a otra moneda",
          countriesDone: "Listo",
          addCurrency: "Agregar moneda",
          remove: "Eliminar moneda",
          defaultBadge: "Predeterminada",
          defaultInfo: "La moneda predeterminada está disponible globalmente salvo que otra asignación la reemplace.",
        },
        levels: {
          title: "Ganancias por nivel",
          description: "Define cuánto genera cada integrante para su patrocinador en cada nivel.",
          add: "Agregar nivel",
          remove: "Eliminar nivel",
          levelLabel: "Nivel",
          amountLabel: "Monto por integrante",
          amountHint: "Se guarda usando la moneda configurada.",
        },
        capacity: {
          title: "Capacidad por nivel",
          description: "Establece el máximo de integrantes permitidos para mantener equipos saludables.",
          levelLabel: "Nivel",
          maxMembersLabel: "Integrantes máximos",
        },
        frequency: {
          title: "Frecuencia de pago",
          placeholder: "Selecciona una frecuencia",
          weekly: "Semanal",
          biweekly: "Quincenal",
          monthly: "Mensual",
        },
        autoAdvance: {
          label: "Ascenso automático",
          description: "Si está activo, los miembros suben de rango automáticamente al cumplir la capacidad requerida.",
        },
        actions: {
          save: "Guardar cambios",
          saving: "Guardando...",
          reset: "Restablecer",
        },
      },

      contactSettings: {

        menuLabel: "Contacto",

        title: "Configuración del formulario de contacto",

        description: "Define el flujo de los mensajes del formulario, ajusta el remitente y activa respuestas automáticas.",

        loading: "Cargando configuración actual...",

        errors: {

          title: "Detectamos un problema",

          loadFailed: "No pudimos cargar la configuración de contacto.",

          saveFailed: "No pudimos guardar la configuración de contacto.",

        },

        toast: {

          successTitle: "Configuración de contacto actualizada",

          successDescription: "Los mensajes se enviarán con el nuevo enrutamiento.",

          errorTitle: "No se pudo actualizar",

        },

        form: {

          title: "Destinatarios y remitente",

          description: "Decide quién recibe los mensajes y qué identidad aparece en los correos enviados.",

          fromName: "Nombre del remitente",

          fromEmail: "Correo del remitente",

          replyTo: "Correo de respuesta",

          replyToPlaceholder: "Déjalo vacío para responder directo al visitante",

          recipientOverride: "Destinatario alternativo",

          recipientOverridePlaceholder: "Correo opcional que recibirá todos los mensajes",

          cc: "Correos en CC",

          ccPlaceholder: "ej. gerente@ejemplo.com, equipo@ejemplo.com",

          ccHelper: "Lista separada por comas. Déjala vacía para desactivar.",

          bcc: "Correos en BCC",

          bccPlaceholder: "ej. auditoria@ejemplo.com",

          bccHelper: "Lista separada por comas. Los destinatarios no verán estas direcciones.",

          subjectPrefix: "Prefijo del asunto",

          subjectPrefixPlaceholder: "ej. [Contacto PurVita]",

          reset: "Revertir cambios",

          submit: "Guardar cambios",

          saving: "Guardando...",

        },

        autoResponse: {

          title: "Respuesta automática",

          enableLabel: "Enviar confirmación al visitante",

          enableDescription: "Responde automáticamente después de recibir el mensaje.",

          subject: "Asunto de la confirmación",

          subjectPlaceholder: "Gracias por contactar a {{appName}}",

          body: "Mensaje de confirmación",

          bodyPlaceholder: "Gracias {{name}}. Recibimos tu mensaje y te responderemos pronto.",

          helper: "Usa {{name}} para el nombre del visitante y {{email}} para su correo.",

        },

        status: {

          title: "Estado del proveedor de correo",

          description: "Verifica las variables necesarias para enviar los mensajes.",

          provider: "Proveedor de correo",

          providerHint: "Agrega RESEND_API_KEY a tu archivo {{envFile}}.",

          fromName: "Nombre del remitente",

          fromNameHint: "Configura CONTACT_FROM_NAME en tu archivo {{envFile}}.",

          fromEmail: "Correo del remitente",

          fromEmailHint: "Configura CONTACT_FROM_EMAIL en tu archivo {{envFile}}.",

          ready: "Listo",

          missing: "Falta",

        },

        verification: {

          title: "Lista de verificación",

          description: "Ejecuta el script de apoyo para confirmar que las tablas existen.",

          sql: "Ejecuta check-tables.sql y comprueba que contact_settings y contact_messages tengan las columnas esperadas.",

          note: "No olvides definir CONTACT_FROM_EMAIL, CONTACT_FROM_NAME y RESEND_API_KEY en Supabase y en tu archivo {{envFile}}.",

        },

      },

      emailNotifications: {
        menuLabel: "Notificaciones por Correo",
        title: "Notificaciones por Correo",
        description: "Administra las plantillas de notificaciones por correo en múltiples idiomas. Personaliza el contenido que los usuarios reciben para diferentes eventos.",
        form: {
          title: "Plantillas de Correo",
          description: "Selecciona una plantilla para editar su contenido en inglés y español.",
          selectTemplate: "Seleccionar Plantilla",
          subject: "Asunto",
          body: "Cuerpo (HTML)",
          variablesHint: "Usa {{nombreVariable}} para contenido dinámico. Las variables disponibles dependen del tipo de plantilla.",
          submit: "Guardar Plantillas",
          saving: "Guardando...",
        },
        variables: {
          title: "Variables Disponibles",
          description: "Variables que puedes usar en tus plantillas de correo",
        },
        errors: {
          title: "Ocurrió un problema",
          saveFailed: "No se pudieron guardar las plantillas de correo.",
        },
        toast: {
          successTitle: "Plantillas actualizadas",
          successDescription: "Las plantillas de correo se guardaron exitosamente.",
          errorTitle: "Actualización fallida",
        },
      },

      security: {
        menuLabel: "Seguridad",
        title: "Centro de Seguridad",
        description: "Gestión integral de seguridad y monitoreo de amenazas para tu plataforma.",

        dashboard: {
          title: "Resumen de Seguridad",
          stats: {
            blockedIps: "IPs Bloqueadas",
            blockedAccounts: "Cuentas Bloqueadas",
            fraudAlerts: "Alertas de Fraude",
            securityEvents: "Eventos de Seguridad (24h)",
          },
        },

        captcha: {
          title: "Protección CAPTCHA",
          description: "Controla la verificación CAPTCHA en formularios y acciones sensibles.",
          enabled: "CAPTCHA Activado",
          disabled: "CAPTCHA Desactivado",
          toggle: "Alternar CAPTCHA",
          settings: {
            title: "Configuración de CAPTCHA",
            provider: "Proveedor",
            siteKey: "Clave del Sitio",
            secretKey: "Clave Secreta",
            threshold: "Umbral de Puntuación",
          },
        },

        blockedIps: {
          title: "Direcciones IP Bloqueadas",
          description: "Gestiona las direcciones IP bloqueadas. Las IPs auto-bloqueadas son detectadas por servicios de inteligencia de amenazas.",
          addButton: "Bloquear Dirección IP",
          noBlockedIps: "No hay IPs bloqueadas",
          viewDetails: "Ver Detalles",
          table: {
            ip: "Dirección IP",
            reason: "Razón",
            type: "Tipo",
            sources: "Fuentes",
            blockedAt: "Bloqueada el",
            expiresAt: "Expira el",
            actions: "Acciones",
          },
          form: {
            title: "Bloquear Dirección IP",
            ipAddress: "Dirección IP",
            reason: "Razón",
            expiresAt: "Expira el (Opcional)",
            permanent: "Bloqueo Permanente",
            submit: "Bloquear IP",
            cancel: "Cancelar",
          },
          details: {
            title: "Detalles del Bloqueo de IP",
            basicInfo: "Información Básica",
            type: "Tipo",
            auto: "Auto",
            autoBlocked: "Auto-bloqueada",
            manual: "Manual",
            permanent: "Permanente",
            threatSummary: "Resumen de Amenaza",
            confidence: "Confianza",
            detectionSources: "Fuentes de Detección",
            threatDetected: "Amenaza Detectada",
            clean: "Limpio",
            threatType: "Tipo de Amenaza",
            requestMetadata: "Metadatos de la Solicitud",
            path: "Ruta",
            method: "Método",
            userAgent: "Agente de Usuario",
            userId: "ID de Usuario",
            blockedTimestamp: "Bloqueada el",
          },
          unblock: "Desbloquear",
          confirmUnblock: "¿Estás seguro de que quieres desbloquear esta IP?",
        },

        blockedWords: {
          title: "Palabras Bloqueadas",
          description: "Gestiona palabras prohibidas en comentarios, mensajes y contenido generado por usuarios.",
          addButton: "Agregar Palabra Bloqueada",
          table: {
            word: "Palabra/Frase",
            category: "Categoría",
            severity: "Severidad",
            actions: "Acciones",
          },
          form: {
            title: "Agregar Palabra Bloqueada",
            word: "Palabra o Frase",
            category: "Categoría",
            severity: "Severidad",
            submit: "Agregar Palabra",
            cancel: "Cancelar",
          },
          categories: {
            profanity: "Profanidad",
            spam: "Spam",
            hate: "Discurso de Odio",
            other: "Otro",
          },
          severity: {
            low: "Baja",
            medium: "Media",
            high: "Alta",
            critical: "Crítica",
          },
          remove: "Eliminar",
          confirmRemove: "¿Estás seguro de que quieres eliminar esta palabra?",
        },

        blockedAccounts: {
          title: "Cuentas Bloqueadas",
          description: "Gestiona cuentas de usuario que han sido bloqueadas por violaciones de seguridad.",
          blockButton: "Bloquear Cuenta",
          table: {
            user: "Usuario",
            email: "Correo",
            reason: "Razón",
            fraudType: "Tipo de Fraude",
            blockedAt: "Bloqueada el",
            blockedBy: "Bloqueada por",
            expiresAt: "Expira el",
            actions: "Acciones",
          },
          form: {
            title: "Bloquear Cuenta de Usuario",
            searchUser: "Buscar Usuario",
            reason: "Razón",
            fraudType: "Tipo de Fraude",
            expiresAt: "Expira el (Opcional)",
            permanent: "Bloqueo Permanente",
            notes: "Notas Internas",
            evidence: "Evidencia (JSON)",
            submit: "Bloquear Cuenta",
            cancel: "Cancelar",
          },
          fraudTypes: {
            payment_fraud: "Fraude de Pago",
            chargeback_abuse: "Abuso de Contracargo",
            account_takeover: "Toma de Cuenta",
            velocity_abuse: "Abuso de Velocidad",
            multiple_accounts: "Múltiples Cuentas",
            synthetic_identity: "Identidad Sintética",
            other: "Otro",
          },
          unblock: "Desbloquear",
          confirmUnblock: "¿Estás seguro de que quieres desbloquear esta cuenta?",
          viewDetails: "Ver Detalles",
        },

        fraudAlerts: {
          title: "Alertas de Detección de Fraude",
          description: "Monitorea y revisa actividades sospechosas e intentos potenciales de fraude.",
          filters: {
            status: "Estado",
            riskLevel: "Nivel de Riesgo",
            dateRange: "Rango de Fechas",
          },
          table: {
            user: "Usuario",
            riskScore: "Puntuación de Riesgo",
            riskLevel: "Nivel de Riesgo",
            status: "Estado",
            createdAt: "Detectada el",
            actions: "Acciones",
          },
          status: {
            pending: "Pendiente",
            reviewed: "Revisada",
            cleared: "Despejada",
            confirmed_fraud: "Fraude Confirmado",
          },
          riskLevel: {
            minimal: "Mínimo",
            low: "Bajo",
            medium: "Medio",
            high: "Alto",
            critical: "Crítico",
          },
          viewDetails: "Ver Detalles",
          markReviewed: "Marcar como Revisada",
          markCleared: "No es Fraude - Descartar",
          confirmFraud: "Confirmar como Fraude",
        },

        auditLog: {
          title: "Registro de Auditoría de Seguridad",
          description: "Registro completo de eventos de seguridad y acciones administrativas.",
          filters: {
            eventType: "Tipo de Evento",
            severity: "Severidad",
            dateRange: "Rango de Fechas",
            user: "Usuario",
          },
          table: {
            timestamp: "Marca de Tiempo",
            eventType: "Tipo de Evento",
            severity: "Severidad",
            user: "Usuario",
            ipAddress: "Dirección IP",
            message: "Mensaje",
            actions: "Acciones",
          },
          severity: {
            info: "Info",
            warning: "Advertencia",
            error: "Error",
            critical: "Crítico",
          },
          viewDetails: "Ver Detalles",
          export: "Exportar Registro",
        },

        threatIntelligence: {
          title: "Inteligencia de Amenazas",
          description: "Configura servicios externos de detección de amenazas y monitoreo.",
          abuseChSection: {
            title: "Integración Abuse.ch",
            description: "URLhaus y ThreatFox para detección de URLs e IPs maliciosas.",
            enabled: "Activado",
            urlhausEnabled: "URLhaus Activado",
            threatfoxEnabled: "ThreatFox Activado",
            cacheTtl: "TTL de Caché (segundos)",
            logThreats: "Registrar Amenazas Detectadas",
          },
          virusTotalSection: {
            title: "Integración VirusTotal",
            description: "Detección avanzada de amenazas usando la API de VirusTotal.",
            enabled: "Activado",
            apiKey: "Clave API",
            cacheTtl: "TTL de Caché (segundos)",
          },
          strategySection: {
            title: "Estrategia de Detección",
            description: "Cómo combinar resultados de múltiples servicios de inteligencia de amenazas.",
            strategy: "Estrategia",
            strategies: {
              any: "Cualquiera (Marcar si cualquier servicio detecta amenaza)",
              majority: "Mayoría (Marcar si la mayoría detecta amenaza)",
              all: "Todos (Marcar solo si todos los servicios detectan amenaza)",
            },
          },
          save: "Guardar Configuración",
          saving: "Guardando...",
        },

        toast: {
          successTitle: "Éxito",
          errorTitle: "Error",
          ipBlocked: "Dirección IP bloqueada exitosamente",
          ipUnblocked: "Dirección IP desbloqueada exitosamente",
          wordAdded: "Palabra agregada a la lista de bloqueo",
          wordRemoved: "Palabra eliminada de la lista de bloqueo",
          accountBlocked: "Cuenta bloqueada exitosamente",
          accountUnblocked: "Cuenta desbloqueada exitosamente",
          alertUpdated: "Estado de alerta actualizado",
          configSaved: "Configuración guardada exitosamente",
          error: "Ocurrió un error. Por favor, intenta de nuevo.",
        },
      },

      uploadLimits: {
        menuLabel: "Límites de Carga",
        title: "Límites de Carga de Archivos",
        description: "Configura los tamaños máximos de archivos, tipos permitidos y restricciones de carga para imágenes, videos y documentos en toda la plataforma.",
      },

      auditLogs: {
        menuLabel: "Registros de Auditoría",
        title: "Registros de Auditoría",
        description: "Visualiza toda la actividad del sistema y acciones administrativas. Rastrea quién hizo qué, cuándo y desde dónde.",
        filters: {
          search: "Buscar",
          searchPlaceholder: "Buscar en acción o tipo...",
          action: "Acción",
          actionPlaceholder: "ej., PRODUCT_CREATED",
          entityType: "Tipo de Entidad",
          entityTypePlaceholder: "ej., producto, usuario",
          startDate: "Fecha Inicio",
          endDate: "Fecha Fin",
          decryptIps: "Desencriptar IPs",
          applyFilters: "Aplicar Filtros",
          clearFilters: "Limpiar Filtros",
          dateRange: "Rango de Fechas",
          user: "Usuario",
        },
        table: {
          dateTime: "Fecha/Hora",
          user: "Usuario",
          action: "Acción",
          entity: "Entidad",
          status: "Estado",
          ip: "Dirección IP",
          details: "Detalles",
          viewMetadata: "Ver metadatos",
          system: "Sistema",
          noName: "Sin nombre",
          encrypted: "[ENCRIPTADO]",
          noData: "-",
          timestamp: "Fecha/Hora",
        },
        pagination: {
          showing: "Mostrando",
          to: "a",
          of: "de",
          records: "registros",
          page: "Página",
          previous: "Anterior",
          next: "Siguiente",
        },
        loading: "Cargando registros...",
        noRecords: "No se encontraron registros de auditoría",
        refresh: "Actualizar",
        empty: "No se encontraron registros de auditoría",
      },

      advertisingScripts: {
        menuLabel: "Publicidad",
        pageTitle: "Scripts de Publicidad",
        pageDescription: "Configura los scripts de Facebook Pixel, TikTok Pixel y Google Tag Manager. Estos scripts solo se inyectarán en las páginas públicas principales, NO en las páginas personalizadas de afiliados.",

        facebookPixel: {
          title: "Facebook Pixel",
          description: "Configura Facebook Pixel para rastrear conversiones y eventos en tu sitio web principal.",
          enableLabel: "Habilitar Facebook Pixel",
          idLabel: "ID del Pixel",
          scriptLabel: "Código del Script Completo",
          scriptHelper: "Pega el código completo de Facebook Pixel proporcionado por Facebook.",
        },

        tiktokPixel: {
          title: "TikTok Pixel",
          description: "Configura TikTok Pixel para rastrear conversiones y eventos en tu sitio web principal.",
          enableLabel: "Habilitar TikTok Pixel",
          idLabel: "ID del Pixel",
          scriptLabel: "Código del Script Completo",
          scriptHelper: "Pega el código completo de TikTok Pixel proporcionado por TikTok.",
        },

        gtm: {
          title: "Google Tag Manager",
          description: "Configura Google Tag Manager para gestionar todas tus etiquetas de seguimiento en un solo lugar.",
          enableLabel: "Habilitar Google Tag Manager",
          containerIdLabel: "ID del Contenedor",
          scriptLabel: "Código del Script Completo",
          scriptHelper: "Pega el código completo de Google Tag Manager proporcionado por Google.",
        },

        saveButton: "Guardar Configuración",
        successTitle: "Éxito",
        successDescription: "La configuración de scripts de publicidad se guardó correctamente",
        errorLoading: "Error",
        errorLoadingDescription: "No se pudo cargar la configuración de scripts de publicidad",
        errorSaving: "Error",
        errorSavingDescription: "No se pudo guardar la configuración de scripts de publicidad",
      },

      support: "Soporte",



      siteStatus: {

        menuLabel: "Estado del sitio",

        title: "Modos de visibilidad del sitio",

        description:

          "Controla cómo experimentan los visitantes la plataforma y personaliza los metadatos para cada estado.",

        maintenance: {

          title: "Modo mantenimiento",

          description: "Muestra un aviso de mantenimiento mientras realizas actualizaciones internas.",

        },

        comingSoon: {

          title: "Modo próximamente",

          description: "Presenta una página de expectativa y genera interés antes del lanzamiento.",

        },

        modeSelectorTitle: "Elige un modo",

        modeSelectorDescription:

          "Selecciona la experiencia que verán las personas al ingresar al sitio.",

        deactivate: "Desactivar modo",
        deactivating: "Desactivando...",
        deactivateFeedback: {
          successTitle: "Modo desactivado",
          successDescription: "El sitio volvió a su estado normal.",
          errorTitle: "Error al desactivar",
          errorDescription: "Inténtalo nuevamente.",
          errorMessage: "No pudimos desactivar el modo seleccionado.",
        },
        none: {
          title: "En línea",
          description: "Mantén la experiencia completa disponible. Ideal cuando tu tienda está lista para los visitantes.",
        },
        activeBadge: "Activo",

        seoSection: {

          title: "Metadatos SEO",

          description:

            "Personaliza los metadatos que usarán los motores de búsqueda y las redes sociales para el modo seleccionado.",

          fields: {

            title: "Título de la página",

            description: "Descripción meta",

            keywords: "Palabras clave",

            ogTitle: "Título Open Graph",

            ogDescription: "Descripción Open Graph",

            ogImage: "Imagen Open Graph (URL)",

            twitterTitle: "Título para Twitter/X",

            twitterDescription: "Descripción para Twitter/X",

            twitterImage: "Imagen para Twitter/X (URL)",

          },

          placeholders: {

            optional: "Opcional",

          },

        },

        appearanceSection: {

          title: "Acceso y fondo",

          description:

            "Mantén listo el acceso para el equipo y los elementos visuales mientras el modo esté activo.",

          fields: {

            backgroundImage: "Imagen de fondo (URL)",

            backgroundOverlay: "Opacidad de la superposición",

          },

          placeholders: {
            backgroundImage: "https://ejemplo.com/portada.jpg",
          },
          social: {
            title: "Redes sociales",
            description: "Comparte los perfiles donde tu audiencia puede seguir tus actualizaciones.",
            add: "Agregar enlace social",
            remove: "Eliminar enlace social",
            label: "Etiqueta",
            labelPlaceholder: "Instagram",
            platform: "Plataforma",
            platformPlaceholder: "Selecciona una plataforma",
            platforms: {
              facebook: "Facebook",
              instagram: "Instagram",
              youtube: "YouTube",
              x: "X (Twitter)",
              whatsapp: "WhatsApp",
            },
            url: "URL",
            urlPlaceholder: "https://instagram.com/tumarca",
          },

          backgroundHelper:
            "Proporciona una imagen para personalizar la página pública de mantenimiento o próximamente.",

          overlayHelper:

            "Controla qué tan oscura será la superposición sobre la imagen de fondo (0% = transparente, 100% = opaca).",

          access: {

            title: "Acceso para administradores",

            description: "Permite que tu equipo acceda al panel usando una URL mientras la página está bloqueada.",

            field: "URL de bypass para login",

            helper: "Solo esta ruta exacta permitirá ingresar al administrador mientras el modo esté activo.",

          },
          appearanceSection: {
            title: "Acceso y fondo",
            description: "Mantén listo el acceso para el equipo y los elementos visuales mientras el modo esté activo.",
            fields: {
              password: "Contraseña de acceso",
              backgroundImage: "Imagen de fondo (URL)",
            },
            social: {
              label: "Redes sociales",
              labelPlaceholder: "Ej: Síguenos",
            },
          },
        },

        comingSoonSettings: {

          title: "Configuración de Próximamente",

          description:

            "Ajusta la cuenta regresiva y el acceso para administradores en la página de expectativa.",

          fields: {

            mailchimpAudienceId: "ID de audiencia Mailchimp",

            mailchimpServerPrefix: "Prefijo del servidor Mailchimp",

            loginBypassUrl: "URL de acceso para administradores",

          },

          placeholders: {

            mailchimpAudienceId: "a1b2c3d4e5",

            mailchimpServerPrefix: "us21",

            loginBypassUrl: "/purvitaadmin",

          },

          helperText: {

            mailchimpAudienceId: "Encuentra este valor en la configuración de tu audiencia en Mailchimp.",

            mailchimpServerPrefix: "El código antes de .api.mailchimp.com (por ejemplo, us21).",

            loginBypassUrl: "Solo esta ruta quedará disponible mientras el sitio esté en modo próximamente.",

          },

          branding: {

            title: "Marca y estilo visual",

            description: "Define el logo y el fondo que se muestran en la página de próximamente.",

            logoLabel: "URL del logo para próximamente",

            logoPlaceholder: "https://ejemplo.com/logo.svg",

            logoHelper: "Reemplaza el logo del sitio solo en la página de próximamente.",

            backgroundModeLabel: "Estilo de fondo",

            backgroundModeOptions: {

              image: "Imagen",

              gradient: "Degradado",

            },

            backgroundModeHelper: "Elige entre mostrar una imagen o un degradado como fondo.",

            backgroundImageLabel: "Imagen de fondo personalizada",

            backgroundImagePlaceholder: "https://ejemplo.com/fondo.jpg",

            backgroundImageHelper:

              "Imagen opcional que reemplaza el fondo global cuando el modo próximamente está activo.",

            overlayLabel: "Opacidad de la superposición",

            overlayHelper:

              "Ajusta qué tanto oscurece la superposición cuando usas una imagen de fondo (0% = transparente, 100% = opaca).",

            gradientLabel: "Colores del degradado",

            gradientHelper: "Proporciona al menos dos colores para recrear el degradado de la página.",

            gradientColorLabel: "Color del degradado",

            addColor: "Agregar color",

            removeColor: "Eliminar color",

            gradientLimit: "Puedes definir hasta cinco puntos de color.",

          },

          countdown: {

            title: "Cuenta regresiva",

            description:

              "Muestra una cuenta regresiva en la página de próximamente para reforzar la fecha de lanzamiento.",

            enableLabel: "Mostrar cuenta regresiva",

            enableHelper: "Activa esta opción para que el bloque se vea en la página pública.",

            styleLabel: "Estilo de la cuenta regresiva",

            stylePlaceholder: "Elige un estilo",

            styleOptions: {

              date: "Fecha objetivo",

              numeric: "Valor numérico",

            },

            styleHelperDate: "Presenta una cuenta regresiva en vivo hasta la fecha de lanzamiento configurada.",

            styleHelperNumeric: "Mantén un diseño simple con un número estático y una leyenda.",

            label: "Leyenda",

            labelPlaceholder: "Lanzamos en",

            labelHelper: "Texto opcional que se muestra debajo de la cuenta regresiva.",

            dateLabel: "Fecha de lanzamiento",

            dateHelper: "Selecciona la fecha y hora en tu zona horaria local.",

            numericLabel: "Valor numérico",

            numericHelper: "Ideal para destacar los días restantes u otra métrica relevante.",

          },

        },


        connectionsSection: {

          title: "Audiencia y comunidad",

          description:

            "Configura la integración de la lista de espera y mantén actualizados los perfiles sociales desde aquí.",

          mailchimp: {

            title: "Integración con Mailchimp",

            description: "Ingresa los datos de Mailchimp que se usarán en la lista de espera de próximamente.",

            helperActive: "Las suscripciones se sincronizarán automáticamente mientras el modo próximamente esté activo.",

            helperInactive: "Estos ajustes quedarán guardados para cuando actives el modo próximamente.",

          },

        },

        overviewSection: {

          title: "Experiencia actual",

          description:

            "Supervisa el modo activo y la información clave de las integraciones.",

          statusLabel: "Estado",

          active: "Activo",

          bypassLabel: "URL de bypass",

          mailchimpLabel: "Mailchimp",

          mailchimpConfigured: "Configurado",

          mailchimpMissing: "Sin configurar",

          socialLabel: "Enlaces sociales",

          socialEmpty: "Ninguno",

          empty: "No hay ningún modo activo en este momento.",

          emptyHelper:

            "Elige un modo para publicar una experiencia dedicada para tus visitantes.",

        },

        modeHint:

          "Los cambios solo afectan al modo seleccionado. Cambia de modo para configurar su SEO de forma independiente.",

        save: "Guardar cambios",

        saving: "Guardando...",

        successTitle: "Estado del sitio actualizado",

        successDescription: "La configuración se guardó correctamente.",

        errorTitle: "No se pudo actualizar",

        errorDescription: "Revisa la información e inténtalo de nuevo.",

        saveError: "No pudimos guardar tus cambios.",

        loadError: "No pudimos cargar la configuración actual.",

        alertTitle: "Detectamos un problema",

        retry: "Reintentar",

        loading: "Cargando la configuración actual...",

      },

      pages: {
        menuLabel: "Páginas",
        title: "Editor de Páginas",
        description: "Edita y gestiona las páginas de tu sitio web incluyendo la landing page.",
        errorLoading: "No se pudo cargar la configuración de la página",
        errorTitle: "No se pudo cargar la información",
        localeLabel: "Idioma del contenido",
        retry: "Reintentar",
        tabs: {
          landing: "Landing Page",
          team: "Página de Equipo",
          contact: "Página de Contacto",
          privacy: "Política de Privacidad",
          terms: "Términos de Servicio",
        },
        toast: {
          success: {
            title: "Configuración actualizada",
            description: "Los cambios se guardaron correctamente.",
          },
          error: {
            title: "Error al actualizar",
            description: "No se pudieron guardar los cambios.",
          },
        },
      },



      network: "Red",



      totalUsers: "Usuarios Totales",



      totalProducts: "Productos Totales",



      activeSubscriptions: "Suscripciones Activas",



      totalRevenue: "Ingresos Totales",



      subscriptionRevenue: "Ingresos por Suscripción (Mes)",



      ecommerceRevenue: "Ingresos de E-commerce",



      walletLiability: "Saldo de Billeteras",



      waitlistedMembers: "Miembros en Lista de Espera",



      totalStock: "Inventario Total",



      comingSoonSubscribers: "Suscriptores Muy Pronto",



      phaseDistribution: {

        heading: "Distribución por fases",

        subtitle: "Observa cómo progresa tu organización a través de cada fase del plan.",

        empty: "Aún no hay miembros con fases asignadas.",

        membersLabel: "{{count}} miembros",

        phases: {

          phase0: "Fase 0 · Activación",

          phase1: "Fase 1 · Reclutamiento directo",

          phase2: "Fase 2 · Segundo nivel",

          phase3: "Fase 3 · Retención",

        },

      },



      recentActivity: "Actividad Reciente",



      recentActivityInfo: "Un registro de nuevos usuarios, compras y más.",



      inventoryOverview: "Resumen de Inventario",



      inventorySummary: "Monitorea existencias en tiempo real para reabastecer productos clave a tiempo.",



      quickActions: "Acciones Rápidas",



      quickActionsInfo: "Enlaces a tareas administrativas comunes.",



      userManagement: "Gestión de Usuarios",



      userManagementDesc: "Ver, editar y gestionar todos los usuarios de la red.",



      filterUsers: "Filtrar usuarios...",



      user: "Usuario",



      role: "Rol",



      status: "Estado",



      joinDate: "Fecha de Ingreso",



      actions: "Acciones",



      editUser: "Editar Usuario",



      viewDetails: "Ver Detalles",



      deleteUser: "Eliminar Usuario",
      noUsersFound: "No se encontraron usuarios.",

      impersonation: {
        title: "Ingresar con esta cuenta",
        description:
          "Abre una sesión segura como este miembro para depurar su experiencia. Tu sesión de administrador se reanudará cuando cierres sesión.",
        actionLabel: "Ingresar como usuario",
        busyLabel: "Preparando acceso...",
        errorTitle: "No se pudo ingresar",
        errorDescription: "No pudimos preparar el enlace de acceso. Intenta de nuevo en unos segundos.",
      },

      editUserDesc: "Editando la cuenta de usuario de",



      backToUsers: "Volver a Usuarios",



      selectRole: "Seleccionar un rol",



      selectStatus: "Seleccionar un estado",



      saveChanges: "Guardar Cambios",



      cancel: "Cancelar",



      subscriptionSettings: {
        title: "Gestión de suscripción",
        description: "Controla el acceso a la membresía de este usuario.",
        statusLabel: "Estado de la suscripción",
        statusPlaceholder: "Selecciona un estado",
        statusOptions: {
          active: "Activa",
          pastDue: "Atrasada",
          canceled: "Cancelada",
          unpaid: "No pagada",
        },
        statusHelper: "Otorga o revoca el acceso a los beneficios pagados.",
        gatewayLabel: "Proveedor de cobro",
        gatewayPlaceholder: "Selecciona un proveedor",
        gatewayOptions: {
          wallet: "Monedero interno",
        },
        gatewayHelper: "Selecciona la pasarela de pago que respaldará la suscripción.",
        durationLabel: "Duración",
        durationPlaceholder: "Selecciona el tiempo de vigencia",
        durationOptions: {
          oneMonth: "1 mes",
          threeMonths: "3 meses",
          sixMonths: "6 meses",
          twelveMonths: "12 meses",
          custom: "Fecha personalizada",
        },
        periodEndLabel: "Vigente hasta",
        periodEndHelper: "La suscripción expira al finalizar esta fecha.",
      },



      walletSettings: {
        title: "Saldo de monedero",
        description: "Ajusta el saldo del monedero para reflejar pagos externos o correcciones manuales.",
        currentBalanceLabel: "Saldo actual (USD)",
        targetBalanceLabel: "Nuevo saldo (USD)",
        noteLabel: "Nota interna (opcional)",
        notePlaceholder: "Ej. Ajuste manual por pago en efectivo",
        helper: "La nota quedará registrada en el historial de transacciones.",
      },

      networkEarningsSettings: {
        title: "Ganancias de Red Multinivel",
        description: "Ajusta las ganancias disponibles generadas por la red multinivel del usuario.",
        currentBalanceLabel: "Ganancias actuales (USD)",
        targetBalanceLabel: "Nuevas ganancias (USD)",
        noteLabel: "Nota interna (opcional)",
        notePlaceholder: "Ej. Ajuste por comisiones no registradas",
        helper: "Las ganancias ajustadas estarán disponibles para transferir al monedero.",
      },



      referralSettings: {
        title: "Asignación de equipo",
        description: "Asigna este usuario al equipo de otro usuario ingresando el ID del líder del equipo.",
        teamIdLabel: "ID del equipo (líder)",
        teamIdPlaceholder: "Pega el ID del usuario líder del equipo",
        teamIdHelper: "Introduce el ID del usuario cuyo equipo se unirá este miembro, o deja vacío para que no pertenezca a ningún equipo.",
        currentReferrer: "Actualmente asignado al equipo de",
        none: "No asignado a ningún equipo",
        clear: "Remover de este equipo",
        teamCount: "Equipo",
        teamSize: "Tamaño del equipo",
        members: "miembros",
        currentUserTeam: "Equipo de este usuario",
        teamCountHelper: "Usuarios que tienen a este usuario como líder de equipo",
      },



      userUpdateFeedback: {
        successTitle: "Usuario actualizado",
        successDescription: "Los cambios del perfil se guardaron correctamente.",
        errorTitle: "No se pudo actualizar",
        errorDescription: "No pudimos actualizar al usuario. Inténtalo de nuevo.",
        noChangesTitle: "Sin cambios detectados",
        noChangesDescription: "Actualiza al menos un campo antes de guardar.",
        invalidWalletAmountTitle: "Saldo inválido",
        invalidWalletAmountDescription: "Ingresa un monto válido y no negativo para el monedero.",
        invalidNetworkEarningsTitle: "Ganancias inválidas",
        invalidNetworkEarningsDescription: "Ingresa un monto válido y no negativo para las ganancias de red.",
        missingPeriodEndTitle: "Falta la vigencia",
        missingPeriodEndDescription: "Elige cuánto tiempo permanecerá activa la suscripción.",
      },



      productManagement: "Gestión de Productos",



      productManagementDesc: "Añadir, editar o eliminar productos del catálogo.",



      addProduct: "Añadir Producto",



      product: "Producto",



      price: "Precio",



      statusActive: "Activo",



      editProduct: "Editar Producto",



      deleteProduct: "Eliminar Producto",



      backToProducts: "Volver a Productos",



      addNewProduct: "Añadir Nuevo Producto",



      addNewProductDesc: "Rellena los detalles para crear un nuevo producto.",



      editProductDesc: "Modifica los detalles del producto.",



      productName: "Nombre del Producto",



      productSlug: "Slug del Producto (URL)",



      productDescription: "Descripción del Producto",



      productDescriptionPlaceholder: "Describe el producto, sus características, beneficios, etc.",



      productImageUrl: "URL de la Imagen",



      stockQuantity: "Unidades en Inventario",



      productCountrySectionTitle: "Disponibilidad por país",



      productCountrySectionDescription:



        "Selecciona los países donde se mostrará el botón de agregar al carrito. Los miembros fuera de esas regiones no verán el carrito ni podrán comprar.",



      productCountryManageButton: "Gestionar países",



      productCountryDialogTitle: "Elige países disponibles",



      productCountryDialogDescription:



        "Solo los miembros cuyo país en el perfil coincida con los seleccionados podrán agregar este producto al carrito.",



      productCountrySearchPlaceholder: "Buscar país…",



      productCountryNoResults: "Ningún país coincide con tu búsqueda.",



      productCountryHelper:



        "Selecciona al menos un país para habilitar el carrito. Si dejas la lista vacía, el carrito se ocultará en todos los países.",



      productCountryEmptySummary: "El carrito está deshabilitado para todos los países.",



      productCountrySummaryTemplate: "{{count}} países pueden acceder al carrito.",



      productCountryBadgeA11y: "País seleccionado: {{country}}",



      productCountryClear: "Borrar selección",



      productCountryClose: "Listo",



      productFeatured: "Producto destacado",



      productFeaturedDescription: "Activa esta opción para mostrar el producto en el carrusel de la página principal.",



      productDiscountSectionTitle: "Descuentos",



      productDiscountSectionDescription:



        "Configura descuentos opcionales para este producto. Deja el tipo en 'Sin descuento' para mantener el precio original.",



      productDiscountTypeLabel: "Tipo de descuento",



      productDiscountTypeNone: "Sin descuento",



      productDiscountTypeAmount: "Monto fijo",



      productDiscountTypePercentage: "Porcentaje",



      productDiscountTypeHelper: "Los porcentajes se aplican por unidad. Los montos fijos se limitan al precio del producto.",



      productDiscountValueLabel: "Valor del descuento",



      productDiscountValueHint: "Ingresa el valor a restar del precio. Los porcentajes están limitados a 100%.",



      productDiscountValuePlaceholderAmount: "10.00",



      productDiscountValuePlaceholderPercent: "15",



      productDiscountLabel: "Etiqueta del descuento",



      productDiscountLabelPlaceholder: "Oferta por tiempo limitado",



      productDiscountInlineHint: "Se muestra en las tarjetas de producto, vistas rápidas y el resumen de pago.",



      productDiscountValidation: "Ingresa un valor de descuento mayor a cero.",



      productDiscountColumn: "Descuento",



      productDiscountNone: "Sin descuento",



      productDiscountActiveFallback: "Oferta especial",



      productDiscountAmountSummary: "-${{amount}} USD",



      productDiscountPercentSummary: "-{{percent}}%",



      productDiscountBulkAction: "Descuento masivo",



      productDiscountBulkTitle: "Aplicar descuento a los productos seleccionados",



      productDiscountBulkDescription: "Actualiza el descuento de {{count}} productos seleccionados.",



      productDiscountBulkCancel: "Cancelar",



      productDiscountBulkSubmit: "Aplicar descuento",



      productDiscountInvalidTitle: "Descuento requerido",



      productDiscountBulkSuccessTitle: "Descuentos actualizados",



      productDiscountBulkSuccess: "{{count}} productos ahora comparten el descuento actualizado.",



      productDiscountBulkErrorTitle: "No se pudo actualizar",



      productDiscountBulkError: "No pudimos actualizar los productos seleccionados. Inténtalo de nuevo.",



      productDiscountVisibilityLabel: "Visibilidad del descuento",



      productDiscountVisibilityHint: "Selecciona dónde se verá y aplicará este descuento.",



      productDiscountVisibilityMainStore: "Tienda principal",



      productDiscountVisibilityAffiliateStore: "Tienda del afiliado",



      productDiscountVisibilityMlmStore: "Tienda MLM",



      productDiscountVisibilityWarning: "Selecciona al menos una tienda para aplicar el descuento.",



      productSelectionLabel: "{{count}} productos seleccionados",



      productSelectionClear: "Limpiar selección",



      productSelectAllLabel: "Seleccionar todos los productos",



      productSelectAria: "Seleccionar {{name}}",



      productBulkDelete: "Eliminar seleccionados",



      productBulkDeleteConfirmTitle: "¿Eliminar productos seleccionados?",



      productBulkDeleteConfirmDescription: "Estás a punto de eliminar {{count}} productos. Esta acción no se puede deshacer.",



      productBulkDeleteSuccess: "{{count}} productos eliminados correctamente",



      productBulkDeleteError: "No se pudieron eliminar algunos productos",



      featuredColumn: "Destacado",



      featuredYes: "Sí",



      featuredNo: "No",



      saveProduct: "Guardar Producto",



      languageEnglish: "Inglés",



      languageSpanish: "Español",



      productExperienceTitle: "Contenido de la experiencia del producto",



      productExperienceDescription: "Define la narrativa que los clientes verán en la página de detalles del producto.",



      productExperienceLocaleHeading: "Narrativa localizada",



      productExperienceLocaleDescription:



        "Proporciona contenido específico por idioma. Deja los campos vacíos para usar los valores predeterminados globales.",



      productExperienceTagline: "Frase principal",



      productExperienceTaglinePlaceholder: "Impulsa tu ritual diario.",



      productExperienceHeroSupporting: "Sub Texto",



      productExperienceHeroSupportingPlaceholder:



        "Explica el beneficio principal en una o dos oraciones.",



      productExperienceHighlights: "Por qué te encantará",



      productExperienceHighlightsPlaceholder: "Aporta energía sostenida\nEquilibra el estado de ánimo naturalmente",



      productExperienceUsage: "Cómo usar",



      productExperienceUsagePlaceholder: "Toma dos dosis por la mañana\nMantén debajo de la lengua 30 segundos",



      productExperienceIngredients: "Ingredientes (uno por línea)",



      productExperienceIngredientsPlaceholder: "Moringa orgánica\nRaíz de ashwagandha",



      productExperienceWellness: "Beneficios de bienestar (uno por línea)",



      productExperienceWellnessPlaceholder: "Mejora el enfoque\nReduce el estrés diario",



      productExperienceInsights: "Consejos de ritual diario",



      productExperienceInsightsPlaceholder: "Acompaña con hidratación\nRegistra tu progreso semanal",



      productExperienceListHelper: "Escribe cada elemento en su propia línea. Nosotros formatearemos la lista por ti.",



      productExperienceRatingAverage: "Calificación promedio",



      productExperienceRatingHelper: "Acepta valores entre 0 y 5. Se muestra junto al resumen de reseñas.",



      productExperienceRatingCount: "Total de reseñas verificadas",



      productExperienceReviewsTitle: "Reseñas seleccionadas",



      productExperienceReviewsDescription:



        "Publica testimonios creíbles o destaca comentarios reales de la comunidad.",



      productExperienceReviewEmpty: "Aún no hay reseñas seleccionadas. Agrega una para resaltar lo que dicen los clientes.",



      productExperienceReviewAdd: "Agregar reseña",



      productExperienceReviewAuthor: "Nombre a mostrar",



      productExperienceReviewAvatar: "URL del avatar",



      productExperienceReviewAvatarHint: "Usa la URL de una imagen alojada (JPG o PNG). Déjalo vacío para mostrar iniciales.",



      productExperienceReviewLocale: "Idioma",



      productExperienceReviewRating: "Calificación en estrellas",



      productExperienceReviewTimeAgo: "Referencia de tiempo",



      productExperienceReviewTimeAgoPlaceholder: "Hace 2 días",



      productExperienceReviewTimeAgoHint: "Etiqueta opcional como \"Hace 2 días\" o \"Verificada la semana pasada\".",



      productExperienceReviewSource: "Tipo de autor",



      productExperienceReviewSourceAdmin: "Gestionada por admin",



      productExperienceReviewSourceMember: "Miembro autenticado",



      productExperienceReviewRemove: "Eliminar reseña",



      productExperienceReviewComment: "Contenido de la reseña",



      planManagement: "Gestión de Planes",



      planManagementDesc: "Configura los planes de suscripción y sus precios.",



      editPlan: "Editar Plan",



      editPlanDesc: "Modificar los detalles del plan de suscripción",



      backToPays: "Volver a Pagos",



      planTitle: "Título del Plan",



      planPrice: "Precio (por mes)",



      planDescription: "Descripción Corta",



      planFeatures: "Características (una por línea)",



      planFeaturesPlaceholder: "Característica 1\nCaracterística 2\nCaracterística 3",

      planForm: {
        basicInfo: "Información básica",
        slug: "Slug",
        slugRequired: "*",
        slugPlaceholder: "plan-basico",
        slugHelp: "Identificador único para URLs (sin espacios)",
        price: "Precio",
        priceRequired: "*",
        pricePlaceholder: "9.99",
        priceHelp: "Precio mensual del plan",
        multilingualContent: "Contenido multiidioma",
        planName: "Nombre del Plan",
        planNameRequired: "*",
        planNamePlaceholder: "Plan Básico",
        description: "Descripción",
        descriptionRequired: "*",
        descriptionPlaceholder: "Descripción del plan de suscripción",
        features: "Características",
        featuresRequired: "*",
        featurePlaceholder: "Característica",
        addFeature: "+ Agregar Característica",
        planStatus: "Estado del plan",
        planStatusHelp: "Los planes activos se muestran en la página de suscripciones",
        active: "✓ Activo",
        inactive: "○ Inactivo",
        cancel: "Cancelar",
        save: "Guardar",
        update: "Actualizar plan",
        create: "Crear plan",
        saving: "Guardando...",
        backToPlans: "Volver a planes",
        loading: "Cargando plan...",
        notFound: "Plan no encontrado",
        error: "Error",
        toast: {
          incompleteData: "Datos incompletos",
          planUpdated: "Plan actualizado",
          planUpdatedDescription: "El plan se ha actualizado correctamente.",
          planCreated: "Plan creado",
          planCreatedDescription: "El plan se ha creado correctamente.",
          error: "Error",
          errorSaving: "Hubo un error al guardar el plan.",
        },
      },

      paymentGateways: {

        heading: "Integraciones de pago",



        description: "Activa proveedores de pagos y cobros y administra sus credenciales.",



        statusLabel: "Estado",



        active: "Activo",



        inactive: "Inactivo",



        save: "Guardar cambios",



        fieldRequired: "Completa los campos obligatorios antes de guardar.",



        secretRequired: "Debes ingresar la clave secreta para activar la pasarela.",



        publishableKeyRequired: "La clave pública es obligatoria para activar Stripe.",



        successTitle: "Ajustes de pago actualizados",



        errorTitle: "Error en ajustes de pago",



        genericErrorMessage: "No pudimos cargar la configuración de pagos.",



        retry: "Reintentar",



        paypal: {

          title: "PayPal",



          description: "Permite que tus usuarios paguen con PayPal en cualquier compra.",



          clientIdLabel: "Client ID de PayPal",



          clientIdPlaceholder: "client-id",



          secretLabel: "Clave secreta de PayPal",



          secretPlaceholder: "••••••••••",
          secretPreviewLabel: "Clave almacenada",
          modeBadgeProduction: "Modo producción",
          modeBadgeTest: "Modo sandbox",
          modeHelper: "Guarda la pestaña correspondiente para usar credenciales reales o de prueba en toda la app.",



          secretStatusSet: "Hay una clave guardada. Ingresa otra para rotarla.",



          secretStatusUnset: "Aún no hay clave guardada. Agrega una para activar los pagos.",



          secretHint: "Deja vacío para mantener la clave actual. Escribe una nueva para reemplazarla.",



          successDescription: "Credenciales de PayPal guardadas correctamente.",



          webhookHint: "",



        },



        stripe: {

          title: "Stripe",



          description: "Acepta tarjetas de débito y crédito con Stripe.",



          publishableKeyLabel: "Clave pública de Stripe",



          publishableKeyPlaceholder: "pk_live_***",



          secretLabel: "Clave secreta de Stripe",



          secretPlaceholder: "sk_live_***",
          secretPreviewLabel: "Clave almacenada",
          modeBadgeProduction: "Modo producción",
          modeBadgeTest: "Modo sandbox",
          modeHelper: "La pestaña guardada define si el checkout usa credenciales reales o de prueba.",



          webhookSecretLabel: "Secreto del webhook",



          webhookSecretPlaceholder: "whsec_***",
          webhookSecretPreviewLabel: "Secreto de webhook almacenado",



          secretStatusSet: "Hay una clave guardada. Ingresa otra para rotarla.",



          secretStatusUnset: "Aún no hay clave guardada. Agrega una para activar Stripe.",



          webhookStatusSet: "Secreto de webhook configurado.",



          webhookStatusUnset: "Aún no se configuró el webhook.",



          secretHint: "Deja vacío para mantener la clave almacenada.",



          webhookHint: "Opcional pero recomendado para validar eventos.",



          successDescription: "Credenciales de Stripe guardadas correctamente.",



        },

        authorize_net: {
          title: "Authorize.net",
          description: "Acepta pagos con tarjeta de crédito a través de Authorize.net.",
          apiLoginIdLabel: "ID de inicio de sesión API",
          apiLoginIdPlaceholder: "ID de inicio de sesión API",
          transactionKeyLabel: "Clave de transacción",
          transactionKeyPlaceholder: "••••••••••",
          transactionKeyPreviewLabel: "Clave de transacción almacenada",
          modeBadgeProduction: "Modo producción",
          modeBadgeTest: "Modo sandbox",
          modeHelper: "Usa la pestaña correspondiente para decidir qué credenciales se usan en el checkout.",
          secretStatusSet: "Hay una clave de transacción guardada. Ingresa otra para rotarla.",
          secretStatusUnset: "Aún no hay clave de transacción guardada. Agrega una para activar los pagos.",
          secretHint: "Deja vacío para mantener la clave actual. Escribe una nueva para reemplazarla.",
          successDescription: "Credenciales de Authorize.net guardadas correctamente.",
        },

        payoneer: {
          title: "Payoneer",
          description: "Envía pagos globales a través de Payoneer.",
          apiUsernameLabel: "Usuario API",
          apiUsernamePlaceholder: "Usuario API",
          apiPasswordLabel: "Contraseña API",
          apiPasswordPlaceholder: "••••••••••",
          apiPasswordPreviewLabel: "Contraseña API almacenada",
          partnerIdLabel: "ID de socio",
          partnerIdPlaceholder: "ID de socio",
          modeBadgeProduction: "Modo producción",
          modeBadgeTest: "Modo sandbox",
          modeHelper: "Usa la pestaña correspondiente para decidir qué credenciales se usan para los pagos.",
          secretStatusSet: "Las credenciales API están guardadas. Ingresa nuevas para rotarlas.",
          secretStatusUnset: "Aún no hay credenciales API guardadas. Agrégalas para activar los pagos.",
          secretHint: "Deja vacío para mantener las credenciales actuales. Escribe nuevas para reemplazarlas.",
          successDescription: "Credenciales de Payoneer guardadas correctamente.",
        },



      },



      subscriptionTestInfo: {
        heading: "Información de tarjetas de prueba",
        description: "Utiliza estas tarjetas de prueba de Stripe para simular pagos de suscripción mientras la integración está en modo de prueba.",
        note: "Recuerda mantener tu panel de Stripe en modo de prueba y no compartas estos datos con clientes reales.",
        paypalInstructions: [
          "Inicia sesión con tu cuenta business de PayPal sandbox para iniciar cobros de prueba.",
          "Usa cuentas de comprador sandbox para aprobar transacciones sin dinero real.",
          "Revisa los eventos de pago en el panel de desarrolladores de PayPal después de cada prueba.",
          "Recuerda volver a las credenciales en vivo antes del lanzamiento.",
        ],
        cards: [
          {
            id: "stripe-success",
            title: "Pago exitoso",
            description: "Escenario estándar de aprobación para validar el flujo de extremo a extremo.",
            numberLabel: "Número de tarjeta",
            number: "4242 4242 4242 4242",
            expiryLabel: "Vencimiento",
            expiry: "Cualquier fecha futura",
            cvcLabel: "CVC",
            cvc: "Cualquier 3 dígitos",
          },
          {
            id: "stripe-auth",
            title: "Requiere autenticación",
            description: "Valida el manejo de la Autenticación Reforzada de Cliente durante el checkout.",
            numberLabel: "Número de tarjeta",
            number: "4000 0027 6000 3184",
            expiryLabel: "Vencimiento",
            expiry: "Cualquier fecha futura",
            cvcLabel: "CVC",
            cvc: "Cualquier 3 dígitos",
            extra: [
              {
                label: "3D Secure",
                value: "Flujo con desafío",
              },
            ],
          },
          {
            id: "stripe-decline",
            title: "Tarjeta rechazada",
            description: "Simula fondos insuficientes para probar los mensajes de error.",
            numberLabel: "Número de tarjeta",
            number: "4000 0000 0000 9995",
            expiryLabel: "Vencimiento",
            expiry: "Cualquier fecha futura",
            cvcLabel: "CVC",
            cvc: "Cualquier 3 dígitos",
          },
        ],
      },



    },



    classesPage: {



      title: "Biblioteca de Clases",



      subtitle: "Lecciones en video exclusivas para miembros con pago activo.",



      lockedTitle: "Activa tu suscripción para ver las clases",



      lockedDescription: "Necesitas tener tu pago activo para acceder a la biblioteca de clases.",



      lockedCta: "Ver planes",



      watchOnYoutube: "Ver en YouTube",



      emptyStateTitle: "Aún no hay clases",



      emptyStateDescription: "Vuelve pronto para descubrir nuevas lecciones en video.",



      errorTitle: "No pudimos cargar las clases",



      errorDescription: "Ocurrió un problema al cargar los videos. Actualiza la página o inténtalo más tarde.",


    },

    contact: {
      title: "Contacto",
      subtitle: "Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos. Estamos aquí para asistirte en todo lo que necesites.",
      infoTitle: "Información de Contacto",
      email: "Email:",
      phone: "Teléfono:",
      hours: "Horario:",
      whyContactTitle: "¿Por qué contactarnos?",
      whyContactItems: [
        "- Soporte técnico y consultas",
        "- Información sobre productos y servicios",
        "- Sugerencias y feedback",
        "- Reporte de problemas",
      ],
      formTitle: "Envíanos un mensaje",
      formDescription: "Estamos aquí para ayudarte. Completa el formulario y nos pondremos en contacto contigo lo antes posible.",
      nameLabel: "Nombre *",
      namePlaceholder: "Tu nombre completo",
      emailLabel: "Correo electrónico *",
      emailPlaceholder: "tu@email.com",
      messageLabel: "¿Cómo podemos ayudarte? *",
      messagePlaceholder: "Describe tu consulta o mensaje...",
      sendButton: "Enviar mensaje",
      sendingLabel: "Enviando...",
      successMessage: "¡Gracias por contactarnos! Te responderemos pronto.",
      errorMessage: "No se pudo enviar el mensaje. Inténtalo nuevamente.",
      helperText: "Todos los campos marcados con * son obligatorios.",
    },

    subscriptions: {



      title: "Elige Tu Plan",



      subtitle: "Selecciona la suscripción que mejor se adapte a tus metas.",



      mostPopular: "Más Popular",



      selectPlan: "Seleccionar Plan",



      priceSuffix: "/ mes",



      basic: {



        title: "Básico",



        description: "Para quienes están empezando.",



        feature1: "Acceso al catálogo de productos",



        feature2: "Herramientas de red básicas",



        feature3: "Comisiones estándar"



      },



      pro: {



        title: "Pro",



        description: "Para constructores serios.",



        feature1: "Todas las funciones de Básico",



        feature2: "Análisis de red avanzado",



        feature3: "Comisiones mejoradas",



        feature4: "Soporte prioritario"



      },



      diamond: {



        title: "Diamante",



        description: "Para líderes de élite.",



        feature1: "Todas las funciones de Pro",



        feature2: "Eventos de formación exclusivos",



        feature3: "Las tasas de comisión más altas",



        feature4: "Gestor de cuenta dedicado"



      }



    },



    profile: {



      title: "Mi Cuenta",



      overview: "Resumen",



      orders: "Pedidos",



      messagesTab: "Mensajes",



      paymentMethodsTab: "Métodos de Pago",



      settings: "Configuración",



      personalInformation: "Información Personal",



      name: "Nombre",



      email: "Correo Electrónico",



      phone: "Teléfono",



      fulfillmentCompany: "Empresa responsable",



      address: "Dirección",



      cityLabel: "Ciudad",



      stateLabel: "Estado",



      postalCodeLabel: "Código Postal",



      countryLabel: "País",



      updateInformation: "Actualizar Información",



      membershipDetails: "Detalles de Membresía",



      membershipLevel: "Nivel de Membresía",



      joinDate: "Fecha de Ingreso",



      sponsorId: "ID del Patrocinador",



      sponsorEmail: "Correo del Patrocinador",



      membershipPhaseLabel: "Fase {{value}}",



      referralCode: "Código de Referido",



      subscriptionStatus: "Estado de suscripción",



      waitlisted: "Lista de espera",



      affiliateLink: "Enlace afiliado",

      balanceRecharge: {
        triggerLabel: "Recargar saldo",
        title: "Recarga tu saldo",
        description: "Elige un proveedor de pago y el monto para añadir fondos a tu cuenta.",
        providerLabel: "Método de pago",
        loadingProviders: "Cargando proveedores…",
        noProviders: "No hay proveedores de pago disponibles en este momento.",
        providerError: "No pudimos cargar los proveedores de pago. Intenta nuevamente en unos instantes.",
        amountLabel: "Monto",
        amountPlaceholder: "0.00",
        amountHelper: "Recarga mínima {{amount}}.",
        testModeNote:
          "Los pagos usan credenciales de sandbox. Tu saldo se actualizará automáticamente para que puedas validar el flujo.",
        liveModeNote:
          "Completa el pago con el proveedor seleccionado. Tu saldo se actualizará automáticamente cuando se confirme el pago.",
        cancelLabel: "Cancelar",
        submitLabel: "Continuar al pago",
        submittingLabel: "Redirigiendo…",
        paymentDescription: "Recarga de saldo de monedero",
        modeBadge: {
          test: "Modo prueba",
          live: "Modo en vivo",
        },
        errors: {
          invalidAmountTitle: "Monto inválido",
          invalidAmountDescription: "Ingresa al menos {{amount}} para recargar tu saldo.",
          noProviderTitle: "Selecciona un método de pago",
          noProviderDescription: "Elige PayPal o Stripe para continuar.",
          sessionTitle: "Sesión expirada",
          sessionDescription: "Inicia sesión nuevamente para recargar tu saldo.",
          submissionTitle: "La recarga falló",
          submissionDescription: "No pudimos iniciar tu recarga. Inténtalo de nuevo en unos momentos.",
        },
        successToast: {
          title: "Pago recibido",
          description: "Recibimos tu pago de {{provider}} por {{amount}}. Tu saldo se actualizará en breve.",
        },
        cancelToast: {
          title: "Recarga cancelada",
          description: "No se realizó ningún cargo. Puedes intentarlo nuevamente cuando quieras.",
        },
        errorToast: {
          title: "La recarga falló",
          description: "No pudimos confirmar tu pago. Inténtalo de nuevo o contacta soporte.",
        },
      },
      networkEarnings: {
        title: "Balance de ganancias",
        description: "Sigue cuánto ha generado tu equipo y pásalo a tu saldo personal.",
        availableLabel: "Disponible para transferir",
        breakdownTitle: "Contribuciones del equipo",
        configure: "Configurar pagos",
        empty: "Aún no tienes ganancias de tu equipo. Comparte tu enlace para comenzar a generar comisiones.",
        unknownMember: "Miembro del equipo",
      },



      messages: {



        title: "Mensajes del equipo",



        description: "Mantén comunicación con tu organización mediante conversaciones privadas.",



        loading: "Cargando tus mensajes…",



        retry: "Reintentar",



        errorTitle: "Buzón no disponible",



        errorDescription: "No pudimos cargar tus mensajes. Actualiza o inténtalo más tarde.",



        emptyTitle: "Aún no tienes mensajes",



        emptyDescription: "Cuando alguien de tu equipo te escriba, la conversación aparecerá aquí.",



        threadListLabel: "Conversaciones",



        conversationLabel: "Conversación",



        noSelectionTitle: "Selecciona una conversación",



        noSelectionDescription: "Elige a un socio para ver el historial completo.",



        reply: {



          label: "Responder conversación",



          placeholder: "Escribe tu respuesta…",



          send: "Enviar respuesta",



          sending: "Enviando…",



          successTitle: "Respuesta enviada",



          successDescription: "Tu socio recibirá tu respuesta inmediatamente.",



          errorTitle: "No pudimos enviar la respuesta",



          errorDescription: "Inténtalo nuevamente en unos minutos.",



        },

        delete: {
          button: "Eliminar",
          confirmTitle: "¿Eliminar mensaje?",
          confirmDescription: "Esta acción no se puede deshacer. El mensaje será eliminado permanentemente.",
          confirm: "Eliminar mensaje",
          cancel: "Cancelar",
          successTitle: "Mensaje eliminado",
          successDescription: "El mensaje ha sido eliminado de la conversación.",
          errorTitle: "No se pudo eliminar el mensaje",
          errorDescription: "No pudimos eliminar tu mensaje. Inténtalo nuevamente en unos minutos.",
        },

        deleteThread: {
          button: "Eliminar conversación",
          confirmTitle: "¿Eliminar conversación?",
          confirmDescription: "Esto eliminará todos tus mensajes en esta conversación. Esta acción no se puede deshacer.",
          confirm: "Eliminar conversación",
          cancel: "Cancelar",
          successTitle: "Conversación eliminada",
          successDescription: "Tus mensajes han sido eliminados de esta conversación.",
          errorTitle: "No se pudo eliminar la conversación",
          errorDescription: "No pudimos eliminar la conversación. Inténtalo nuevamente en unos minutos.",
        },

        filter: {
          label: "Filtrar",
          all: "Todos los mensajes",
          unread: "Solo no leídos",
          read: "Solo leídos",
        },

        helper: "Los mensajes se entregan al instante y sólo son visibles para ti y tu socio.",



        refresh: "Actualizar",



        tabUnreadA11y: "Tienes {{count}} mensajes sin leer",



        meta: {



          you: "Tú",



          sentOn: "Enviado el {{date}}",



          receivedOn: "Recibido el {{date}}",



        },



      },



      referralSettings: {



        title: "Enlace afiliado",



        description: "Personaliza el código de referido que compartes con tus prospectos.",



        codeLabel: "Código de referido",



        placeholder: "tu-equipo",



        helper: "Usa de 4 a 32 caracteres en minúsculas con letras, números o guiones.",



        save: "Guardar código",



        saving: "Guardando...",



        success: "Tu código de referido se actualizó.",



        reset: "Usar código generado",



        linkLabel: "Enlace para compartir",



        copy: "Copiar enlace",



        copied: "¡Copiado!",



        copyErrorTitle: "No se pudo copiar el enlace",



        copyErrorDescription: "Intenta de nuevo o copia el enlace manualmente.",



        errors: {



          pattern: "Solo usa letras, números o guiones.",



          minLength: "El código de referido debe tener al menos 4 caracteres.",



          maxLength: "El código de referido debe tener máximo 32 caracteres.",
          generic: "No pudimos actualizar tu código de referido. Intenta nuevamente.",
        },



        availability: {



          checking: "Verificando disponibilidad...",



          available: "Este código de referido está disponible.",



          current: "Este es tu código de referido actual.",



          unavailable: "Este código de referido ya está en uso.",



          invalid: "Ingresa un código válido para comprobar disponibilidad.",



          error: "No pudimos verificar el código en este momento. Intenta nuevamente en unos segundos.",



        },



      },

      phaseRewards: {
        title: "Recompensas Mensuales",
        description: "Tus recompensas por mantener tu fase MLM este mes",
        noRewards: "No hay recompensas activas este mes",
        noRewardsDescription: "Mantén tu fase MLM para desbloquear recompensas mensuales",
        phase: "Fase",
        freeProduct: {
          description: "Elige un producto de hasta $65 de valor",
          value: "Valor",
          used: "Ya usado",
          shopNow: "Comprar Ahora",
        },
        storeCredit: {
          description: "Se aplica automáticamente a tus compras",
          remaining: "Restante",
          used: "Usado",
          total: "Total",
          shopNow: "Comprar Ahora",
          expiresOn: "Expira el",
          transferToEarnings: "Transferir a Ganancias",
          transferSuccess: "Recompensas transferidas exitosamente",
          transferError: "Error al transferir recompensas. Por favor intenta de nuevo.",
        },
      },

      viewTeamPerformance: "Ver Rendimiento del Equipo",



      accountSecurity: "Seguridad de la Cuenta",



      changePassword: "Cambiar Contraseña",



      logout: "Cerrar Sesión",



      shop: "Tienda",



      opportunity: "Oportunidad",



      community: "Comunidad",



      resources: "Recursos",



      cart: "Carrito",



      orderHistory: {



        title: "Historial de Pedidos",



        description: "Ve y gestiona tus pedidos anteriores.",



        searchPlaceholder: "Buscar pedidos...",



        table: {



          date: "Fecha",



          amount: "Monto",



          productSubscription: "Producto/Suscripción",



          status: "Estado",



          tracking: "Seguimiento",



          invoice: "Factura",



        },










        viewInvoice: "Ver factura",



        loadingInvoice: "Cargando factura...",



        invoiceViewerHint: "Usa las opciones de tu navegador para imprimir o guardar esta factura.",



        invoiceErrorTitle: "No pudimos abrir la factura",



        invoiceErrorDescription: "No fue posible cargar tu factura. Intenta nuevamente.",



        tracking: {
          empty: "Aún no hay seguimiento disponible.",
          updated: "Actualizado {{value}}",
          company: "Empresa responsable",
          code: "Código de seguimiento",
          location: "Ubicación actual",
          eta: "Entrega estimada",
        },

        statuses: {



          paid: "Completado",



          pending: "Pendiente",



          packed: "Empacado",



          in_transit: "En tránsito",



          delivered: "Entregado",



          delayed: "Retrasado",



          canceled: "Cancelado",



        },



        empty: "Aún no tienes pedidos.",



        subscriptionFallback: "Pago de suscripción",



      },



      paymentMethods: {



        title: "Métodos de Pago",



        creditDebitCards: "Tarjetas de Crédito/Débito",



        addNewCard: "Agregar Nueva Tarjeta",



        paypal: "PayPal",



        paypalAccount: "Cuenta PayPal",



        notLinked: "No vinculado",



        linkPaypalAccount: "Vincular Cuenta PayPal",



        defaultMethod: "Método predeterminado",



        subscriptionGateway: "Pasarela de suscripción",



        recentPayments: "Pagos recientes",



        empty: "Aún no registras pagos.",



        table: {



          date: "Fecha",



          amount: "Monto",



          status: "Estado",



          method: "Método",



        },



        statuses: {



          paid: "Pagado",



          failed: "Fallido",



          refunded: "Reembolsado",



        },



        gateways: {



          stripe: "Stripe",



          paypal: "PayPal",



        },



      },

      planForm: {
        basicInfo: "Información Básica",
        slug: "Slug",
        slugRequired: "*",
        slugPlaceholder: "plan-basico",
        slugHelp: "Identificador único para el plan (minúsculas, sin espacios)",
        price: "Precio",
        priceRequired: "*",
        pricePlaceholder: "9.99",
        priceHelp: "Precio de suscripción mensual en USD",
        multilingualContent: "Contenido Multilingüe",
        planName: "Nombre del Plan",
        planNameRequired: "*",
        description: "Descripción",
        descriptionRequired: "*",
        features: "Características",
        featurePlaceholder: "Característica",
        addFeature: "+ Agregar Característica",
        planStatus: "Estado del Plan",
        planStatusHelp: "Los planes activos se muestran en la página de suscripciones",
        active: "✓ Activo",
        inactive: "○ Inactivo",
        cancel: "Cancelar",
        saving: "Guardando...",
        update: "Actualizar Plan",
        create: "Crear Plan",
        toast: {
          incompleteData: "Datos Incompletos",
          planUpdated: "Plan Actualizado",
          planUpdatedDescription: "El plan ha sido actualizado exitosamente.",
          planCreated: "Plan Creado",
          planCreatedDescription: "El plan ha sido creado exitosamente.",
          error: "Error",
          errorSaving: "Hubo un error al guardar el plan.",
        },
        validation: {
          slug: "Ingresa un slug válido para el plan.",
          nameEn: "Ingresa el nombre del plan en inglés.",
          nameEs: "Ingresa el nombre del plan en español.",
          descriptionEn: "Ingresa la descripción del plan en inglés.",
          descriptionEs: "Ingresa la descripción del plan en español.",
          featuresEn: "Agrega al menos una característica en inglés.",
          featuresEs: "Agrega al menos una característica en español.",
          price: "Ingresa un precio válido para el plan.",
          default: "Por favor revisa los campos requeridos.",
        },
      },

      videoEdit: {
        title: "Editar Video",
        cardTitle: "Editar Video de Clase",
        loading: "Cargando video...",
        fields: {
          title: "Título",
          titleRequired: "Título *",
          titlePlaceholder: "Ingresa el título del video",
          description: "Descripción",
          descriptionPlaceholder: "Ingresa una descripción opcional",
          category: "Categoría",
          categoryPlaceholder: "Ej: Fitness, Nutrición, Bienestar",
          categoryHelper: "Categoría opcional para organizar videos",
          visibility: "Visibilidad",
          visibilityRequired: "Visibilidad *",
          visibilityPlaceholder: "Selecciona quién puede ver el video",
          visibilityHelper: "Define quién puede acceder a este video",
          youtubeId: "ID de YouTube",
          youtubeIdRequired: "ID de YouTube *",
          youtubeIdPlaceholder: "Ej: dQw4w9WgXcQ",
          youtubeIdHelper: "Ingresa solo el ID del video de YouTube (la parte después de 'v=' en la URL)",
          order: "Orden",
          orderPlaceholder: "0",
          orderHelper: "Número que determina el orden de visualización (número menor = aparece primero)",
          published: "Publicado",
        },
        visibility: {
          all: "Todos los usuarios autenticados",
          subscription: "Solo usuarios con suscripción activa",
          product: "Solo usuarios que compraron un producto específico",
        },
        actions: {
          save: "Actualizar Video",
          saving: "Actualizando...",
          cancel: "Cancelar",
        },
        toast: {
          notFound: {
            title: "Video no encontrado",
            description: "El video que intentas editar no existe.",
          },
          loadError: {
            title: "Error",
            description: "No se pudo cargar el video.",
          },
          validationError: {
            title: "Error",
            description: "El título y el ID de YouTube son obligatorios.",
          },
          updateSuccess: {
            title: "Video actualizado",
            description: "El video ha sido actualizado exitosamente.",
          },
          updateError: {
            title: "Error",
            description: "No se pudo actualizar el video.",
          },
        },
      }
    },
    profileEarningsSettings: {
      backToProfile: 'Volver al perfil',
      title: 'Configuración de pagos',
      description: 'Conecta Stripe o PayPal para enviar tus ganancias directamente a tu cuenta preferida.',
      loadError: 'No pudimos cargar tu información de pagos. Actualiza la página o inténtalo más tarde.',
      sessionError: 'Tu sesión expiró. Inicia sesión nuevamente para continuar.',
      balanceTitle: 'Resumen de ganancias',
      balanceDescription: 'Revisa cuánto está listo para transferir y cuánto ya tienes en tu monedero.',
      availableLabel: 'Ganancias disponibles',
      walletLabel: 'Saldo personal',
      providers: {
        stripe: {
          displayName: 'Stripe',
        },
        paypal: {
          displayName: 'PayPal',
        },
        authorize_net: {
          displayName: 'Authorize.Net',
        },
        payoneer: {
          displayName: 'Payoneer',
        },
      },
      autoPayout: {
        title: 'Pago automático',
        availableLabel: 'Disponible para cobrar',
        thresholdLabel: 'Umbral configurado',
        minimumLabel: 'Mínimo permitido',
        thresholdInputLabel: 'Elige tu umbral de pago automático',
        thresholdHelper:
          'Procesaremos un pago en cuanto alcances {{threshold}}. El mínimo permitido es {{minimum}}.',
        thresholdSave: 'Guardar umbral',
        thresholdSaving: 'Guardando…',
        thresholdSuccessTitle: 'Umbral actualizado',
        thresholdSuccessDescription:
          'Procesaremos pagos automáticos cuando alcances {{threshold}}.',
        thresholdErrorTitle: 'No pudimos actualizar el umbral',
        thresholdError:
          'No pudimos guardar tu umbral de pago automático. Inténtalo de nuevo en unos minutos.',
        thresholdInvalid: 'Ingresa un monto válido para tu umbral de pago automático.',
        thresholdBelowMinimum: 'El umbral debe ser al menos {{minimum}}.',
        thresholdUnchangedTitle: 'Umbral sin cambios',
        thresholdUnchangedDescription: 'Ese ya es tu umbral activo para pagos automáticos.',
        eligibleMessage:
          'Tienes saldo suficiente para generar un pago automático. El dinero llegará a tu cuenta de {{provider}} en aproximadamente dos días hábiles.',
        actionCta: 'Cobrar ahora',
        processing: 'Procesando pago…',
        notEligibleMessage:
          'Necesitas al menos {{threshold}} disponibles para generar un pago. Actualmente tienes {{current}}. El mínimo permitido es {{floor}}.',
        providerNotice:
          'Los pagos se procesan con las credenciales configuradas por el administrador en {{provider}}.',
        processedTitle: 'Pago procesado',
        processedDescription:
          'Enviamos {{amount}} a tu cuenta de {{provider}}. Debería acreditarse en aproximadamente dos días hábiles.',
        notProcessedTitle: 'Pago no procesado',
        notProcessedDescription:
          'No pudimos procesar el pago automático. Verifica que tengas al menos {{threshold}} disponibles en {{provider}}.',
        errorTitle: 'Error al procesar pago',
        errorDescription: 'No pudimos procesar el pago automático. Inténtalo nuevamente en unos minutos.',
      },
      paymentCadence: {
        title: 'Configuración de pagos',
        description:
          'Esta configuración es establecida por el administrador y determina cómo y cuándo se procesarán tus pagos.',
        loading: 'Cargando configuración...',
        noConfig: 'No hay configuración de pago disponible.',
        modeLabel: 'Modo de pago',
        modeAutomatic: 'Automático',
        modeManual: 'Manual',
        modeAutomaticDescription: 'Los pagos se procesarán automáticamente según la frecuencia configurada.',
        modeManualDescription: 'Todos los pagos requieren aprobación manual del administrador antes de ser procesados.',
        frequencyLabel: 'Frecuencia',
        frequencyWeekly: 'Semanal',
        frequencyBiweekly: 'Quincenal',
        frequencyMonthly: 'Mensual',
        dayOfMonthLabel: 'Día del mes',
        weekdayLabel: 'Día de la semana',
        defaultAmountLabel: 'Monto por defecto',
        remindersLabel: 'Recordatorios',
        daysBefore: 'días antes',
        noReminders: 'Sin recordatorios',
        manualModeNotice: 'Modo manual activo:',
        manualModeNoticeDescription:
          'El administrador debe aprobar manualmente cada pago. Los pagos automáticos están deshabilitados mientras este modo esté activo.',
      },
    },
    affiliate: {
      welcomeTitle: "Bienvenido a la Tienda de {{name}}",
      welcomeSubtitle: "Descubre productos increíbles y únete a nuestra comunidad",
      joinNow: "Únete Ahora",
      viewProducts: "Ver Productos",
      referralCode: "Código de Referido",
      productsTitle: "Productos Destacados",
      productsSubtitle: "Explora nuestra selección de productos de calidad",
      showMore: "Ver Más Productos",
      noProducts: "No hay productos disponibles",
      noProductsDescription: "Vuelve pronto para ver nuevos productos",
      joinCtaTitle: "¿Listo para Comenzar?",
      joinCtaDescription: "Únete a nuestra comunidad y comienza a disfrutar de beneficios exclusivos",
      step1Title: "Regístrate",
      step1Description: "Crea tu cuenta gratuita",
      step2Title: "Compra",
      step2Description: "Explora y compra productos",
      step3Title: "Crece",
      step3Description: "Construye tu red",
      registerButton: "Registrarse Ahora",
      alreadyMember: "¿Ya eres miembro?",
      signIn: "Iniciar sesión",
      registerToPurchase: "Regístrate para Comprar",
      registerToPurchaseDescription: "Crea una cuenta a través de esta página de afiliado para comprar productos y ganar recompensas.",
      notRegisteredThroughAffiliate: "No Registrado a Través de Este Afiliado",
      notRegisteredThroughAffiliateDescription: "Para comprar en esta tienda, necesitas registrarte a través de esta página de afiliado.",
      notFound: {
        title: "Tienda No Disponible",
        description: "Esta tienda de afiliado no está disponible. El enlace puede ser inválido o la tienda ha sido deshabilitada.",
        reasons: "Posibles razones:",
        reason1: "El código de referido es inválido o ha expirado",
        reason2: "La tienda ha sido deshabilitada temporalmente",
        reason3: "El enlace de afiliado es incorrecto",
        goHome: "Ir al Inicio",
        register: "Crear Cuenta",
        shopOfficial: "Comprar en Tienda Oficial",
      },
    },
    errorBoundary: {
      title: "Algo salió mal",
      message: "Ha ocurrido un error inesperado. Por favor, recarga la página.",
      description: "Ha ocurrido un error inesperado. Por favor, recarga la página.",
      action: "Recargar página",
      retry: "Reintentar",
      goHome: "Ir al inicio",
    },
    shopOfficial: "Tienda Oficial",
    adminErrorBoundary: {
      title: "Algo salió mal",
      message: "Estamos trabajando para solucionarlo. Intenta actualizar la vista.",
      action: "Reintentar",
    },
    adminConfigStatus: {
      title: "Estado de Configuración",
      description: "Verifica el estado de los servicios configurados",
      stripe: "Stripe",
      paypal: "PayPal",
      supabase: "Supabase",
      email: "Email (Resend)",
      configured: "Configurado",
      notConfigured: "No configurado",
      checking: "Verificando...",
      testMode: "Modo Test",
      productionMode: "Modo Producción",
      inactive: "Inactivo",
    },
    adminDashboardSkeleton: {
      loading: "Preparando tu panel...",
    },
    adminDashboardErrorState: {
      title: "No pudimos cargar el panel",
      description: "Revisa tu conexión a internet y vuelve a intentar.",
      action: "Volver a intentar",
    },
    incomeCalculator: {
      title: "Calculadora de Ingresos",
      subtitle: "Calcula tus ingresos potenciales tanto de la red multinivel como del sistema de afiliados",
      tabs: {
        multilevel: "Red Multinivel",
        affiliate: "Sistema de Afiliados"
      },
      multilevel: {
        title: "Calculadora de Red Multinivel",
        subtitle: "Calcula tus ingresos basados en tu fase y tu red de distribuidores",
        initialConfig: "Configuración Inicial",
        phaseLabel: "1. Selecciona tu Fase Actual",
        phasePlaceholder: "Selecciona tu fase actual",
        noPhases: "No hay fases configuradas",
        phaseOption: "Fase {{level}}: {{name}} - {{commission}}% comisión",
        phaseHelp: "Tu fase determina tu % de comisión en todas las ventas",
        personalSalesLabel: "2. Tus Ventas Personales Mensuales",
        personalSalesHelp: "¿Cuánto vendes tú directamente cada mes?",
        phase0AlertTitle: "ℹ️ Fase 0 - Solo Ventas Personales",
        phase0AlertBody: "En Fase 0 (Registro) solo puedes ganar comisiones por tus ventas personales. Avanza a Fase 1 o superior para desbloquear la red multinivel y ganar de tu equipo.",
        level1Label: "3. ¿Cuántas personas invitaste directamente? (Nivel 1)",
        level1Placeholder: "Ej: 4",
        level1Help: "Ingresa cuántas personas invitaste tú. Los demás niveles se calcularán automáticamente (cada persona invita a 2 más).",
        avgSalesLabel: "4. Venta Promedio por Persona en tu Red (Opcional)",
        avgSalesPlaceholder: "Ej: 100.00",
        avgSalesHelp: "Si ingresas este valor, calcularemos también las comisiones por las ventas de tu equipo",
        benefitsLabel: "5. Incluir Beneficios Adicionales en el Cálculo",
        includeRewardCredits: "Incluir Créditos de Recompensa",
        includeFreeProduct: "Incluir Valor de Producto Gratis",
        benefitsHelp: "Estos beneficios se otorgan mensualmente a cada miembro según su fase. Actívalos para ver el valor total que genera tu red.",
        networkStructure: "Tu Red de Distribuidores",
        calculatedStructure: "📊 Estructura Calculada de tu Red en Fase {{phase}}",
        autoDuplication: "Duplicación Automática (cada persona invita a 2):",
        levelItem: "Nivel {{level}}",
        yourInput: "(Tu input)",
        calculated: "(Calculado: {{prev}} × 2)",
        directInvites: "Tus invitados directos",
        indirectInvites: "Invitados por Nivel {{level}}",
        people: "personas",
        person: "persona",
        totalNetwork: "Total en tu red:",
        calculationNote: "💡 Cálculo automático:",
        phaseLimitNote: "Tu Fase {{phase}} permite hasta {{maxPhase}} niveles, pero el sistema está configurado para mostrar hasta {{maxAdmin}} niveles.",
        phaseDepthNote: "En Fase {{phase}} ganas de {{actualMax}} niveles de profundidad. Avanza a fases superiores para desbloquear más niveles (hasta {{maxAdmin}} niveles).",
        inputPrompt: "👆 Ingresa cuántas personas invitaste directamente (Nivel 1) para ver la estructura completa de tu red calculada automáticamente.",
        calculateButton: "Calcular Ingresos",
        resetButton: "Reiniciar",
        estimatedIncome: "Ingreso Total Mensual Estimado",
        breakdown: "Desglose por Nivel",
        personalSalesBreakdown: "💼 Tus Ventas Directas",
        networkLevelBreakdown: "👥 Nivel {{level}} - {{name}}",
        networkCommissionBreakdown: "• Comisión por sus ventas: {{amount}}",
        rewardCreditsBreakdown: "• Créditos de Recompensa: {{amount}}",
        freeProductBreakdown: "• Valor de Producto Gratis: {{amount}}"
      },
      affiliate: {
        title: "Calculadora de Sistema de Afiliados",
        subtitle: "Calcula tus ganancias como afiliado y las de tu referidor",
        configTitle: "Configuración de Afiliado",
        salesLabel: "Ventas del Afiliado",
        salesHelp: "Ingresa el monto total de ventas generadas",
        affiliateCommissionLabel: "Comisión del Afiliado (%)",
        affiliateCommissionHelp: "Porcentaje que gana el afiliado por sus ventas",
        referrerCommissionLabel: "Comisión del Referidor (%)",
        referrerCommissionHelp: "Porcentaje que gana la persona que refirió al afiliado",
        infoAlertTitle: "💡 ¿Cómo funciona el sistema de afiliados?",
        infoAlertBody1: "• Como afiliado, ganas una comisión directa por cada venta que realices",
        infoAlertBody2: "• La persona que te refirió también gana una comisión menor por tus ventas",
        infoAlertBody3: "• Este sistema incentiva tanto tus ventas como la referencia de nuevos afiliados",
        calculateButton: "Calcular Ganancias de Afiliado",
        totalSystemEarnings: "Ganancia Total del Sistema",
        breakdownTitle: "Desglose de Ganancias",
        affiliateEarnings: "💰 Tus Ganancias como Afiliado",
        referrerEarnings: "👤 Ganancias de tu Referidor",
        summaryTitle: "📊 Resumen:",
        totalSales: "Ventas totales: {{amount}}",
        affiliateRate: "Comisión afiliado: {{rate}}%",
        referrerRate: "Comisión referidor: {{rate}}%",
      },
    },
  };

  return dictionary as DictionaryOverrides;
};