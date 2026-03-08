import { z } from 'zod';
import { cleanInput } from '@/lib/validators';

/**
 * Validates transaction data before insert/update.
 * Ensures company_id is present, amount is positive, and date is valid.
 */
export const transactionDataSchema = z.object({
  user_id: z.string().uuid('user_id inválido'),
  company_id: z.string().uuid('company_id é obrigatório'),
  description: z.string().min(1, 'Descrição é obrigatória').max(500).transform(cleanInput),
  amount: z.number().positive('Valor deve ser positivo'),
  type: z.enum(['income', 'expense'], { errorMap: () => ({ message: 'Tipo deve ser income ou expense' }) }),
  date: z.string().refine((val) => {
    const d = new Date(val);
    return !isNaN(d.getTime());
  }, 'Data inválida'),
  category_id: z.string().uuid().nullable().optional(),
  source: z.string().max(200).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export type ValidatedTransactionData = z.infer<typeof transactionDataSchema>;

/**
 * Validates and returns sanitized transaction data, or throws with user-friendly message.
 */
export function validateTransactionData(data: Record<string, any>): ValidatedTransactionData {
  return transactionDataSchema.parse(data);
}

/**
 * Category data validation
 */
export const categoryDataSchema = z.object({
  user_id: z.string().uuid('user_id inválido'),
  company_id: z.string().uuid('company_id é obrigatório'),
  name: z.string().min(1, 'Nome é obrigatório').max(100).transform(cleanInput),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida'),
  icon: z.string().max(50).nullable().optional(),
  keywords: z.array(z.string().max(50)).optional(),
});

export type ValidatedCategoryData = z.infer<typeof categoryDataSchema>;

export function validateCategoryData(data: Record<string, any>): ValidatedCategoryData {
  return categoryDataSchema.parse(data);
}
