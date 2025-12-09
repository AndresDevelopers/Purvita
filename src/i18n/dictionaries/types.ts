import type { DefaultDictionary } from './default';

export type DeepLocaleOverrides<T> = T extends string
  ? string
  : T extends number | boolean | null
    ? T
    : T extends ReadonlyArray<infer R>
      ? ReadonlyArray<DeepLocaleOverrides<R>>
      : T extends Array<infer R>
        ? ReadonlyArray<DeepLocaleOverrides<R>>
        : T extends Record<string, unknown>
          ? { [K in keyof T]?: DeepLocaleOverrides<T[K]> }
          : T;

export type DictionaryOverrides = DeepLocaleOverrides<DefaultDictionary>;
export type DictionaryFactory = (appName: string) => DictionaryOverrides;
