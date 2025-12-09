const truthyValues = new Set(['1', 'true', 'on', 'yes']);

export const isBuildSmokeTestEnabled = (): boolean => {
  const raw = process.env.APP_BUILD_SMOKE_TEST;
  if (!raw) {
    return false;
  }

  return truthyValues.has(raw.toLowerCase());
};
