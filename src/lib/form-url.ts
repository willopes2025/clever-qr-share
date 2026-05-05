interface FormStaticParam {
  key: string;
  value: string;
}

interface BuildPublicFormUrlOptions {
  staticParams?: FormStaticParam[];
  embed?: boolean;
}

export const buildPublicFormUrl = (slug: string, options: BuildPublicFormUrlOptions = {}) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const params = new URLSearchParams();

  params.set('slug', slug);

  const validStaticParams = (options.staticParams || []).filter(param => param.key && param.value);
  if (validStaticParams.length > 0) {
    params.set('static_params', JSON.stringify(validStaticParams));
  }

  if (options.embed) {
    params.set('embed', 'true');
  }

  return `${supabaseUrl}/functions/v1/public-form?${params.toString()}`;
};