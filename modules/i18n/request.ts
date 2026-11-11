import { getRequestConfig } from "next-intl/server";
import { defaultLocale } from "./config";

/**
 * next-intl request configuration (no locale in the URL).
 * The locale is fixed to Italian in the MVP; when English is added, resolve it
 * here from the user's preference (cookie or profile).
 */
export default getRequestConfig(async () => {
  const locale = defaultLocale;
  return {
    locale,
    timeZone: "Europe/Rome",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
