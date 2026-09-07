export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "open-work:theme";

export function applyTheme(preference: ThemePreference): void {
  const isDark = preference === "dark" || (preference === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // localStorage can throw in a locked-down browser context - "system" is a safe default.
  }
  return "system";
}

export function storeTheme(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // per-viewer convenience only - losing it just means it doesn't persist.
  }
}

/**
 * Inlined into <head> as a blocking script (see app/layout.tsx) so the
 * correct class is on <html> before first paint - without this, the page
 * flashes light before React hydrates and applies the stored preference.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
