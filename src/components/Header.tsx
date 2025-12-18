import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { Link } from "react-router-dom";

export const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-border/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative h-10 w-10 rounded-lg bg-gradient-neon flex items-center justify-center shadow-glow-cyan group-hover:shadow-glow-magenta transition-all duration-300">
            <Zap className="h-6 w-6 text-background" />
            <div className="absolute inset-0 rounded-lg bg-gradient-neon opacity-50 blur-sm group-hover:opacity-75 transition-opacity" />
          </div>
          <span className="text-xl font-display font-bold tracking-wider text-glow-cyan">
            WIDEZAP
          </span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-8">
          <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Início
          </Link>
          <Link to="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Recursos
          </Link>
          <Link to="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Preços
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild className="hidden md:inline-flex text-foreground hover:text-primary hover:bg-primary/10">
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild className="bg-gradient-neon hover:shadow-glow-cyan text-background font-semibold transition-all duration-300">
            <Link to="/dashboard">Começar Grátis</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};
