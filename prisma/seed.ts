import { PrismaClient, TaxType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed idempotente. Popula as tabelas de INSS/IRRF com vigência.
 * Valores: competência 2025 (INSS a partir de 01/2025, IRRF a partir de 05/2025).
 * Ao mudar a legislação, adicionar uma nova linha com effectiveFrom e fechar a
 * anterior com effectiveTo — nunca editar a vigente.
 */
async function seedTaxTables() {
  const inssFrom = new Date('2025-01-01T00:00:00Z');
  const existingInss = await prisma.taxTable.findFirst({
    where: { type: TaxType.INSS, effectiveFrom: inssFrom },
  });
  if (!existingInss) {
    await prisma.taxTable.create({
      data: {
        type: TaxType.INSS,
        effectiveFrom: inssFrom,
        effectiveTo: null,
        perDependentDeductionCents: 0n,
        brackets: [
          { upToCents: 151_800, rate: 0.075 },
          { upToCents: 279_388, rate: 0.09 },
          { upToCents: 419_083, rate: 0.12 },
          { upToCents: 815_741, rate: 0.14 },
        ],
      },
    });
    console.log('seed: INSS 2025 criada');
  }

  const irrfFrom = new Date('2025-05-01T00:00:00Z');
  const existingIrrf = await prisma.taxTable.findFirst({
    where: { type: TaxType.IRRF, effectiveFrom: irrfFrom },
  });
  if (!existingIrrf) {
    await prisma.taxTable.create({
      data: {
        type: TaxType.IRRF,
        effectiveFrom: irrfFrom,
        effectiveTo: null,
        perDependentDeductionCents: 18_959n,
        brackets: [
          { upToCents: 242_880, rate: 0, deductionCents: 0 },
          { upToCents: 282_665, rate: 0.075, deductionCents: 18_216 },
          { upToCents: 375_105, rate: 0.15, deductionCents: 39_416 },
          { upToCents: 466_468, rate: 0.225, deductionCents: 67_549 },
          { upToCents: null, rate: 0.275, deductionCents: 90_873 },
        ],
      },
    });
    console.log('seed: IRRF 2025 criada');
  }
}

async function main() {
  await seedTaxTables();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
