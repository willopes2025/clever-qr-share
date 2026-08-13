import { useEffect, useState } from "react";
import { UserCog, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getImpersonationState, stopImpersonation, type ImpersonationState } from "@/lib/impersonation";

export const ImpersonationBanner = () => {
  const [state, setState] = useState<ImpersonationState | null>(() => getImpersonationState());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sync = () => setState(getImpersonationState());
    window.addEventListener("impersonation-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("impersonation-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!state) return null;

  const handleExit = async () => {
    setLoading(true);
    try {
      await stopImpersonation();
      window.location.href = "/admin";
    } catch (e) {
      toast.error("Erro ao sair da simulação: " + (e as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <span className="flex items-center gap-2">
        <UserCog className="h-4 w-4" />
        Você está acessando como <strong>{state.targetEmail}</strong>
      </span>
      <Button size="sm" variant="secondary" onClick={handleExit} disabled={loading}>
        <LogOut className="mr-2 h-4 w-4" />
        {loading ? "Saindo..." : "Sair da simulação"}
      </Button>
    </div>
  );
};
