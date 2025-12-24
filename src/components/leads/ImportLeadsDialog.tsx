import { useState } from "react";
import { Company } from "@/pages/LeadSearch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Tag, AlertCircle, CheckCircle2 } from "lucide-react";
import { useContacts } from "@/hooks/useContacts";
import { toast } from "sonner";

interface ImportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  onSuccess: () => void;
}

export const ImportLeadsDialog = ({
  open,
  onOpenChange,
  companies,
  onSuccess,
}: ImportLeadsDialogProps) => {
  const { tags, importContacts, createTag } = useContacts();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [skipWithoutPhone, setSkipWithoutPhone] = useState(true);

  const companiesWithPhone = companies.filter(c => c.telefone);
  const companiesWithoutPhone = companies.filter(c => !c.telefone);

  const handleToggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      const result = await createTag.mutateAsync({ 
        name: newTagName.trim(), 
        color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
      });
      if (result) {
        setSelectedTags(prev => [...prev, result.id]);
        setNewTagName("");
      }
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    
    try {
      // Filter companies based on settings
      const toImport = skipWithoutPhone ? companiesWithPhone : companies;
      
      if (toImport.length === 0) {
        toast.error('Nenhuma empresa com telefone para importar');
        return;
      }

      // Format contacts for import - all custom_fields values must be strings
      const contacts = toImport.map(company => {
        const ddd = company.endereco?.ddd || '';
        const phone = company.telefone || '';
        const fullPhone = ddd + phone;
        
        // Normalize to Brazilian format with country code
        let normalizedPhone = fullPhone.replace(/\D/g, '');
        if (normalizedPhone.length >= 10 && normalizedPhone.length <= 11 && !normalizedPhone.startsWith('55')) {
          normalizedPhone = '55' + normalizedPhone;
        }

        // Build custom_fields with string values only
        const customFields: Record<string, string> = {};
        if (company.cnpj) customFields.cnpj = company.cnpj;
        if (company.razao_social) customFields.razao_social = company.razao_social;
        if (company.nome_fantasia) customFields.nome_fantasia = company.nome_fantasia;
        if (company.capital_social) customFields.capital_social = company.capital_social.toString();
        if (company.data_abertura) customFields.data_abertura = company.data_abertura;
        if (company.cnae_principal) customFields.cnae = company.cnae_principal;
        if (company.endereco?.municipio) customFields.municipio = company.endereco.municipio;
        if (company.endereco?.uf) customFields.uf = company.endereco.uf;
        if (company.endereco?.logradouro) {
          customFields.endereco_completo = `${company.endereco.logradouro}, ${company.endereco.numero || 'S/N'} - ${company.endereco.bairro || ''}, ${company.endereco.cep || ''}`.trim();
        }

        return {
          phone: normalizedPhone,
          name: company.nome_fantasia || company.razao_social,
          email: company.email || undefined,
          notes: [
            `CNPJ: ${company.cnpj}`,
            company.razao_social ? `Razão Social: ${company.razao_social}` : '',
            company.cnae_principal ? `CNAE: ${company.cnae_principal}` : '',
            company.endereco?.municipio ? `Local: ${company.endereco.municipio}/${company.endereco.uf}` : '',
            company.capital_social ? `Capital: R$ ${company.capital_social.toLocaleString('pt-BR')}` : '',
          ].filter(Boolean).join('\n'),
          custom_fields: customFields,
        };
      });

      // Import using the existing hook
      const result = await importContacts.mutateAsync({
        contacts,
        tagIds: selectedTags.length > 0 ? selectedTags : undefined,
      });

      // The hook returns an array of imported contacts
      const importedCount = result?.length || 0;
      toast.success(`${importedCount} contatos importados com sucesso!`);
      onSuccess();
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro ao importar contatos');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Importar Leads para Contatos
          </DialogTitle>
          <DialogDescription>
            {companies.length} empresa(s) selecionada(s) para importação
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary */}
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Com telefone
              </span>
              <Badge variant="default">{companiesWithPhone.length}</Badge>
            </div>
            {companiesWithoutPhone.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  Sem telefone
                </span>
                <Badge variant="secondary">{companiesWithoutPhone.length}</Badge>
              </div>
            )}
          </div>

          {/* Skip without phone option */}
          {companiesWithoutPhone.length > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="skip_without_phone"
                checked={skipWithoutPhone}
                onCheckedChange={(c) => setSkipWithoutPhone(!!c)}
              />
              <Label htmlFor="skip_without_phone" className="text-sm">
                Ignorar empresas sem telefone
              </Label>
            </div>
          )}

          {/* Tags */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Aplicar Tags (opcional)
            </Label>
            <div className="flex flex-wrap gap-2">
              {tags?.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  style={selectedTags.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                  onClick={() => handleToggleTag(tag.id)}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
            
            {/* Quick create tag */}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                placeholder="Nova tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                className="flex-1 px-3 py-1.5 text-sm border rounded-md bg-background"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCreateTag}
                disabled={!newTagName.trim()}
              >
                Criar
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={isImporting || (skipWithoutPhone && companiesWithPhone.length === 0)}
          >
            <Download className="h-4 w-4 mr-2" />
            {isImporting ? "Importando..." : `Importar ${skipWithoutPhone ? companiesWithPhone.length : companies.length} Contatos`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
