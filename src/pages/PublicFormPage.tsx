import { useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";

const PublicFormPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();

  useEffect(() => {
    if (slug) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Extract static params from the URL path after the slug
      // URL format: /form/slug/key1=value1/key2=value2
      const pathAfterSlug = location.pathname.split(`/${slug}/`)[1] || '';
      const staticParams = pathAfterSlug
        .split('/')
        .filter(Boolean)
        .map(param => {
          const [key, value] = param.split('=');
          return { key: decodeURIComponent(key || ''), value: decodeURIComponent(value || '') };
        })
        .filter(p => p.key && p.value);

      // Build URL with params as query string for the edge function
      const params = new URLSearchParams();
      params.set('slug', slug);
      
      if (staticParams.length > 0) {
        params.set('static_params', JSON.stringify(staticParams));
      }

      window.location.href = `${supabaseUrl}/functions/v1/public-form?${params.toString()}`;
    }
  }, [slug, location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-muted-foreground">Carregando formulário...</p>
      </div>
    </div>
  );
};

export default PublicFormPage;
