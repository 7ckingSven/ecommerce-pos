import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIGHT_COLORS, DARK_COLORS } from './constants';

// ─── Dark Mode (F6) ─────────────────────────────────────
// themeMode is what the user picked: 'system' (default — follows the
// phone's own light/dark setting), 'light', or 'dark'. It's persisted to
// AsyncStorage so the choice survives an app restart. isDark is the
// *resolved* boolean actually driving which palette is active, and colors
// is that palette itself — every screen reads from useTheme() instead of
// importing COLORS directly, so flipping themeMode re-renders the whole
// app with the new palette automatically.
const THEME_MODE_KEY = '@theme_mode';

const ThemeContext = createContext({
  themeMode: 'system',
  isDark: false,
  colors: LIGHT_COLORS,
  setThemeMode: () => {},
});

export function ThemeProvider({ children }) {
  const [themeMode, setThemeModeState] = useState('system');
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme() || 'light');
  const [loaded, setLoaded] = useState(false);

  // Load the persisted override once on mount.
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_MODE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeModeState(saved);
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  // Keep systemScheme live so 'system' mode reacts to the phone's own
  // setting changing while the app is open (e.g. auto dark mode at sunset).
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || 'light');
    });
    return () => sub.remove();
  }, []);

  const setThemeMode = useCallback((mode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_MODE_KEY, mode).catch(() => {});
  }, []);

  const isDark = themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const value = useMemo(
    () => ({ themeMode, isDark, colors, setThemeMode, loaded }),
    [themeMode, isDark, colors, setThemeMode, loaded]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}