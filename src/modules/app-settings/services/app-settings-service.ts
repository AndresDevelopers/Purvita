import type { AppSettings, AppSettingsUpdateInput } from '../domain/models/app-settings';
import type { AppSettingsModule } from '../factories/app-settings-module';
import { createAppSettingsModule } from '../factories/app-settings-module';

let moduleRef: AppSettingsModule | null = null;

const resolveModule = (): AppSettingsModule => {
  if (moduleRef) {
    return moduleRef;
  }

  moduleRef = createAppSettingsModule();
  return moduleRef;
};

export const setAppSettingsModule = (nextModule: AppSettingsModule | null) => {
  moduleRef = nextModule;
};

export const getAppSettings = async (): Promise<AppSettings> => {
  return resolveModule().repository.getSettings();
};

export const updateAppSettings = async (
  input: AppSettingsUpdateInput,
): Promise<AppSettings> => {
  return resolveModule().repository.upsertSettings(input);
};
