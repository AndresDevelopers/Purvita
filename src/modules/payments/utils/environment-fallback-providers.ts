import type {
  PaymentGatewayPublicInfo,
  PaymentProvider,
} from '../domain/models/payment-gateway';

/**
 * Las credenciales de pago deben configurarse desde el panel de administración
 * No se utilizan variables de entorno como fallback
 */
export const getEnvironmentFallbackProviders = (): PaymentGatewayPublicInfo[] => {
  return [];
};

export const getEnvironmentFallbackProviderIds = (): PaymentProvider[] => {
  return [];
};
