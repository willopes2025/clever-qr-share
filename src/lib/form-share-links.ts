import { supabase } from "@/integrations/supabase/client";

type StaticParams = Record<string, string>;

const PUBLIC_FORM_ORIGIN = "https://zap.wideic.com";

const getPublicFormOrigin = () => {
  if (typeof window === "undefined") return PUBLIC_FORM_ORIGIN;

  const { origin, hostname } = window.location;
  if (
    hostname === "localhost" ||
    hostname.endsWith(".lovable.app") ||
    hostname.includes("lovableproject.com")
  ) {
    return PUBLIC_FORM_ORIGIN;
  }

  return origin;
};

const encodeStaticPath = (staticParams: StaticParams = {}) =>
  Object.entries(staticParams)
    .filter(([key, value]) => key && value)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("/");

export const buildDirectFormUrl = (slug: string, staticParams: StaticParams = {}) => {
  const baseUrl = `${getPublicFormOrigin()}/f/${slug}`;
  const paramsPath = encodeStaticPath(staticParams);
  return paramsPath ? `${baseUrl}/${paramsPath}` : baseUrl;
};

export const buildFormPreviewUrlFromCode = (code: string) => {
  const functionsOrigin = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  if (!functionsOrigin) throw new Error("URL de funções não configurada");

  return `${functionsOrigin}/functions/v1/form-preview/${encodeURIComponent(code)}?o=${encodeURIComponent(getPublicFormOrigin())}`;
};

export const buildFormPreviewShareUrl = async ({
  formId,
  slug,
  staticParams = {},
}: {
  formId: string;
  slug: string;
  staticParams?: StaticParams;
}) => {
  const { data, error } = await supabase.functions.invoke("create-form-short-link", {
    body: {
      form_id: formId,
      static_params: staticParams,
    },
  });

  if (error) throw error;
  if (!data?.code) throw new Error("Sem código retornado");

  return `${getPublicFormOrigin()}/s/${encodeURIComponent(data.code)}`;
};