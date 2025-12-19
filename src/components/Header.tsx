import { Button } from "@/components/ui/button";
import { Zap, LogIn, UserPlus, Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export const Header = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/30 shadow-soft">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-soft">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-primary">
            WIDEZAP
          </span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-8">
          <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Início
          </Link>
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Recursos
          </a>
          <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Preços
          </a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Button 
            variant="ghost" 
            asChild 
            className="text-foreground hover:text-primary hover:bg-primary/10 gap-2 rounded-xl"
          >
            <Link to="/login">
              <LogIn className="h-4 w-4" />
              Sign In
            </Link>
          </Button>
          <Button 
            asChild 
            className="bg-gradient-to-r from-primary to-accent hover:shadow-medium text-white font-semibold transition-all duration-300 gap-2 rounded-xl"
          >
            <Link to="/login?tab=signup">
              <UserPlus className="h-4 w-4" />
              Sign Up
            </Link>
          </Button>
        </div>

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="text-foreground rounded-xl">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] bg-card border-border/30">
            <div className="flex flex-col gap-6 mt-8">
              <Link 
                to="/" 
                className="text-lg font-medium text-foreground hover:text-primary transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Início
              </Link>
              <a 
                href="#features" 
                className="text-lg font-medium text-foreground hover:text-primary transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Recursos
              </a>
              <a 
                href="#pricing" 
                className="text-lg font-medium text-foreground hover:text-primary transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Preços
              </a>
              
              <div className="h-px bg-border my-2" />
              
              <Button 
                variant="outline" 
                asChild 
                className="w-full justify-center gap-2 border-primary/30 text-primary rounded-xl"
                onClick={() => setIsOpen(false)}
              >
                <Link to="/login">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Link>
              </Button>
              <Button 
                asChild 
                className="w-full justify-center gap-2 bg-gradient-to-r from-primary to-accent text-white font-semibold rounded-xl"
                onClick={() => setIsOpen(false)}
              >
                <Link to="/login?tab=signup">
                  <UserPlus className="h-4 w-4" />
                  Sign Up
                </Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};
