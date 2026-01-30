
# Plano: Melhorar Resiliência da Geração de Relatório de Análise

## Problema Identificado

O relatório de análise foi gerado com sucesso no backend, mas o usuário viu uma mensagem de erro porque:

1. A Edge Function demorou ~2 minutos para processar (250 conversas, 1000 mensagens, transcrição de áudios)
2. A conexão HTTP foi fechada pelo navegador antes de receber a resposta
3. O frontend mostrou "Failed to send a request to the Edge Function"
4. A lista de relatórios não foi atualizada após o "erro"

**Evidência dos logs:**
```
18:42:20 - Started analysis, 250 conversations
18:43:55 - Calling AI for analysis
18:45:03 - Successfully parsed tool call response
18:45:05 - ERROR: Http connection closed before message completed
```

O relatório está lá (ID: `3765b99d-0d03-4c7d-ba35-6a6897ad5984`, nota: 58/100). Só não apareceu na lista porque o cache não foi invalidado.

## Solução Proposta

### 1. Invalidar cache após erro (recuperação automática)

Mesmo quando ocorre erro na chamada, verificar se um relatório foi criado e atualizar a lista:

```typescript
// useAnalysisReports.ts
} catch (error: any) {
  console.error('Error generating report:', error);
  toast.error(error.message || 'Erro ao gerar relatório');
  
  // Mesmo com erro, recarregar lista - o relatório pode ter sido criado
  queryClient.invalidateQueries({ queryKey: ['analysis-reports'] });
  
  return null;
} finally {
```

### 2. Adicionar polling para relatórios em processamento

Se o usuário iniciar uma geração, verificar periodicamente se completou:

```typescript
// Após iniciar geração, fazer polling a cada 15s
useEffect(() => {
  const processingReports = reports?.filter(r => r.status === 'processing');
  if (!processingReports?.length) return;
  
  const interval = setInterval(() => {
    refetch();
  }, 15000); // 15 segundos
  
  return () => clearInterval(interval);
}, [reports, refetch]);
```

### 3. Melhorar feedback ao usuário

Mostrar mensagem mais informativa quando há timeout:

```typescript
// Detectar erro de timeout
const isTimeoutError = error.message?.includes('Failed to fetch') || 
                       error.message?.includes('connection closed');

if (isTimeoutError) {
  toast.info('A análise está sendo processada. Atualize a página em alguns minutos.');
} else {
  toast.error(error.message || 'Erro ao gerar relatório');
}
```

## Arquivos a Modificar

1. **`src/hooks/useAnalysisReports.ts`**
   - Adicionar invalidação do cache no bloco `catch`
   - Adicionar polling para relatórios em processamento
   - Melhorar mensagem de erro para timeouts

## Alterações Técnicas

### useAnalysisReports.ts

```typescript
// 1. Adicionar useEffect para polling
useEffect(() => {
  const processingReports = reports?.filter(r => r.status === 'processing');
  if (!processingReports?.length) return;
  
  const interval = setInterval(() => {
    refetch();
  }, 15000);
  
  return () => clearInterval(interval);
}, [reports, refetch]);

// 2. Modificar catch block do generateReport
} catch (error: any) {
  console.error('Error generating report:', error);
  
  const isTimeoutError = /failed to fetch|connection|timeout|aborted/i.test(
    error.message || ''
  );
  
  if (isTimeoutError) {
    toast.info('A análise está sendo processada em segundo plano. A página será atualizada automaticamente.', {
      duration: 8000,
    });
  } else {
    toast.error(error.message || 'Erro ao gerar relatório');
  }
  
  // Sempre invalidar cache - relatório pode ter sido criado mesmo com erro
  queryClient.invalidateQueries({ queryKey: ['analysis-reports'] });
  
  return null;
}
```

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Timeout durante geração | Erro, lista não atualiza | Mensagem informativa, lista atualiza automaticamente |
| Relatório em "Processando" | Fica parado até refresh manual | Atualiza automaticamente a cada 15s |
| Erro de conexão | Lista desatualizada | Cache invalidado, lista recarrega |

## Ação Imediata

Para o relatório que já foi gerado, basta **atualizar a página** (F5) que ele aparecerá na lista com nota 58/100.
