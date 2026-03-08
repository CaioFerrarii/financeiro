import { z } from 'zod';

// =====================================================
// VALIDADORES BRASILEIROS
// =====================================================

/**
 * Valida CPF brasileiro (11 dígitos)
 */
export function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  
  if (cleaned.length !== 11) return false;
  
  // Rejeita CPFs conhecidos como inválidos
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;
  
  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) return false;
  
  return true;
}

/**
 * Valida CNPJ brasileiro (14 dígitos)
 */
export function isValidCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  
  if (cleaned.length !== 14) return false;
  
  // Rejeita CNPJs conhecidos como inválidos
  if (/^(\d)\1{13}$/.test(cleaned)) return false;
  
  // Validação do primeiro dígito verificador
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned.charAt(i)) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cleaned.charAt(12))) return false;
  
  // Validação do segundo dígito verificador
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned.charAt(i)) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(cleaned.charAt(13))) return false;
  
  return true;
}

/**
 * Valida documento brasileiro (CPF ou CNPJ)
 */
export function isValidDocument(doc: string): boolean {
  const cleaned = doc.replace(/\D/g, '');
  if (cleaned.length === 11) return isValidCPF(cleaned);
  if (cleaned.length === 14) return isValidCNPJ(cleaned);
  return false;
}

/**
 * Valida email com regex mais seguro
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Valida telefone brasileiro
 */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  // Aceita: 10 dígitos (fixo) ou 11 dígitos (celular)
  return cleaned.length === 10 || cleaned.length === 11;
}

/**
 * Sanitiza string para prevenir XSS
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * Remove caracteres perigosos de input
 */
export function cleanInput(str: string): string {
  return str
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 500); // Limite de tamanho
}

// =====================================================
// SCHEMAS ZOD
// =====================================================

export const documentSchema = z.string()
  .min(11, 'Documento inválido')
  .max(18, 'Documento inválido')
  .refine(isValidDocument, {
    message: 'CPF ou CNPJ inválido'
  });

export const emailSchema = z.string()
  .email('Email inválido')
  .max(254, 'Email muito longo')
  .refine(isValidEmail, {
    message: 'Formato de email inválido'
  });

export const phoneSchema = z.string()
  .optional()
  .refine((val) => !val || isValidPhone(val), {
    message: 'Telefone inválido'
  });

export const passwordSchema = z.string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .max(72, 'A senha não pode ter mais de 72 caracteres')
  .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
  .regex(/[a-z]/, 'A senha deve conter pelo menos uma letra minúscula')
  .regex(/[0-9]/, 'A senha deve conter pelo menos um número');

export const nameSchema = z.string()
  .min(2, 'Nome deve ter pelo menos 2 caracteres')
  .max(100, 'Nome muito longo')
  .transform(cleanInput);

export const companyNameSchema = z.string()
  .min(2, 'Nome da empresa é obrigatório')
  .max(200, 'Nome da empresa muito longo')
  .transform(cleanInput);

export const addressSchema = z.string()
  .max(300, 'Endereço muito longo')
  .optional()
  .transform((val) => val ? cleanInput(val) : undefined);

// Schema completo para login
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

// Schema completo para assinatura
export const subscriptionFormSchema = z.object({
  // Dados do responsável
  fullName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  phone: phoneSchema,
  
  // Dados da empresa
  companyName: companyNameSchema,
  document: documentSchema,
  companyEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  companyPhone: phoneSchema,
  address: addressSchema,
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type SubscriptionFormData = z.infer<typeof subscriptionFormSchema>;
