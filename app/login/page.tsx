import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: t("login") };
}

export default async function LoginPage() {
  const t = await getTranslations("auth.login");

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-sm text-neutral-700">{t("intro")}</p>
      <LoginForm />
    </main>
  );
}
