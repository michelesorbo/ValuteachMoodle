"use client";

import { useTranslations } from "next-intl";
import { authClient } from "@/modules/auth/client";

export function LogoutButton() {
  const t = useTranslations("nav");

  async function logout() {
    await authClient.signOut();
    // Full page load: drops every page of the previous user kept in the client router.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate hard navigation
    window.location.assign("/login");
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="rounded border border-neutral-500 px-3 py-1 hover:bg-neutral-100"
    >
      {t("logout")}
    </button>
  );
}
