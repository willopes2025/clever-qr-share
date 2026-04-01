import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Target, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface SearchResult {
  deal_id: string;
  deal_title: string;
  deal_value: number | null;
  contact_name: string | null;
  contact_phone: string;
  contact_email: string | null;
  stage_name: string;
  stage_color: string;
  funnel_id: string;
  funnel_name: string;
  funnel_color: string;
}

interface GroupedResults {
  funnel_id: string;
  funnel_name: string;
  funnel_color: string;
  stages: {
    stage_name: string;
    stage_color: string;
    deals: SearchResult[];
  }[];
}

interface FunnelGlobalSearchProps {
  onSelectDeal: (funnelId: string, dealId: string) => void;
}

export function FunnelGlobalSearch({ onSelectDeal }: FunnelGlobalSearchProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const isPhoneSearch = /^\d+$/.test(query.replace(/\D/g, "")) && query.replace(/\D/g, "").length >= 4;
  const minChars = isPhoneSearch ? 4 : 3;
  const shouldSearch = query.trim().length >= minChars;

  const searchDeals = useCallback(async (searchTerm: string) => {
    if (!user?.id || searchTerm.trim().length < minChars) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      // Get organization member IDs for team support
      const { data: memberRows } = await supabase.rpc("get_organization_member_ids", {
        _user_id: user.id,
      });
      const memberIds = memberRows?.map((r: any) => r) || [user.id];

      const digits = searchTerm.replace(/\D/g, "");
      const isPhone = /^\d+$/.test(digits) && digits.length >= 4;

      let queryBuilder = supabase
        .from("funnel_deals")
        .select(`
          id,
          title,
          value,
          contact_id,
          stage_id,
          funnel_id,
          contacts!inner(name, phone, email, custom_fields),
          funnel_stages!inner(name, color),
          funnels!inner(name, color, user_id)
        `)
        .in("funnels.user_id", memberIds)
        .limit(50);

      if (isPhone) {
        queryBuilder = queryBuilder.ilike("contacts.phone", `%${digits}%`);
      } else {
        queryBuilder = queryBuilder.or(
          `name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`,
          { referencedTable: "contacts" }
        );
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error("Search error:", error);
        setResults([]);
        return;
      }

      const mapped: SearchResult[] = (data || []).map((d: any) => ({
        deal_id: d.id,
        deal_title: d.title,
        deal_value: d.value,
        contact_name: d.contacts?.name,
        contact_phone: d.contacts?.phone,
        contact_email: d.contacts?.email,
        stage_name: d.funnel_stages?.name,
        stage_color: d.funnel_stages?.color || "#6b7280",
        funnel_id: d.funnel_id,
        funnel_name: d.funnels?.name,
        funnel_color: d.funnels?.color || "#6b7280",
      }));

      setResults(mapped);
    } catch (err) {
      console.error("Search failed:", err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, minChars]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!shouldSearch) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      searchDeals(query);
      setIsOpen(true);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, shouldSearch, searchDeals]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const grouped: GroupedResults[] = (() => {
    const map = new Map<string, GroupedResults>();
    for (const r of results) {
      if (!map.has(r.funnel_id)) {
        map.set(r.funnel_id, {
          funnel_id: r.funnel_id,
          funnel_name: r.funnel_name,
          funnel_color: r.funnel_color,
          stages: [],
        });
      }
      const group = map.get(r.funnel_id)!;
      let stage = group.stages.find(s => s.stage_name === r.stage_name);
      if (!stage) {
        stage = { stage_name: r.stage_name, stage_color: r.stage_color, deals: [] };
        group.stages.push(stage);
      }
      stage.deals.push(r);
    }
    return Array.from(map.values());
  })();

  const handleSelect = (result: SearchResult) => {
    onSelectDeal(result.funnel_id, result.deal_id);
    setIsOpen(false);
    setQuery("");
    setResults([]);
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return null;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca e filtro..."
          className="pl-9 pr-8 w-[280px]"
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setIsOpen(false);
              inputRef.current?.blur();
            }
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setIsOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-[420px] max-h-[450px] overflow-y-auto rounded-lg border bg-popover shadow-lg z-[60]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Buscando...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhum lead encontrado
            </div>
          ) : (
            <div className="p-2 space-y-3">
              <div className="px-2 text-xs text-muted-foreground">
                {results.length} resultado{results.length !== 1 ? "s" : ""}
              </div>
              {grouped.map((group) => (
                <div key={group.funnel_id}>
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: group.funnel_color }}
                    />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wide truncate">
                      {group.funnel_name}
                    </span>
                  </div>

                  {group.stages.map((stage) => (
                    <div key={stage.stage_name} className="ml-2">
                      <div className="flex items-center gap-1.5 px-2 py-1">
                        <div
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: stage.stage_color }}
                        />
                        <span className="text-xs text-muted-foreground font-medium">
                          {stage.stage_name}
                        </span>
                      </div>

                      {stage.deals.map((deal) => (
                        <button
                          key={deal.deal_id}
                          onClick={() => handleSelect(deal)}
                          className={cn(
                            "w-full text-left px-3 py-2 ml-2 rounded-md",
                            "hover:bg-accent transition-colors",
                            "flex items-center justify-between gap-2"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">
                              {deal.contact_name || deal.deal_title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {deal.contact_phone}
                              {deal.contact_email && ` · ${deal.contact_email}`}
                            </p>
                          </div>
                          {deal.deal_value != null && deal.deal_value > 0 && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {formatCurrency(deal.deal_value)}
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
