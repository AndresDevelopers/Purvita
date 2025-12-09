import { getAdminClient } from '@/lib/supabase/admin';
import { SupabaseEmailTemplateRepository } from '../data/repositories/supabase-email-template-repository';
import { EmailTemplateService } from '../services/email-template-service';

/**
 * Create email template service instance
 */
export function createEmailTemplateService(): EmailTemplateService {
  const supabaseClient = getAdminClient();
  const repository = new SupabaseEmailTemplateRepository(supabaseClient);
  return new EmailTemplateService(repository);
}

