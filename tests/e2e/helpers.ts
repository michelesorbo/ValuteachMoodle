import AxeBuilder from "@axe-core/playwright";
import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { USERS, type UserKey } from "./users";

export const password = () => {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is not set");
  return value;
};

export const scormOrigin = () => process.env.E2E_SCORM_ORIGIN ?? "";

type Cookies = Awaited<ReturnType<BrowserContext["cookies"]>>;
const sessions = new Map<UserKey, Cookies>();
let signInBurst = 0;
let lastSignIn = 0;
const SIGN_IN_WINDOW_MS = 10_500;

/**
 * In production Better Auth allows 3 sign-in attempts per client, and the count only
 * resets after 10 seconds without attempts. Call this before each real sign-in so the
 * tests stay below the limit.
 */
export async function beforeSignIn(page: Page, attempts = 1) {
  const idle = Date.now() - lastSignIn;
  if (idle > SIGN_IN_WINDOW_MS) signInBurst = 0;
  if (signInBurst + attempts > 3) {
    await page.waitForTimeout(SIGN_IN_WINDOW_MS - idle);
    signInBurst = 0;
  }
  signInBurst += attempts;
  lastSignIn = Date.now();
}

export async function rememberSession(page: Page, user: UserKey) {
  sessions.set(user, await page.context().cookies());
}

/** Signs in through the login page the first time, then reuses that session. */
export async function login(page: Page, user: UserKey) {
  const saved = sessions.get(user);
  if (saved) {
    await page.context().addCookies(saved);
    await page.goto("/");
  } else {
    await beforeSignIn(page);
    await page.goto("/login");
    await page.getByLabel("Email").fill(USERS[user].email);
    await page.getByLabel("Password").fill(password());
    await page.getByRole("button", { name: "Accedi" }).click();
  }
  await expect(page.getByRole("heading", { name: `Ciao, ${USERS[user].name}` })).toBeVisible();
  if (!saved) await rememberSession(page, user);
}

/**
 * Basic accessibility check: no WCAG 2.1 A/AA violation that can be detected
 * automatically (contrast, labels, names, landmarks, language…).
 */
export async function expectAccessible(page: Page, options: { exclude?: string } = {}) {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (options.exclude) builder = builder.exclude(options.exclude);
  const { violations } = await builder.analyze();
  const summary = violations.map(
    (violation) => `${violation.id}: ${violation.help} → ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
  );
  expect(summary, `Accessibility violations on ${page.url()}`).toEqual([]);
}

/** The form that contains the element with the given id. */
export function formOf(page: Page, fieldId: string): Locator {
  return page.locator("form", { has: page.locator(`#${fieldId}`) });
}
