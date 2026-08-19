export const RAIL_ICON_SIZE = 24;

// The rail's outer column/row: a w-16 vertical strip at md+, a horizontally
// scrollable h-16 row below it. Shared by the editor and read-only shared rails.
export const RAIL_ASIDE =
  "flex h-16 w-full shrink-0 flex-row items-center gap-1 overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-100 px-2 dark:border-neutral-800 dark:bg-neutral-900 md:h-auto md:w-16 md:flex-col md:overflow-x-visible md:p-2";

// 24px icon + p-3 on each side = a 48px circle, which is why the rail is w-16:
// 64px less its p-2 leaves exactly 48px of usable width.
export const RAIL_BUTTON =
  "shrink-0 rounded-full p-3 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 disabled:opacity-30 disabled:hover:bg-transparent dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white";
