import type { ContactMessageLogEntry } from '../models/contact-message';
import type { ContactSettings, ContactSettingsUpdateInput } from '../models/contact-settings';

export interface ContactRepository {
  fetchSettings(): Promise<ContactSettings | null>;
  upsertSettings(input: ContactSettingsUpdateInput): Promise<ContactSettings>;
  logMessage(entry: ContactMessageLogEntry): Promise<void>;
}
