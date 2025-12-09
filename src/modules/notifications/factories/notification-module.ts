import { createClient } from '@/lib/supabase/server';
import { SupabaseNotificationPreferencesRepository } from '../data/repositories/supabase-notification-preferences-repository';
import { NotificationPreferencesService } from '../services/notification-preferences-service';

export async function createNotificationModule() {
  const supabase = await createClient();
  const repository = new SupabaseNotificationPreferencesRepository(supabase);
  const service = new NotificationPreferencesService(repository);

  return {
    repository,
    service,
  };
}

