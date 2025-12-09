import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmailTemplateRepository } from '../../domain/contracts/email-template-repository';
import type { EmailTemplate, EmailTemplateId } from '../../domain/models/email-template';

/**
 * Database row structure
 */
interface DbEmailTemplateRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  subject_en: string;
  subject_es: string;
  body_en: string;
  body_es: string;
  variables: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Map database row to domain model
 */
function mapRowToEmailTemplate(row: DbEmailTemplateRow): EmailTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category,
    subjectEn: row.subject_en,
    subjectEs: row.subject_es,
    bodyEn: row.body_en,
    bodyEs: row.body_es,
    variables: row.variables ?? [],
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Supabase implementation of EmailTemplateRepository
 */
export class SupabaseEmailTemplateRepository implements EmailTemplateRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getAll(): Promise<EmailTemplate[]> {
    const { data, error } = await this.client
      .from('email_templates')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('[SupabaseEmailTemplateRepository] Error fetching templates:', error);
      throw new Error(`Failed to fetch email templates: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map(mapRowToEmailTemplate);
  }

  async getById(id: EmailTemplateId): Promise<EmailTemplate | null> {
    const { data, error } = await this.client
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error(`[SupabaseEmailTemplateRepository] Error fetching template ${id}:`, error);
      throw new Error(`Failed to fetch email template: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return mapRowToEmailTemplate(data);
  }

  async getByCategory(category: string): Promise<EmailTemplate[]> {
    const { data, error } = await this.client
      .from('email_templates')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error(`[SupabaseEmailTemplateRepository] Error fetching templates by category ${category}:`, error);
      throw new Error(`Failed to fetch email templates by category: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map(mapRowToEmailTemplate);
  }

  async isActive(id: EmailTemplateId): Promise<boolean> {
    const { data, error } = await this.client
      .from('email_templates')
      .select('is_active')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`[SupabaseEmailTemplateRepository] Error checking template ${id}:`, error);
      return false;
    }

    return data?.is_active ?? false;
  }
}

