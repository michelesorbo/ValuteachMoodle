import type messages from "../../messages/it.json";
import type { Locale } from "./config";

// Type-checks translation keys against the Italian source file.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
