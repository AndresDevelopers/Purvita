const fallbackAppName = 'PūrVita';

const envAppName = process.env.NEXT_PUBLIC_APP_NAME?.trim();

export const DEFAULT_APP_NAME = envAppName && envAppName.length > 0 ? envAppName : fallbackAppName;

export const getDefaultAppName = () => DEFAULT_APP_NAME;
