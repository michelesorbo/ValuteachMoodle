/** Supported locales. Italian only in the MVP; add "en" here and a messages/en.json file to enable English. */
export const locales = ["it"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "it";
