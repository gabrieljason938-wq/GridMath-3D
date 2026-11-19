import { create } from 'zustand';

export type UiThemePreference = 'light' | 'dark' | 'system';
export type ResolvedUiTheme = 'light' | 'dark';

export const UI_THEME_STORAGE_KEY = 'gridmath-ui-theme';

function readStoredTheme(): UiThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const raw = window.localStorage.getItem(UI_THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') {
      return raw;
    }
  } catch {
    // Ignore storage access failures in restricted browsing contexts
  }
  return 'system';
}

function getSystemTheme(): ResolvedUiTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveUiTheme(preference: UiThemePreference): ResolvedUiTheme {
  return preference === 'system' ? getSystemTheme() : preference;
}

export function applyResolvedThemeToDom(resolved: ResolvedUiTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
}

interface ThemeState {
  uiTheme: UiThemePreference;
  resolvedTheme: ResolvedUiTheme;
  setUiTheme: (theme: UiThemePreference) => void;
  syncWithSystem: () => void;
}

const initialPreference = readStoredTheme();
const initialResolved = resolveUiTheme(initialPreference);

export const useThemeStore = create<ThemeState>((set, get) => ({
  uiTheme: initialPreference,
  resolvedTheme: initialResolved,

  setUiTheme: (theme) => {
    const resolved = resolveUiTheme(theme);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(UI_THEME_STORAGE_KEY, theme);
      }
    } catch {
      // Ignore storage quota or privacy restrictions
    }
    applyResolvedThemeToDom(resolved);
    set({ uiTheme: theme, resolvedTheme: resolved });
  },

  syncWithSystem: () => {
    const currentPref = get().uiTheme;
    const resolved = resolveUiTheme(currentPref);
    applyResolvedThemeToDom(resolved);
    if (resolved !== get().resolvedTheme) {
      set({ resolvedTheme: resolved });
    }
  },
}));

let systemListenerAttached = false;

export function initThemeSync(): void {
  const state = useThemeStore.getState();
  applyResolvedThemeToDom(resolveUiTheme(state.uiTheme));

  if (
    systemListenerAttached ||
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return;
  }

  systemListenerAttached = true;
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = () => {
    useThemeStore.getState().syncWithSystem();
  };

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleChange);
  } else if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(handleChange);
  }
}
