import type {
  SiteModeConfiguration,
  SiteModeSettings,
  SiteModeUpsertInput,
} from '../models/site-mode';

export interface SiteModeRepository {
  fetchAll(): Promise<SiteModeSettings[]>;
  upsertMany(payload: SiteModeUpsertInput[]): Promise<SiteModeSettings[]>;
  getDefaultConfiguration(): SiteModeConfiguration;
}
