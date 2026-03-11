// src/lib/marketplaceSync.ts
// Serviço central de sincronização de marketplaces
// Cada plataforma tem sua própria lógica de sync via Edge Function

import { supabase } from '@/integrations/supabase/client';

export type SyncPlatform = 'mercado_livre' | 'shopee' | 'magalu' | 'loja_integrada';

export interface SyncResult {
  success: boolean;
  platform: SyncPlatform;
  ordersImported: number;
  transactionsCreated: number;
  errorMessage?: string;
}

export interface SyncStatus {
  connectionId: string;
  platform: SyncPlatform;
  syncing: boolean;
  lastResult?: SyncResult;
}

// ─── Mercado Livre: usa OAuth (token já salvo em ml_tokens) ─────────────────
async function syncMercadoLivre(companyId: string, daysBack = 30): Promise<SyncResult> {
  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ml-sync`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ company_id: companyId, days_back: daysBack }),
    }
  );

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Erro na sincronização com Mercado Livre');

  return {
    success: true,
    platform: 'mercado_livre',
    ordersImported: data.orders_synced || 0,
    transactionsCreated: data.transactions_created || 0,
  };
}

// ─── Shopee: usa API Key + Secret ────────────────────────────────────────────
async function syncShopee(companyId: string, connection: ApiConnectionRow): Promise<SyncResult> {
  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopee-sync`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        company_id: companyId,
        api_key: connection.api_key,
        api_secret: connection.api_secret,
        days_back: 30,
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro na sincronização com Shopee');

  return {
    success: true,
    platform: 'shopee',
    ordersImported: data.orders_synced || 0,
    transactionsCreated: data.transactions_created || 0,
  };
}

// ─── Magalu: usa API Key ──────────────────────────────────────────────────────
async function syncMagalu(companyId: string, connection: ApiConnectionRow): Promise<SyncResult> {
  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/magalu-sync`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        company_id: companyId,
        api_key: connection.api_key,
        days_back: 30,
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro na sincronização com Magalu');

  return {
    success: true,
    platform: 'magalu',
    ordersImported: data.orders_synced || 0,
    transactionsCreated: data.transactions_created || 0,
  };
}

// ─── Loja Integrada: usa API Key + Access Token ───────────────────────────────
async function syncLojaIntegrada(companyId: string, connection: ApiConnectionRow): Promise<SyncResult> {
  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/loja-integrada-sync`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        company_id: companyId,
        api_key: connection.api_key,
        access_token: connection.access_token,
        days_back: 30,
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro na sincronização com Loja Integrada');

  return {
    success: true,
    platform: 'loja_integrada',
    ordersImported: data.orders_synced || 0,
    transactionsCreated: data.transactions_created || 0,
  };
}

// ─── Tipo interno ─────────────────────────────────────────────────────────────
interface ApiConnectionRow {
  id: string;
  platform: string;
  api_key: string;
  api_secret: string;
  access_token: string;
}

// ─── Dispatcher principal ─────────────────────────────────────────────────────
export async function syncMarketplace(
  companyId: string,
  connection: ApiConnectionRow
): Promise<SyncResult> {
  const platform = connection.platform as SyncPlatform;

  try {
    let result: SyncResult;

    switch (platform) {
      case 'mercado_livre':
        result = await syncMercadoLivre(companyId);
        break;
      case 'shopee':
        result = await syncShopee(companyId, connection);
        break;
      case 'magalu':
        result = await syncMagalu(companyId, connection);
        break;
      case 'loja_integrada':
        result = await syncLojaIntegrada(companyId, connection);
        break;
      default:
        throw new Error(`Plataforma "${platform}" não suportada ainda`);
    }

    // Atualizar last_sync_at na conexão
    await supabase
      .from('api_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id);

    return result;

  } catch (err: any) {
    return {
      success: false,
      platform,
      ordersImported: 0,
      transactionsCreated: 0,
      errorMessage: err.message,
    };
  }
}

// ─── Verificar se ML está autenticado via OAuth ───────────────────────────────
export async function isMercadoLivreConnected(companyId: string): Promise<boolean> {
  const { data } = await supabase
    .from('ml_tokens' as any)
    .select('id, expires_at')
    .eq('company_id', companyId)
    .maybeSingle();

  return !!data;
}

// ─── Gerar URL OAuth do Mercado Livre ─────────────────────────────────────────
export function getMercadoLivreAuthUrl(companyId: string): string {
  const appId = import.meta.env.VITE_ML_APP_ID;
  const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ml-oauth-callback`;
  return `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${companyId}`;
}
