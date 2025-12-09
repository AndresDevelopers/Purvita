import type { AppSettings, AppSettingsUpdateInput } from '../models/app-settings';

export interface AppSettingsRepository {
  getSettings(): Promise<AppSettings>;
  upsertSettings(input: AppSettingsUpdateInput): Promise<AppSettings>;
}
