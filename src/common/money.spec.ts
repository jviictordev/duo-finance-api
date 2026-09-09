import { describe, expect, it } from 'vitest';
import { Money } from './money';

describe('Money', () => {
  it('converte reais para centavos', () => {
    expect(Money.fromReais('124,30').cents).toBe(12430n);
    expect(Money.fromReais('124.3').cents).toBe(12430n);
    expect(Money.fromReais(10).cents).toBe(1000n);
    expect(Money.fromReais('-5,5').cents).toBe(-550n);
  });

  it('soma e subtrai sem perda', () => {
    const total = Money.fromCents(999n).add(Money.fromCents(1n));
    expect(total.cents).toBe(1000n);
  });

  it('divide em parcelas cuja soma bate com o total', () => {
    const parts = Money.fromCents(10_00n).splitInto(3);
    expect(parts.map((p) => p.cents)).toEqual([334n, 333n, 333n]);
    expect(parts.reduce((a, p) => a + p.cents, 0n)).toBe(1000n);
  });

  it('serializa como string de centavos', () => {
    expect(JSON.stringify({ v: Money.fromCents(500n) })).toBe('{"v":"500"}');
  });
});
