import { CategoryKind } from '@prisma/client';

/** Categorias semeadas ao criar um espaço. */
export const DEFAULT_CATEGORIES: Array<{
  name: string;
  kind: CategoryKind;
  essential: boolean;
  icon: string;
}> = [
  { name: 'Moradia', kind: CategoryKind.EXPENSE, essential: true, icon: '🏠' },
  { name: 'Mercado', kind: CategoryKind.EXPENSE, essential: true, icon: '🛒' },
  { name: 'Contas de casa', kind: CategoryKind.EXPENSE, essential: true, icon: '💡' },
  { name: 'Transporte', kind: CategoryKind.EXPENSE, essential: true, icon: '🚗' },
  { name: 'Saúde', kind: CategoryKind.EXPENSE, essential: true, icon: '🩺' },
  { name: 'Educação', kind: CategoryKind.EXPENSE, essential: true, icon: '📚' },
  { name: 'Restaurante', kind: CategoryKind.EXPENSE, essential: false, icon: '🍔' },
  { name: 'Lazer', kind: CategoryKind.EXPENSE, essential: false, icon: '🎬' },
  { name: 'Compras', kind: CategoryKind.EXPENSE, essential: false, icon: '🛍️' },
  { name: 'Assinaturas', kind: CategoryKind.EXPENSE, essential: false, icon: '📺' },
  { name: 'Presentes', kind: CategoryKind.EXPENSE, essential: false, icon: '🎁' },
  { name: 'Outros', kind: CategoryKind.EXPENSE, essential: false, icon: '📦' },
  { name: 'Salário', kind: CategoryKind.INCOME, essential: true, icon: '💰' },
  { name: 'Renda extra', kind: CategoryKind.INCOME, essential: false, icon: '✨' },
];
