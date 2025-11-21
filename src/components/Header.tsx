import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

export const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
            <MessageSquare className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">DisparaZap</span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-6">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Início
          </Link>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Recursos
          </Link>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Preços
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild className="hidden md:inline-flex">
            <Link to="/dashboard">Entrar</Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard">Começar Grátis</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};
