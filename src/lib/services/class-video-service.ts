import { ZodError as _ZodError } from 'zod';
import { createClassVideoModule } from '@/modules/classes/factories/class-video-module';
import { PaymentRepository } from '@/modules/multilevel/repositories/payment-repository';
import { supabase } from '@/lib/supabase';
import type { ClassVideo } from '@/lib/models/definitions';

const normaliseErrorMessage = (message: string) => {
  if (!message) {
    return 'Unknown error';
  }

  return message.replace('published class videos', 'class videos');
};

export const getPublishedClassVideos = async (): Promise<ClassVideo[]> => {
  console.log('🎥 getPublishedClassVideos: Iniciando...');

  const { repository } = createClassVideoModule();

  try {
    console.log('🎥 getPublishedClassVideos: Llamando repository.listPublished()...');
    const result = await repository.listPublished();
    console.log('🎥 getPublishedClassVideos: Resultado:', result);
    return result;
  } catch (error: any) {
    console.error('🎥 getPublishedClassVideos: Error completo:', error);

    if (error?.issues || error?.errors) {
      console.error('🎥 getPublishedClassVideos: Error de validación:', error.issues || error.errors);
      throw new Error('Invalid class video data received');
    }

    if (error?.message) {
      const message = normaliseErrorMessage(error.message);
      // Check for parsing errors which indicate invalid data
      if (message.includes('Failed to parse')) {
        throw new Error('Invalid class video data received');
      }
      if (message.toLowerCase().startsWith('error fetching')) {
        throw new Error(message);
      }
      throw new Error(`Error fetching class videos: ${message}`);
    }

    throw new Error('Error fetching class videos: Unknown error');
  }
};

export const getPublishedClassVideosForUser = async (userId: string): Promise<ClassVideo[]> => {
  console.log('🎥 getPublishedClassVideosForUser: Iniciando...', { userId });

  const { repository } = createClassVideoModule();

  try {
    let hasActiveSubscription = false;
    let hasPurchasedProducts = false;

    // Verificar suscripción activa (con manejo de error si la tabla no existe)
    try {
      const subscriptionRepo = new (await import('@/modules/multilevel/repositories/subscription-repository')).SubscriptionRepository(supabase);
      const subscription = await subscriptionRepo.findByUserId(userId);
      hasActiveSubscription = subscription?.status === 'active';
    } catch (subError: any) {
      console.warn('🎥 getPublishedClassVideosForUser: No se pudo verificar suscripción:', subError?.message || subError);
      // Si la tabla no existe, asumimos que no hay suscripción
      hasActiveSubscription = false;
    }

    // Verificar compras de productos (con manejo de error si la tabla no existe)
    try {
      const paymentRepo = new PaymentRepository(supabase);
      const payments = await paymentRepo.listRecentByUser(userId, 100);
      hasPurchasedProducts = payments.some(payment => payment.kind !== 'subscription' && payment.status === 'paid');
    } catch (payError: any) {
      console.warn('🎥 getPublishedClassVideosForUser: No se pudo verificar pagos:', payError?.message || payError);
      // Si la tabla no existe, asumimos que no hay compras
      hasPurchasedProducts = false;
    }

    console.log('🎥 getPublishedClassVideosForUser: Estado del usuario:', { hasActiveSubscription, hasPurchasedProducts });

    const result = await repository.listPublishedForUser(userId, hasActiveSubscription, hasPurchasedProducts);
    console.log('🎥 getPublishedClassVideosForUser: Resultado:', result.length, 'videos');
    return result;
  } catch (error: any) {
    // Serialize error for better logging
    const errorDetails = {
      error,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      zodIssues: (error as any)?.issues,
      zodErrors: (error as any)?.errors,
    };
    
    console.error('🎥 getPublishedClassVideosForUser: Error completo:', errorDetails);
    console.error('🎥 getPublishedClassVideosForUser: Error stringified:', JSON.stringify(errorDetails, null, 2));

    // Handle Zod validation errors
    if ((error as any)?.issues || (error as any)?.errors) {
      console.error('🎥 getPublishedClassVideosForUser: Error de validación:', (error as any).issues || (error as any).errors);
      throw new Error('Invalid class video data received');
    }

    // Handle standard errors with messages
    if (error instanceof Error && error.message) {
      const message = normaliseErrorMessage(error.message);
      if (message.toLowerCase().startsWith('error fetching')) {
        throw new Error(message);
      }
      throw new Error(`Error fetching class videos: ${message}`);
    }

    // Handle unknown errors - try to extract meaningful info
    let errorMessage = 'Unknown error';
    try {
      if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      } else {
        errorMessage = String(error);
      }
    } catch {
      errorMessage = 'Error could not be serialized';
    }
    
    throw new Error(`Error fetching class videos: ${errorMessage}`);
  }
};
