import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Languages, Check } from "lucide-react";
import { SUPPORTED_LANGUAGES, LanguageCode } from '@/lib/i18n';
import { toast } from 'sonner';

export const LanguageSettings = () => {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (language: LanguageCode) => {
    i18n.changeLanguage(language);
    const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === language);
    toast.success(
      language === 'pt' ? `Idioma alterado para ${selectedLang?.label}` :
      language === 'en' ? `Language changed to ${selectedLang?.label}` :
      `Idioma cambiado a ${selectedLang?.label}`
    );
  };

  const currentLanguage = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 rounded-lg bg-primary/10">
            <Languages className="h-5 w-5 text-primary" />
          </div>
          {t('settings.language')}
        </CardTitle>
        <CardDescription>
          {t('settings.languageDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select value={i18n.language} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-full md:w-[320px]">
            <SelectValue>
              <span className="flex items-center gap-2">
                <span className="text-lg">{currentLanguage.flag}</span>
                <span>{currentLanguage.label}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                <span className="flex items-center gap-3 w-full">
                  <span className="text-xl">{lang.flag}</span>
                  <span className="flex-1">{lang.label}</span>
                  {i18n.language === lang.code && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
};
