import type { CustomFieldDefinition } from "@/hooks/useCustomFields";
import type { FieldRequiredRule } from "@/hooks/useFieldRequiredRules";
import type { FunnelStage } from "@/hooks/useFunnels";

/**
 * Verifica se um valor de campo personalizado está "preenchido".
 * Strings vazias, arrays vazios, null e undefined são considerados não-preenchidos.
 * Booleans (false) são considerados preenchidos (foi uma escolha consciente do usuário).
 */
export function isFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  return true;
}

/**
 * Retorna a lista de campos personalizados (do tipo "lead") que são obrigatórios
 * para uma etapa específica de um funil específico.
 *
 * Considera:
 *  1. `is_required` global (sempre obrigatório, em qualquer etapa);
 *  2. Regras `custom_field_required_rules` cujo `funnel_id` bate e cuja
 *     `from_stage` tem `display_order <= stage atual`.
 */
export function getRequiredFieldsForStage(params: {
  funnelId: string;
  stageId: string;
  stages: FunnelStage[];
  fieldDefinitions: CustomFieldDefinition[];
  rules: FieldRequiredRule[];
}): CustomFieldDefinition[] {
  const { funnelId, stageId, stages, fieldDefinitions, rules } = params;

  const targetStage = stages.find((s) => s.id === stageId);
  if (!targetStage) return [];

  // Mapa stage_id -> display_order para resolver "a partir de"
  const stageOrder = new Map<string, number>();
  for (const s of stages) stageOrder.set(s.id, s.display_order);

  const result: CustomFieldDefinition[] = [];
  const seen = new Set<string>();

  for (const field of fieldDefinitions) {
    if (field.entity_type !== "lead") continue;

    // Sempre obrigatório (switch global)
    if (field.is_required) {
      if (!seen.has(field.id)) {
        result.push(field);
        seen.add(field.id);
      }
      continue;
    }

    // Regras condicionais por funil/etapa
    const rule = rules.find(
      (r) => r.field_definition_id === field.id && r.funnel_id === funnelId,
    );
    if (!rule) continue;

    const fromOrder = stageOrder.get(rule.from_stage_id);
    if (fromOrder === undefined) continue;

    if (targetStage.display_order >= fromOrder) {
      if (!seen.has(field.id)) {
        result.push(field);
        seen.add(field.id);
      }
    }
  }

  return result;
}

/**
 * Retorna apenas os campos obrigatórios cujo valor está vazio.
 */
export function getMissingRequiredFields(params: {
  funnelId: string;
  stageId: string;
  stages: FunnelStage[];
  fieldDefinitions: CustomFieldDefinition[];
  rules: FieldRequiredRule[];
  values: Record<string, unknown>;
}): CustomFieldDefinition[] {
  const required = getRequiredFieldsForStage(params);
  return required.filter((f) => !isFieldFilled(params.values?.[f.field_key]));
}
