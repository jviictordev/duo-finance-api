/**
 * Money — valor monetário em centavos inteiros (BigInt).
 * Toda aritmética de dinheiro passa por aqui. Nunca usar Float.
 *
 * Na serialização JSON os campos de dinheiro saem como STRING de centavos
 * inteiros (ver `BigInt.prototype.toJSON` em main.ts), então o front sempre
 * recebe algo como "12430" e formata para "R$ 124,30".
 */
export class Money {
  private constructor(public readonly cents: bigint) {}

  static zero(): Money {
    return new Money(0n);
  }

  static fromCents(cents: bigint | number | string): Money {
    return new Money(BigInt(cents));
  }

  /** Recebe reais com casas decimais ("124.30" ou 124.3) e converte para centavos. */
  static fromReais(reais: number | string): Money {
    const normalized =
      typeof reais === 'number' ? reais.toFixed(2) : reais.trim();
    const match = /^(-?)(\d+)(?:[.,](\d{1,2}))?$/.exec(normalized);
    if (!match) {
      throw new Error(`Valor monetário inválido: ${reais}`);
    }
    const [, sign, whole, frac = ''] = match;
    const centsStr = whole + frac.padEnd(2, '0');
    const value = BigInt(centsStr);
    return new Money(sign === '-' ? -value : value);
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  negate(): Money {
    return new Money(-this.cents);
  }

  abs(): Money {
    return new Money(this.cents < 0n ? -this.cents : this.cents);
  }

  isZero(): boolean {
    return this.cents === 0n;
  }

  isNegative(): boolean {
    return this.cents < 0n;
  }

  /**
   * Divide o valor em `n` parcelas inteiras em centavos, distribuindo o resto
   * nas primeiras parcelas (soma das parcelas === total).
   */
  splitInto(n: number): Money[] {
    if (n <= 0) throw new Error('Número de parcelas deve ser positivo');
    const base = this.cents / BigInt(n);
    const remainder = this.cents % BigInt(n);
    return Array.from({ length: n }, (_, i) =>
      new Money(base + (BigInt(i) < remainder ? 1n : 0n)),
    );
  }

  toString(): string {
    return this.cents.toString();
  }

  toJSON(): string {
    return this.cents.toString();
  }
}
