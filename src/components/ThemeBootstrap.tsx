import { useThemePreference } from "@/hooks/useThemePreference";

/**
 * Carrega a preferência de tema salva na conta do usuário e a aplica.
 * Não renderiza nada.
 */
export const ThemeBootstrap = () => {
  useThemePreference();
  return null;
};
