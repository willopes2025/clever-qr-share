

# Correção: Template enviado duas vezes no Inbox

## Problema

Ao selecionar um template (especialmente com mídia) via comando `/` e pressionar Enter, o sistema envia a mensagem **duas vezes**. Isso acontece porque o evento `keydown` do Enter pode disparar em repetição (key repeat) antes do React re-renderizar, causando duas chamadas ao `handleSlashSelect`.

## Causa Raiz

No `handleKeyDown`, quando o Enter é pressionado com o menu slash aberto:
1. Primeiro `keydown` chama `handleSlashSelect` (async) e define `setSlashCommandOpen(false)`
2. React **ainda não re-renderizou** -- o estado `slashCommandOpen` continua `true` na closure atual
3. O key repeat do Enter dispara um segundo `keydown` na mesma closure
4. `slashCommandOpen` ainda é `true` → `handleSlashSelect` é chamado **novamente**
5. Resultado: duas mensagens de texto + duas mídias enviadas

## Solução

Adicionar uma **ref de guarda** (`isProcessingSlashRef`) para impedir re-entrada no `handleSlashSelect`:

### Mudanças em `src/components/inbox/MessageView.tsx`

1. **Adicionar ref de controle**:
```typescript
const isProcessingSlashRef = useRef(false);
```

2. **Proteger `handleSlashSelect`** com early return se já estiver processando:
```typescript
const handleSlashSelect = async (template: MessageTemplate) => {
  if (isProcessingSlashRef.current) return; // Guard against re-entry
  isProcessingSlashRef.current = true;
  
  try {
    // ... existing logic ...
  } finally {
    isProcessingSlashRef.current = false;
  }
};
```

3. **Proteger `handleKeyDown`** adicionando verificação da ref antes de chamar handleSlashSelect:
```typescript
if (e.key === "Enter" || e.key === "Tab") {
  e.preventDefault();
  if (isProcessingSlashRef.current) return; // Prevent double-fire
  // ... rest of selection logic
}
```

Essa abordagem resolve o problema sem alterar o fluxo existente, usando uma ref (síncrona e imediata) ao invés de depender do estado React (assíncrono).

