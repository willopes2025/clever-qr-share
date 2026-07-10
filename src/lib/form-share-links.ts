import { supabase } from "@/integrations/supabase/client";

type StaticParams = Record<string, string>;

const encodeStaticPath = (staticParams: StaticParams = {}) =>
  Object.entries(staticParams)
    .filter(([key, value]) => key && value)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("/");

export const buildDirectFormUrl = (slug: string, staticParams: StaticParams = {}) => {
  const baseUrl = `${window.location.origin}/form/${slug}`;
  const paramsPath = encodeStaticPath(staticParams);
  return paramsPath ? `${baseUrl}/${paramsPath}` : baseUrl;
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
  const fallbackUrl = buildDirectFormUrl(slug, staticParams);

  try {
    const { data, error } = await supabase.functions.invoke("create-form-short-link", {
      body: {
        form_id: formId,
        static_params: staticParams,
      },
    });

    if (error) throw error;
    if (!data?.code) throw new Error("Sem código retornado");

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const functionsOrigin = projectId
      ? `https://${projectId}.supabase.co`
      : String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");

    if (!functionsOrigin) return fallbackUrl;

    return `${functionsOrigin}/functions/v1/form-preview/${data.code}?o=${encodeURIComponent(window.location.origin)}`;
  } catch (error) {
    console.warn("Short preview link falhou, usando link direto:", error);
    return fallbackUrl;
  }
};