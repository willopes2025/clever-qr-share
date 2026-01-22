import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";

const PublicFormPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Extract static params from the URL path after the slug
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

      const fetchForm = async () => {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/public-form?${params.toString()}`);
          const html = await response.text();
          
          if (!response.ok) {
            setError('Formulário não encontrado');
            return;
          }
          
          setHtmlContent(html);
        } catch (err) {
          console.error('Error fetching form:', err);
          setError('Erro ao carregar formulário');
        } finally {
          setLoading(false);
        }
      };

      fetchForm();
    }
  }, [slug, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando formulário...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Formulário não encontrado</h1>
          <p className="text-muted-foreground">Este formulário não existe ou não está mais disponível.</p>
        </div>
      </div>
    );
  }

  if (htmlContent) {
    // Use an iframe with srcdoc to render the HTML safely
    return (
      <iframe
        srcDoc={htmlContent}
        className="w-full min-h-screen border-0"
        title="Formulário"
        sandbox="allow-scripts allow-forms allow-same-origin"
      />
    );
  }

  return null;
};

export default PublicFormPage;
