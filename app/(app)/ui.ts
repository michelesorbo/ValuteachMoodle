/** Shared Tailwind class strings, so forms and buttons look the same on every page. */
export const inputClass = "w-full rounded border border-neutral-500 bg-white px-3 py-2";
export const labelClass = "text-sm font-medium";
export const fieldClass = "flex flex-col gap-1";
export const linkClass = "text-blue-800 underline underline-offset-4 hover:text-blue-950";
export const sectionTitleClass = "text-xl font-semibold";

export const buttonClasses = {
  primary:
    "rounded bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800 disabled:opacity-60",
  secondary:
    "rounded border border-neutral-500 px-3 py-1 text-sm hover:bg-neutral-100 disabled:opacity-60",
  danger:
    "rounded border border-red-700 px-3 py-1 text-sm text-red-800 hover:bg-red-50 disabled:opacity-60",
} as const;

export type ButtonVariant = keyof typeof buttonClasses;
