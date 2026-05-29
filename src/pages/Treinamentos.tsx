import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const ALLOWED_EMAILS = ["contato@wideic.com"];
import { ArrowLeft, GraduationCap, CheckCircle2, Circle, PlayCircle, ImageOff, MousePointerClick, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { trainings } from "@/data/trainings";
import { useTrainingProgress } from "@/hooks/useTrainingProgress";
import { cn } from "@/lib/utils";

const Treinamentos = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const email = user?.email?.toLowerCase() ?? "";
  if (!ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(email)) {
    return <Navigate to="/dashboard" replace />;
  }
  const { completed, toggle, loading } = useTrainingProgress();
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  const totals = useMemo(() => {
    const totalSteps = trainings.reduce((acc, m) => acc + m.steps.length, 0);
    const doneSteps = trainings.reduce(
      (acc, m) => acc + m.steps.filter((s) => completed.has(s.id)).length,
      0,
    );
    return {
      totalSteps,
      doneSteps,
      pct: totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0,
    };
  }, [completed]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <div className="flex items-start gap-4 mb-8">
          <div className="rounded-xl bg-primary/10 p-3">
            <GraduationCap className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Treinamentos</h1>
            <p className="text-muted-foreground mt-1">
              Aprenda a usar a plataforma passo a passo com textos e prints de cada tela.
            </p>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Seu progresso geral</CardTitle>
              <Badge variant="secondary">
                {totals.doneSteps} / {totals.totalSteps} etapas
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={totals.pct} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">{totals.pct}% concluído</p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {trainings.map((module) => {
            const moduleDone = module.steps.filter((s) => completed.has(s.id)).length;
            const modulePct = Math.round((moduleDone / module.steps.length) * 100);
            const fullyDone = moduleDone === module.steps.length;

            return (
              <Card key={module.id} className={cn(fullyDone && "border-primary/40")}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {fullyDone && <CheckCircle2 className="h-5 w-5 text-primary" />}
                        {module.title}
                      </CardTitle>
                      <CardDescription className="mt-1">{module.description}</CardDescription>
                    </div>
                    <Badge variant={fullyDone ? "default" : "outline"} className="shrink-0">
                      {moduleDone}/{module.steps.length}
                    </Badge>
                  </div>
                  <Progress value={modulePct} className="h-1.5 mt-3" />
                </CardHeader>
                <CardContent>
                  {module.videoUrl && (
                    <div className="mb-4 rounded-lg overflow-hidden border bg-muted aspect-video">
                      {module.videoUrl.includes("youtube") || module.videoUrl.includes("vimeo") ? (
                        <iframe
                          src={module.videoUrl}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title={`Vídeo - ${module.title}`}
                        />
                      ) : (
                        <video src={module.videoUrl} controls className="w-full h-full" />
                      )}
                    </div>
                  )}

                  <Accordion type="multiple" className="w-full">
                    {module.steps.map((step, idx) => {
                      const isDone = completed.has(step.id);
                      const imgFailed = imgErrors.has(step.id);
                      return (
                        <AccordionItem key={step.id} value={step.id}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3 text-left">
                              {isDone ? (
                                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                              )}
                              <span className="text-sm font-medium text-muted-foreground">
                                Etapa {idx + 1}
                              </span>
                              <span className="font-medium">{step.title}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="pl-8 space-y-4">
                              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                                {step.description}
                              </p>

                              {step.image && !imgFailed && (
                                <div className="rounded-lg overflow-hidden border bg-muted">
                                  <img
                                    src={step.image}
                                    alt={step.title}
                                    className="w-full h-auto"
                                    loading="lazy"
                                    onError={() =>
                                      setImgErrors((prev) => new Set(prev).add(step.id))
                                    }
                                  />
                                </div>
                              )}
                              {step.image && imgFailed && (
                                <div className="rounded-lg border border-dashed bg-muted/40 p-6 flex items-center gap-3 text-sm text-muted-foreground">
                                  <ImageOff className="h-5 w-5" />
                                  Print ainda não disponível ({step.image})
                                </div>
                              )}

                              <label className="flex items-center gap-2 cursor-pointer w-fit pt-2">
                                <Checkbox
                                  checked={isDone}
                                  onCheckedChange={() => toggle(step.id)}
                                  disabled={loading}
                                />
                                <span className="text-sm">
                                  {isDone ? "Concluído" : "Marcar como concluído"}
                                </span>
                              </label>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-8 bg-muted/30">
          <CardContent className="py-4 flex items-start gap-3 text-sm text-muted-foreground">
            <PlayCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>
              Em breve mais módulos. Sugira tópicos enviando uma mensagem para o suporte.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Treinamentos;
