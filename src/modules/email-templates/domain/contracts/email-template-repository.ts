import type { EmailTemplate, EmailTemplateId } from '../models/email-template';

/**
 * Repository contract for email templates
 */
export interface EmailTemplateRepository {
  /**
   * Get all active email templates
   */
  getAll(): Promise<EmailTemplate[]>;

  /**
   * Get email template by ID
   */
  getById(id: EmailTemplateId): Promise<EmailTemplate | null>;

  /**
   * Get email templates by category
   */
  getByCategory(category: string): Promise<EmailTemplate[]>;

  /**
   * Check if template exists and is active
   */
  isActive(id: EmailTemplateId): Promise<boolean>;
}

