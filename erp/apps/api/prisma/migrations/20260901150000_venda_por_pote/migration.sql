-- Venda por pote, sem balança e sem TEF integrado.
--
-- O produto passa a ser sempre vendido por unidade (pote, casquinha, bebida),
-- então some a marcação de venda por peso. O pagamento acontece fora do sistema
-- — dinheiro, Pix ou maquineta — e é lançado pelo operador, então somem também
-- os campos que só fariam sentido com captura automática da adquirente.
--
-- Migração aditiva por remoção de coluna: nenhuma linha é apagada.

ALTER TABLE "product" DROP COLUMN IF EXISTS "sold_by_weight";

ALTER TABLE "sale_item" DROP COLUMN IF EXISTS "weighed";

ALTER TABLE "sale_payment" DROP COLUMN IF EXISTS "captured";
ALTER TABLE "sale_payment" DROP COLUMN IF EXISTS "authorization_code";

ALTER TABLE "terminal_heartbeat" DROP COLUMN IF EXISTS "scale_ok";
