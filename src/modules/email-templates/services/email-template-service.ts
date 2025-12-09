import type { EmailTemplateRepository } from '../domain/contracts/email-template-repository';
import type {
  EmailTemplateId,
  ProcessedEmailTemplate,
  TemplateLocale,
  TemplateVariables,
} from '../domain/models/email-template';

/**
 * Service for processing email templates
 */
export class EmailTemplateService {
  constructor(private readonly repository: EmailTemplateRepository) {}

  /**
   * Get and process an email template with variable replacement
   */
  async getProcessedTemplate(
    templateId: EmailTemplateId,
    variables: TemplateVariables,
    locale: TemplateLocale = 'en'
  ): Promise<ProcessedEmailTemplate | null> {
    // Get template from database
    const template = await this.repository.getById(templateId);

    if (!template) {
      console.warn(`[EmailTemplateService] Template not found: ${templateId}`);
      return null;
    }

    // Select language
    const subject = locale === 'es' ? template.subjectEs : template.subjectEn;
    const body = locale === 'es' ? template.bodyEs : template.bodyEn;

    // Replace variables in subject and body
    const processedSubject = this.replaceVariables(subject, variables);
    const processedBody = this.replaceVariables(body, variables);

    // Create HTML with proper email layout
    const html = this.createEmailHtml(processedBody);

    return {
      subject: processedSubject,
      body: processedBody,
      html,
    };
  }

  /**
   * Replace template variables with actual values
   * Supports {{variableName}} syntax
   */
  private replaceVariables(template: string, variables: TemplateVariables): string {
    let result = template;

    Object.entries(variables).forEach(([key, value]) => {
      // Convert value to string, handling null/undefined
      const stringValue = value !== null && value !== undefined ? String(value) : '';
      
      // Replace all occurrences of {{key}} or {{ key }} (with optional spaces)
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      result = result.replace(regex, stringValue);
    });

    return result;
  }

  /**
   * Create full HTML email with proper layout and styling
   */
  private createEmailHtml(body: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .email-header {
      padding: 30px 40px;
      background-color: #667eea;
      text-align: center;
    }
    .email-header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 24px;
      font-weight: 600;
    }
    .email-body {
      padding: 40px;
      color: #333333;
      line-height: 1.6;
    }
    .email-body h2 {
      color: #333333;
      font-size: 20px;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .email-body h3 {
      color: #555555;
      font-size: 18px;
      margin-top: 20px;
      margin-bottom: 15px;
    }
    .email-body p {
      margin: 0 0 15px 0;
      color: #555555;
      font-size: 16px;
    }
    .email-body a {
      color: #667eea;
      text-decoration: none;
    }
    .email-body a:hover {
      text-decoration: underline;
    }
    .email-footer {
      padding: 30px 40px;
      background-color: #f5f5f5;
      text-align: center;
      color: #777777;
      font-size: 14px;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background-color: #667eea;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
      margin: 10px 0;
    }
    .button:hover {
      background-color: #5568d3;
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .email-body {
        padding: 20px;
      }
      .email-header {
        padding: 20px;
      }
      .email-footer {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-body">
      ${body}
    </div>
    <div class="email-footer">
      <p>This email was sent by PūrVita. If you have any questions, please contact our support team.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Check if a template exists and is active
   */
  async isTemplateAvailable(templateId: EmailTemplateId): Promise<boolean> {
    return this.repository.isActive(templateId);
  }

  /**
   * Get all available templates
   */
  async getAllTemplates() {
    return this.repository.getAll();
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(category: string) {
    return this.repository.getByCategory(category);
  }
}

