import { getTranslations } from "next-intl/server";

/**
 * Suspense fallback for authenticated pages. Every page under (app) reads the
 * session at request time, so it must wrap its content in
 * <Suspense fallback={<PageFallback />}> to keep navigations instant.
 */
export async function PageFallback() {
  const t = await getTranslations("app");
  return (
    <p role="status" className="text-neutral-700">
      {t("loading")}
    </p>
  );
}
