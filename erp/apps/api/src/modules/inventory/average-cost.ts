/**
 * Custo médio ponderado.
 *
 * Isolado da persistência porque é a conta que erra em silêncio: um custo médio
 * errado não quebra nada, só mente na margem de todo relatório até alguém
 * desconfiar meses depois.
 */
export function weightedAverageCost(input: {
  /** Saldo antes da entrada, somando as lojas. Pode ser negativo. */
  quantityBefore: number;
  averageCostCentsBefore: number;
  quantityIn: number;
  unitCostCentsIn: number;
}): number {
  const { quantityBefore, averageCostCentsBefore, quantityIn, unitCostCentsIn } = input;

  // Sem saldo anterior — ou com saldo negativo — não há média a ponderar. O
  // negativo puxaria o resultado para um número sem sentido, às vezes negativo;
  // o custo da entrada é a melhor verdade disponível.
  if (quantityBefore <= 0) return unitCostCentsIn;

  const total = quantityBefore + quantityIn;
  if (total <= 0) return unitCostCentsIn;

  return Math.round((quantityBefore * averageCostCentsBefore + quantityIn * unitCostCentsIn) / total);
}
