import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AI_AGENT_TEMPLATES, AIAgentTemplate } from "@/data/ai-agent-templates";
import { Plus } from "lucide-react";

interface AIAgentTemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: AIAgentTemplate | null) => void;
  personalizeWithCompany: boolean;
  setPersonalizeWithCompany: (value: boolean) => void;
  hasCompanyContext: boolean;
}

export const AIAgentTemplateSelector = ({
  open,
  onOpenChange,
  onSelectTemplate,
  personalizeWithCompany,
  setPersonalizeWithCompany,
  hasCompanyContext,
}: AIAgentTemplateSelectorProps) => {
  const categoryLabels: Record<string, string> = {
    sales: "Vendas",
    support: "Suporte",
    scheduling: "Agendamento",
    general: "Geral",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Criar Novo Agente de IA</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Escolha um modelo para começar ou crie do zero
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Personalize Option */}
          {hasCompanyContext && (
            <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
              <Checkbox
                id="personalize"
                checked={personalizeWithCompany}
                onCheckedChange={(checked) => setPersonalizeWithCompany(checked as boolean)}
              />
              <Label htmlFor="personalize" className="text-sm cursor-pointer">
                Personalizar automaticamente com os dados da minha empresa
              </Label>
            </div>
          )}

          {/* Templates Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {AI_AGENT_TEMPLATES.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-primary hover:shadow-md transition-all duration-200 group"
                onClick={() => onSelectTemplate(template)}
              >
                <CardContent className="p-4 text-center space-y-2">
                  <div className="text-3xl mb-2">{template.icon}</div>
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                    {template.name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {template.shortDescription}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {categoryLabels[template.category]}
                  </Badge>
                </CardContent>
              </Card>
            ))}

            {/* Blank Template */}
            <Card
              className="cursor-pointer hover:border-primary hover:shadow-md transition-all duration-200 group border-dashed"
              onClick={() => onSelectTemplate(null)}
            >
              <CardContent className="p-4 text-center space-y-2 flex flex-col items-center justify-center h-full min-h-[140px]">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                </div>
                <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                  Do Zero
                </h3>
                <p className="text-xs text-muted-foreground">
                  Começar com configurações vazias
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Template Descriptions */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3 text-sm">Sobre os Templates:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-muted-foreground">
              {AI_AGENT_TEMPLATES.slice(0, 4).map((template) => (
                <div key={template.id} className="flex gap-2">
                  <span>{template.icon}</span>
                  <div>
                    <span className="font-medium text-foreground">{template.name}:</span>{" "}
                    {template.description.substring(0, 80)}...
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
