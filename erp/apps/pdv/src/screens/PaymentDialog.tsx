import { useEffect, useState } from 'react';
import { formatMoney } from '@soul/ui';
import { toCents } from '@soul/money';
import type { PaymentMethod, SalePaymentInput } from '@soul/contracts';
import { calculateChange, outstandingAmount } from '../lib/payment';
import { Overlay } from './WeightDialog';

const METHODS: Array<{ key: PaymentMethod; label: string; shortcut: string }> = [
  { key: 'cash', label: 'Dinheiro', shortcut: 'F5' },
  { key: 'debit', label: 'Débito', shortcut: 'F6' },
  { key: 'credit', label: 'Crédito', shortcut: 'F7' },
  { key: 'pix', label: 'Pix', shortcut: 'F8' },
];

const CARD_BRANDS = ['visa', 'master', 'elo', 'amex', 'outra'];

/**
 * Recebimento. Na v1 a maquininha é avulsa: o sistema registra bandeira e
 * parcelas informadas pelo atendente, marcando que o dado não foi capturado —
 * é isso que permite conciliar depois e medir o erro de digitação.
 */
export function PaymentDialog({
  totalCents,
  onConfirm,
  onCancel,
}: {
  totalCents: number;
  onConfirm: (payments: SalePaymentInput[], customerDocument?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [payments, setPayments] = useState<SalePaymentInput[]>([]);
  const [method, setMethod] = useState<PaymentMethod>('debit');
  const [amount, setAmount] = useState('');
  const [brand, setBrand] = useState('visa');
  const [document, setDocument] = useState('');
  const [busy, setBusy] = useState(false);

  const remaining = outstandingAmount(totalCents, payments);
  const change = calculateChange(totalCents, payments);
  const settled = remaining <= 0;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const shortcut = METHODS.find((entry) => entry.shortcut === event.key);
      if (shortcut) {
        event.preventDefault();
        setMethod(shortcut.key);
      }
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  function addPayment() {
    const value = amount ? safeCents(amount) : Math.max(remaining, 0);
    if (value <= 0) return;

    const isCard = method === 'credit' || method === 'debit';
    setPayments((current) => [
      ...current,
      {
        method,
        amountCents: value,
        changeCents: 0,
        captured: false,
        cardBrand: isCard ? brand : undefined,
        installments: 1,
      },
    ]);
    setAmount('');
  }

  async function confirm() {
    setBusy(true);
    try {
      // O troco é lançado no pagamento em dinheiro, que é de onde ele sai.
      const withChange = payments.map((payment) =>
        payment.method === 'cash' && change > 0 ? { ...payment, changeCents: change } : payment,
      );
      await onConfirm(withChange, document.length === 11 ? document : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold text-indigo">Receber</h2>
        <span className="font-display text-2xl font-bold tabular-nums text-violet">
          {formatMoney(totalCents)}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2">
        {METHODS.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setMethod(entry.key)}
            className={`rounded-xl border px-2 py-3 text-center transition ${
              method === entry.key
                ? 'border-violet bg-violet text-white'
                : 'border-lavender-400 bg-white text-indigo hover:border-violet'
            }`}
          >
            <span className="block font-display text-sm font-semibold">{entry.label}</span>
            <span className="font-mono text-[10px] opacity-70">{entry.shortcut}</span>
          </button>
        ))}
      </div>

      {(method === 'credit' || method === 'debit') && (
        <div className="mb-3">
          <label className="label" htmlFor="brand">
            Bandeira (maquininha avulsa)
          </label>
          <select id="brand" className="field" value={brand} onChange={(event) => setBrand(event.target.value)}>
            {CARD_BRANDS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <input
          className="field flex-1 tabular-nums"
          placeholder={remaining > 0 ? formatMoney(remaining) : '0,00'}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          autoFocus
        />
        <button className="btn-ghost" onClick={addPayment}>
          Lançar
        </button>
      </div>

      {payments.length > 0 && (
        <ul className="mb-3 divide-y divide-lavender-200 rounded-xl border border-lavender-200">
          {payments.map((payment, index) => (
            <li key={index} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-indigo">
                {METHODS.find((entry) => entry.key === payment.method)?.label}
                {payment.cardBrand ? ` · ${payment.cardBrand}` : ''}
              </span>
              <span className="flex items-center gap-3">
                <span className="font-mono tabular-nums text-indigo">{formatMoney(payment.amountCents)}</span>
                <button
                  className="font-mono text-[10px] uppercase text-danger"
                  onClick={() => setPayments(payments.filter((_, i) => i !== index))}
                >
                  tirar
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mb-4 flex justify-between font-mono text-sm">
        <span className="text-slate">{settled ? 'Troco' : 'Falta'}</span>
        <span className={`tabular-nums font-semibold ${settled ? 'text-success' : 'text-magenta'}`}>
          {formatMoney(settled ? change : remaining)}
        </span>
      </div>

      <label className="label" htmlFor="cpf">
        CPF na nota (opcional)
      </label>
      <input
        id="cpf"
        className="field mb-4 font-mono"
        value={document}
        onChange={(event) => setDocument(event.target.value.replace(/\D/g, '').slice(0, 11))}
        placeholder="somente números"
      />

      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={onCancel}>
          Voltar
        </button>
        <button className="btn-primary flex-1" disabled={!settled || busy} onClick={() => void confirm()}>
          {busy ? 'Registrando...' : 'Concluir venda'}
        </button>
      </div>
    </Overlay>
  );
}

function safeCents(value: string): number {
  try {
    return toCents(value);
  } catch {
    return 0;
  }
}
