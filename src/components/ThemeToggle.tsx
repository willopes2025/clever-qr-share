import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThemePreference, ThemeMode } from "@/hooks/useThemePreference";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Automático", icon: Monitor },
];

interface ThemeToggleProps {
  /** Compacto: apenas o ícone (sidebar colapsada / header mobile) */
  collapsed?: boolean;
  /** Usa tokens da sidebar em vez dos tokens padrão */
  variant?: "default" | "sidebar";
  className?: string;
}

export const ThemeToggle = ({
  collapsed = false,
  variant = "default",
  className,
}: ThemeToggleProps) => {
  const { theme, resolvedTheme, setThemeMode } = useThemePreference();
  const ActiveIcon = resolvedTheme === "dark" ? Moon : Sun;
  const activeLabel = OPTIONS.find((o) => o.value === theme)?.label ?? "Automático";

  const sidebarClasses =
    variant === "sidebar"
      ? "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
      : "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {collapsed ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Alterar tema"
            className={cn("w-full h-10 rounded-xl", sidebarClasses, className)}
          >
            <ActiveIcon className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            aria-label="Alterar tema"
            className={cn(
              "w-full justify-start gap-3 rounded-xl",
              sidebarClasses,
              className
            )}
          >
            <ActiveIcon className="h-5 w-5" />
            <span className="truncate">Tema: {activeLabel}</span>
          </Button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="right" className="w-44">
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setThemeMode(option.value)}
            className={cn(
              "gap-2 cursor-pointer",
              theme === option.value && "bg-accent/20 text-accent-foreground"
            )}
          >
            <option.icon className="h-4 w-4" />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
