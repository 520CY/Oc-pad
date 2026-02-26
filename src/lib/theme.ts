import { AccentTheme, ThemeMode } from "@/types";

const THEME_MODE_STORAGE_KEY = "oc-pad.themeMode";
const ACCENT_THEME_STORAGE_KEY = "oc-pad.accentTheme";

const THEME_CLASSNAMES = ["light", "dark"] as const;
const ACCENT_CLASSNAMES = [
  "theme-violet",
  "theme-teal",
  "theme-amber",
  "theme-rose",
  "theme-cyan",
  "theme-lime",
] as const;

export function getStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "system";
  }
  const saved = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") {
    return saved;
  }
  return "system";
}

export function getStoredAccentTheme(): AccentTheme {
  if (typeof window === "undefined") {
    return "violet";
  }
  const saved = window.localStorage.getItem(ACCENT_THEME_STORAGE_KEY);
  if (
    saved === "violet" ||
    saved === "teal" ||
    saved === "amber" ||
    saved === "rose" ||
    saved === "cyan" ||
    saved === "lime"
  ) {
    return saved;
  }
  return "violet";
}

export function persistThemeMode(mode: ThemeMode) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
}

export function persistAccentTheme(accent: AccentTheme) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ACCENT_THEME_STORAGE_KEY, accent);
}

export function applyTheme(mode: ThemeMode, accent: AccentTheme) {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  for (const className of THEME_CLASSNAMES) {
    root.classList.remove(className);
  }
  for (const className of ACCENT_CLASSNAMES) {
    root.classList.remove(className);
  }

  const resolvedMode = mode === "system" ? resolveSystemMode() : mode;
  root.classList.add(resolvedMode);
  root.classList.add(`theme-${accent}`);
}

export function observeSystemThemeChange(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const listener = () => onChange();

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }

  media.addListener(listener);
  return () => media.removeListener(listener);
}

function resolveSystemMode(): Exclude<ThemeMode, "system"> {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
