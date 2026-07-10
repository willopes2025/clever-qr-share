import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { buildFormPreviewUrlFromCode } from "@/lib/form-share-links";

/**
 * Resolves a short link (/s/:code) and redirects to the full form URL,
 * preserving static params and attaching `shared_by` for attribution.
 */
const ShortLinkRedirect = () => {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    if (!code) return;
    window.location.replace(buildFormPreviewUrlFromCode(code));
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-muted-foreground">Abrindo formulário...</p>
      </div>
    </div>
  );
};

export default ShortLinkRedirect;
