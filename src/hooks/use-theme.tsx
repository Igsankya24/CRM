"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="theme"
    >
      {children}
    </NextThemesProvider>
  );
}

export function useTheme() {
  const { theme, setTheme } = useNextTheme();

  return {
    theme: theme as "light" | "dark" | "system" | undefined,
    setTheme: (t: string) => setTheme(t),
    themeMode: theme as "light" | "dark" | "system" | undefined,
    setThemeMode: (t: string) => setTheme(t),
  };
}
