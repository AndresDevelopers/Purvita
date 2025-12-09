// Models
export type {
  EmailTemplate,
  ProcessedEmailTemplate,
  TemplateVariables,
  TemplateLocale,
  EmailTemplateId,
} from './domain/models/email-template';

export { EMAIL_TEMPLATE_IDS } from './domain/models/email-template';

// Services
export { EmailTemplateService } from './services/email-template-service';

// Factories
export { createEmailTemplateService } from './factories/email-template-factory';

// Contracts
export type { EmailTemplateRepository } from './domain/contracts/email-template-repository';

