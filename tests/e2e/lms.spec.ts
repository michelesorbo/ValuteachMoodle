import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  beforeSignIn,
  expectAccessible,
  formOf,
  login,
  password,
  rememberSession,
  scormOrigin,
} from "./helpers";
import { USERS } from "./users";

/**
 * The acceptance criteria of the MVP, end to end: an admin sets up courses and roles,
 * a teacher uploads every kind of lesson, a student completes the course.
 * The tests share data, so they run in order.
 */
test.describe.configure({ mode: "serial" });

const SCORM_ZIP = path.resolve("tests/fixtures/scorm/basic.zip");
const VIDEO = path.resolve("tests/fixtures/video/sample-20s.mp4");

const courses = { main: "", other: "", restricted: "" };

async function createCourse(page: Page, title: string): Promise<string> {
  await page.goto("/courses/new");
  await page.getByLabel("Titolo").fill(title);
  await page.getByLabel("Descrizione").fill(`Descrizione di ${title}`);
  await page.getByRole("button", { name: "Crea corso" }).click();
  await page.waitForURL(/\/courses\/[0-9a-f-]+\/manage$/);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  return new URL(page.url()).pathname.replace(/\/manage$/, "");
}

async function enroll(page: Page, user: { name: string; email: string }, role: "Studente" | "Docente") {
  await page.getByLabel("Utente").selectOption({ label: `${user.name} (${user.email})` });
  await page.getByLabel("Ruolo").selectOption({ label: role });
  await page.getByRole("button", { name: "Iscrivi", exact: true }).click();
  const row = page.getByRole("row", { name: new RegExp(user.email) });
  await expect(row).toContainText(role);
}

test("le pagine richiedono l'accesso e il login funziona da tastiera", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle("Accedi · NewLMS");
  await expectAccessible(page);

  await beforeSignIn(page, 2);
  await page.getByLabel("Email").fill(USERS.admin.email);
  await page.getByLabel("Password").fill("password-sbagliata");
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Email o password non corretti." })).toBeVisible();

  // Keyboard only: skip link first, then the form in reading order.
  await page.reload();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Vai al contenuto" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.keyboard.type(USERS.admin.email);
  await page.keyboard.press("Tab");
  await page.keyboard.type(password());
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: `Ciao, ${USERS.admin.name}` })).toBeVisible();
  await expect(page).toHaveTitle("Corsi · NewLMS");
  await expectAccessible(page);
  await rememberSession(page, "admin");
});

test("l'admin crea un utente; la registrazione pubblica è chiusa", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/users");
  await page.getByLabel("Nome").fill("Nuovo Utente");
  await page.getByLabel("Email").fill("nuovo@e2e.test");
  await page.getByLabel("Password iniziale").fill(password());
  await page.getByRole("button", { name: "Crea utente" }).click();
  await expect(page.getByText("Utente creato.")).toBeVisible();
  await expect(page.getByRole("row", { name: /nuovo@e2e\.test/ })).toContainText("Utente");
  await expectAccessible(page);

  const signUp = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "Intruso", email: "intruso@e2e.test", password: password() },
  });
  expect(signUp.ok()).toBe(false);
});

test("l'admin crea i corsi, assegna il docente e iscrive lo studente", async ({ page }) => {
  await login(page, "admin");

  courses.main = await createCourse(page, "Corso E2E");
  await enroll(page, USERS.teacher, "Docente");
  await enroll(page, USERS.student, "Studente");

  // The same person teaches one course and studies another.
  courses.other = await createCourse(page, "Altro corso");
  await enroll(page, USERS.teacher, "Studente");

  courses.restricted = await createCourse(page, "Corso riservato");

  await page.goto("/");
  for (const title of ["Corso E2E", "Altro corso", "Corso riservato"]) {
    await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();
  }
});

test("il docente carica lezioni di testo, file, video e SCORM", async ({ page }) => {
  await login(page, "teacher");

  // Per-course roles on the home page.
  const card = (title: string) => page.getByRole("listitem").filter({ hasText: title });
  await expect(card("Corso E2E")).toContainText("Il tuo ruolo: Docente");
  await expect(card("Altro corso")).toContainText("Il tuo ruolo: Studente");
  await expect(page.getByText("Corso riservato")).toHaveCount(0);

  // No management where they are only a student, and no access where they are not enrolled.
  await page.goto(`${courses.other}/manage`);
  await expect(page.getByRole("heading", { name: "Pagina non trovata" })).toBeVisible();
  await page.goto(courses.restricted);
  await expect(page.getByRole("heading", { name: "Pagina non trovata" })).toBeVisible();

  await page.goto(courses.main);
  await page.getByRole("link", { name: "Gestisci il corso" }).click();
  await expect(page.getByRole("heading", { name: "Lezioni" })).toBeVisible();

  // Teachers cannot delete the course or assign other teachers.
  await expect(page.getByRole("button", { name: "Elimina il corso" })).toHaveCount(0);
  await expect(page.getByLabel("Ruolo").getByRole("option")).toHaveText(["Studente"]);

  const lessons = page.locator("#lezioni ~ ol");

  await page.locator("#text-lesson-title").fill("Lezione di testo");
  await page.locator("#text-lesson-content").fill("Benvenuti.\n\nQuesta è la prima lezione.");
  await formOf(page, "text-lesson-title").getByRole("button", { name: "Aggiungi lezione" }).click();
  await expect(lessons).toContainText("Lezione di testo");

  const uploads = [
    {
      id: "file-lesson",
      title: "Dispensa",
      file: { name: "dispensa.txt", mimeType: "text/plain", buffer: Buffer.from("Contenuto della dispensa\n") },
    },
    { id: "video-lesson", title: "Video", file: VIDEO },
    { id: "scorm-lesson", title: "Modulo SCORM", file: SCORM_ZIP },
  ];
  for (const upload of uploads) {
    const form = formOf(page, `${upload.id}-title`);
    await page.locator(`#${upload.id}-title`).fill(upload.title);
    await page.locator(`#${upload.id}-file`).setInputFiles(upload.file);
    await form.getByRole("button", { name: "Aggiungi lezione" }).click();
    await expect(form.getByRole("status")).toHaveText("Lezione aggiunta.");
    await expect(lessons).toContainText(upload.title);
  }

  // A file that is not an MP4 is refused even with the right extension.
  const videoForm = formOf(page, "video-lesson-title");
  await page.locator("#video-lesson-title").fill("Finto video");
  await page
    .locator("#video-lesson-file")
    .setInputFiles({ name: "finto.mp4", mimeType: "video/mp4", buffer: Buffer.from("<html>no</html>") });
  await videoForm.getByRole("button", { name: "Aggiungi lezione" }).click();
  await expect(videoForm.getByRole("status")).toHaveText("Il file non è un video MP4 valido.");

  await expect(lessons.getByRole("listitem")).toHaveCount(4);
  await expectAccessible(page);
});

test("lo studente vede solo il suo corso e lo completa", async ({ page }) => {
  await login(page, "student");

  await expect(page.getByRole("link", { name: "Corso E2E", exact: true })).toBeVisible();
  await expect(page.getByText("Altro corso")).toHaveCount(0);
  await expect(page.getByText("Corso riservato")).toHaveCount(0);
  await expect(page.getByText("0 di 4 lezioni completate")).toBeVisible();

  for (const url of [courses.other, courses.restricted, `${courses.main}/manage`]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Pagina non trovata" })).toBeVisible();
  }

  const openLesson = async (title: string) => {
    await page.goto(courses.main);
    await page.getByRole("link", { name: title, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  };
  const completed = page.getByText("Lezione completata");

  // Text: completed with the button.
  await openLesson("Lezione di testo");
  await expect(page.getByText("Questa è la prima lezione.")).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Segna come completata" }).click();
  await expect(completed).toBeVisible();

  // File: downloaded through the app, then completed with the button.
  await openLesson("Dispensa");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: /Scarica dispensa\.txt/ }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("dispensa.txt");
  await page.getByRole("button", { name: "Segna come completata" }).click();
  await expect(completed).toBeVisible();

  // Video: jumping to the end is not enough; watching 90% completes it.
  await openLesson("Video");
  await expectAccessible(page);
  const video = page.locator("video");
  await video.evaluate(async (element: HTMLVideoElement) => {
    element.muted = true;
    if (element.readyState < 1) {
      await new Promise((resolve) => element.addEventListener("loadedmetadata", resolve, { once: true }));
    }
    element.currentTime = element.duration - 2;
    await element.play();
  });
  await expect(page.getByText("Hai guardato il 10% del video.")).toBeVisible({ timeout: 15_000 });
  await expect(completed).toHaveCount(0);
  await video.evaluate(async (element: HTMLVideoElement) => {
    element.currentTime = 0;
    element.playbackRate = 8;
    await element.play();
  });
  await expect(completed).toBeVisible({ timeout: 30_000 });

  // SCORM: suspend, resume where it stopped, then complete with a passing score.
  await openLesson("Modulo SCORM");
  await expectAccessible(page, { exclude: "iframe" });
  const content = () => page.frameLocator("iframe").frameLocator("iframe");
  await expect(content().locator("#api")).toHaveText("trovata");
  await expect(content().locator("#student")).toHaveText(USERS.student.name);
  await expect(content().locator("#entry")).toHaveText("ab-initio");
  await content().getByRole("button", { name: "Salva e sospendi" }).click();
  await expect(content().locator("#result")).toContainText("LMSFinish=true");
  await expect(completed).toHaveCount(0);

  await page.reload();
  await expect(content().locator("#entry")).toHaveText("resume");
  await expect(content().locator("#location")).toHaveText("pagina-2");
  await expect(content().locator("#suspend")).toContainText('"pagina":2');
  await expect(content().locator("#total")).toHaveText("0000:01:30.00");
  await content().getByRole("button", { name: "Completa con punteggio 90" }).click();
  await expect(completed).toBeVisible();

  // The course is completed when all its lessons are.
  await page.goto(courses.main);
  await expect(page.getByText("4 di 4 lezioni completate")).toBeVisible();
  await expect(page.getByText("Corso completato")).toBeVisible();
  await expectAccessible(page);
  await page.goto("/");
  await expect(page.getByText("Corso completato")).toBeVisible();
});

test("il docente vede l'avanzamento dello studente", async ({ page }) => {
  await login(page, "teacher");
  await page.goto(`${courses.main}/manage`);
  await expect(page.getByRole("row", { name: new RegExp(USERS.student.email) })).toContainText(
    "4 di 4 lezioni completate",
  );
});

test("l'app e il player SCORM restano su host separati", async ({ page }) => {
  // The app host serves no SCORM player or content.
  for (const url of ["/scorm/x.y/player", "/scorm/x.y/content/index.html"]) {
    expect((await page.request.get(url)).status(), url).toBe(404);
  }

  // Without a valid token the player on the SCORM host shows nothing but an error…
  await page.goto(`${scormOrigin()}/scorm/x.y/player`);
  await expect(page.getByText("La sessione del contenuto è scaduta")).toBeVisible();

  // …and that host serves no app page, sign-in, API or content (checked from the browser,
  // which is what resolves the *.localhost name).
  const statusOf = (url: string) => page.evaluate(async (target) => (await fetch(target)).status, url);
  for (const url of ["/login", "/", "/api/auth/get-session", "/api/health"]) {
    expect(await statusOf(url), url).toBe(404);
  }
  expect(await statusOf("/scorm/x.y/content/index.html")).toBe(403);
});
