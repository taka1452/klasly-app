"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

// Predefined theme palettes
const THEMES: Record<string, { primary: string; primaryLight: string; primaryDark: string }> = {
  green:  { primary: "#059669", primaryLight: "#d1fae5", primaryDark: "#047857" },
  blue:   { primary: "#0074c5", primaryLight: "#e0effe", primaryDark: "#015da0" },
  purple: { primary: "#7c3aed", primaryLight: "#ede9fe", primaryDark: "#6d28d9" },
  red:    { primary: "#dc2626", primaryLight: "#fee2e2", primaryDark: "#b91c1c" },
  orange: { primary: "#ea580c", primaryLight: "#ffedd5", primaryDark: "#c2410c" },
  pink:   { primary: "#db2777", primaryLight: "#fce7f3", primaryDark: "#be185d" },
  teal:   { primary: "#0d9488", primaryLight: "#ccfbf1", primaryDark: "#0f766e" },
};

type ThemeColors = {
  primary: string;
  primaryLight: string;
  primaryDark: string;
};

const ThemeContext = createContext<ThemeColors>(THEMES.green);

export function useWidgetTheme() {
  return useContext(ThemeContext);
}

type Props = {
  theme: string;
  children: ReactNode;
};

export function WidgetThemeProvider({ theme, children }: Props) {
  const colors = useMemo(() => THEMES[theme] || THEMES.green, [theme]);

  return (
    <ThemeContext.Provider value={colors}>
      <div
        className="widget-root"
        style={
          {
            "--widget-primary": colors.primary,
            "--widget-primary-light": colors.primaryLight,
            "--widget-primary-dark": colors.primaryDark,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
