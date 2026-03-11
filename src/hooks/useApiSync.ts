// src/hooks/useApiSync.ts
// Hook para gerenciar o estado de sync por conexão de API

import { useState, useCallback } from 'react';
import { syncMarketplace, isMercadoLivreConnected, getMercadoLivreAuthUrl, SyncResult } from '@/lib/marketplaceSync';
import { useToast } from '@/hooks/use-toast';

interface ApiConnection {
  id: string;
  platform: string;
  api_key: string;
  api_secret: string;
  access_token: string;
  is_active: boolean;
}

export function useApiSync(companyId: string | null) {
  const { toast } = useToast();
  // syncingIds: set de connection IDs que estão sincronizando agora
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [lastResults, setLastResults] = useState<Record<string, SyncResult>>({});

  const isSyncing = (connectionId: string) => syncingIds.has(connectionId);

  const syncConnection = useCallback(async (
    connection: ApiConnection,
    onSuccess?: () => void
  ) => {
    if (!companyId || syncingIds.has(connection.id)) return;

    // Mercado Livre precisa de OAuth — verificar antes
    if (connection.platform === 'mercado_livre') {
      const connected = await isMercadoLivreConnected(companyId);
      if (!connected) {
        toast({
          title: 'Autenticação necessária',
          description: 'Você precisa autorizar o Mercado Livre antes de sincronizar.',
          variant: 'destructive',
        });
        // Redirecionar para OAuth
        window.location.href = getMercadoLivreAuthUrl(companyId);
        return;
      }
    }

    setSyncingIds(prev => new Set(prev).add(connection.id));

    try {
      const result = await syncMarketplace(companyId, connection);

      setLastResults(prev => ({ ...prev, [connection.id]: result }));

      if (result.success) {
        toast({
          title: `✅ ${platformLabel(connection.platform)} sincronizado!`,
          description: `${result.ordersImported} pedidos importados · ${result.transactionsCreated} transações criadas`,
        });
        onSuccess?.();
      } else {
        toast({
          title: `Erro ao sincronizar ${platformLabel(connection.platform)}`,
          description: result.errorMessage || 'Tente novamente.',
          variant: 'destructive',
        });
      }
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(connection.id);
        return next;
      });
    }
  }, [companyId, syncingIds, toast]);

  // Sincronizar TODAS as conexões ativas de uma vez
  const syncAll = useCallback(async (
    connections: ApiConnection[],
    onSuccess?: () => void
  ) => {
    const active = connections.filter(c => c.is_active);
    await Promise.allSettled(active.map(c => syncConnection(c, onSuccess)));
  }, [syncConnection]);

  // Iniciar OAuth do ML (sem precisar de conexão existente)
  const connectMercadoLivre = useCallback((connectionId?: string) => {
    if (!companyId) return;
    // Salvar connectionId no state para atualizar last_sync_at após retorno
    if (connectionId) sessionStorage.setItem('ml_pending_connection_id', connectionId);
    window.location.href = getMercadoLivreAuthUrl(companyId);
  }, [companyId]);

  return {
    isSyncing,
    lastResults,
    syncConnection,
    syncAll,
    connectMercadoLivre,
  };
}

function platformLabel(platform: string): string {
  const labels: Record<string, string> = {
    mercado_livre: 'Mercado Livre',
    shopee: 'Shopee',
    magalu: 'Magalu',
    loja_integrada: 'Loja Integrada',
  };
  return labels[platform] || platform;
}
