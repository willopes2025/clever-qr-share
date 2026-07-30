import { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export const THEME_STORAGE_KEY = "widezap-theme";

/**
 * ThemeProvider - habilita o modo claro/escuro em todo o sistema.
 * A classe `dark` é aplicada no <html> e alimenta os tokens do index.css.
 */
export const ThemeProvider = ({ children }: { children: ReactNode }) => (
  <NextThemesProvider
    attribute="class"
    defaultTheme="system"
    enableSystem
    storageKey={THEME_STORAGE_KEY}
    disableTransitionOnChange
  >
    {children}
  </NextThemesProvider>
);
