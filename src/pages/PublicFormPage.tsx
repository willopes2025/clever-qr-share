import { useEffect } from "react";
import { useParams } from "react-router-dom";

const PublicFormPage = () => {
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    // Redirect to the edge function that renders the form
    if (slug) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      window.location.href = `${supabaseUrl}/functions/v1/public-form?slug=${slug}`;
    }
  }, [slug]);

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
