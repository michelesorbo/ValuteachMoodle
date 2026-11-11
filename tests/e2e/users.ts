/** Users seeded by prepare.ts. They all share the random password of the run (E2E_PASSWORD). */
export const USERS = {
  admin: { email: "admin@e2e.test", name: "Admin E2E", role: "admin" },
  teacher: { email: "docente@e2e.test", name: "Docente E2E", role: "user" },
  student: { email: "studente@e2e.test", name: "Studente E2E", role: "user" },
} as const;

export type UserKey = keyof typeof USERS;
