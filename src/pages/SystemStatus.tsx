import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRequireCompany } from '@/hooks/useRequireCompany';
import { useCompany } from '@/hooks/useCompany';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  RefreshCw,
  Server,
  Shield,
  XCircle,
  Copy,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface SystemLog {
  id: string;
  type: string;
  message: string;
  endpoint: string | null;
  metadata: any;
  created_at: string;
}

interface ApiConnectionStatus {
  id: string;
  platform: string;
  is_active: boolean;
  last_sync_at: string | null;
}

interface DuplicateResult {
  transaction_id: string;
  duplicate_of: string;
  amount: number;
  date: string;
  description: string;
  similarity_score: number;
}

interface BackupEntry {
  id: string;
  backup_type: string;
  tables_backed_up: string[];
  row_counts: any;
  status: string;
  started_at: string;
  completed_at: string | null;
}

export default function SystemStatus() {
  const { companyId, isReady } = useRequireCompany();
  const { isAdmin } = useCompany();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [apiConnections, setApiConnections] = useState<ApiConnectionStatus[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateResult[]>([]);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [dbHealthy, setDbHealthy] = useState<boolean | null>(null);

  const fetchAll = useCallback(async () => {
    if (!isReady || !companyId) return;
    setRefreshing(true);

    try {
      // 1. Measure backend response time
      const t0 = performance.now();
      const { error: pingErr } = await supabase.from('companies').select('id').eq('id', companyId).single();
      const t1 = performance.now();
      setResponseTime(Math.round(t1 - t0));
      setDbHealthy(!pingErr);

      // 2. Fetch recent system logs
      const { data: logsData } = await supabase
        .from('system_logs' as any)
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50);
      setLogs((logsData as any[]) || []);

      // 3. Fetch API connection statuses
      const { data: apiData } = await supabase
        .from('api_connections')
        .select('id, platform, is_active, last_sync_at')
        .eq('company_id', companyId);
      setApiConnections(apiData || []);

      // 4. Check duplicate transactions
      const { data: dupData } = await supabase.rpc('check_duplicate_transactions' as any, {
        p_company_id: companyId,
      });
      setDuplicates((dupData as any[]) || []);

      // 5. Fetch backup history
      const { data: backupData } = await supabase
        .from('backup_history' as any)
        .select('*')
        .eq('company_id', companyId)
        .order('started_at', { ascending: false })
        .limit(10);
      setBackups((backupData as any[]) || []);
    } catch (err) {
      console.error('Error fetching system status:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isReady, companyId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <Shield className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const errorCount = logs.filter(l => l.type === 'error').length;
  const warningCount = logs.filter(l => l.type === 'warning').length;

  const typeColor = (type: string) => {
    switch (type) {
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      case 'info': return 'outline';
      case 'sync': return 'default';
      case 'backup': return 'default';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Status do Sistema</h1>
          <p className="text-muted-foreground">Monitoramento e integridade do sistema</p>
        </div>
        <Button onClick={fetchAll} disabled={refreshing} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${dbHealthy ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                {dbHealthy ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Backend</p>
                <p className="text-lg font-bold text-foreground">
                  {dbHealthy === null ? '...' : dbHealthy ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tempo de Resposta</p>
                <p className="text-lg font-bold text-foreground">
                  {responseTime !== null ? `${responseTime}ms` : '...'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${errorCount > 0 ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                <AlertTriangle className={`h-5 w-5 ${errorCount > 0 ? 'text-destructive' : 'text-primary'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Erros Recentes</p>
                <p className="text-lg font-bold text-foreground">{errorCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${duplicates.length > 0 ? 'bg-accent/50' : 'bg-primary/10'}`}>
                <Copy className={`h-5 w-5 ${duplicates.length > 0 ? 'text-accent-foreground' : 'text-primary'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duplicatas</p>
                <p className="text-lg font-bold text-foreground">{duplicates.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="integrations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="duplicates">Duplicatas</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
        </TabsList>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Status das Integrações
              </CardTitle>
              <CardDescription>Conexões de API e última sincronização</CardDescription>
            </CardHeader>
            <CardContent>
              {apiConnections.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4">Nenhuma integração configurada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plataforma</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Última Sincronização</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiConnections.map((conn) => (
                      <TableRow key={conn.id}>
                        <TableCell className="font-medium capitalize">{conn.platform.replace('_', ' ')}</TableCell>
                        <TableCell>
                          <Badge variant={conn.is_active ? 'default' : 'destructive'}>
                            {conn.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {conn.last_sync_at
                            ? format(new Date(conn.last_sync_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : 'Nunca'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Duplicates Tab */}
        <TabsContent value="duplicates">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Copy className="h-5 w-5" />
                Transações Duplicadas
              </CardTitle>
              <CardDescription>Transações com mesmo valor, data e descrição semelhante</CardDescription>
            </CardHeader>
            <CardContent>
              {duplicates.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4">Nenhuma duplicata encontrada. ✓</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Similaridade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {duplicates.map((dup, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{dup.description}</TableCell>
                        <TableCell>R$ {Number(dup.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          {format(new Date(dup.date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={Number(dup.similarity_score) >= 0.95 ? 'destructive' : 'secondary'}>
                            {Math.round(Number(dup.similarity_score) * 100)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Logs do Sistema
              </CardTitle>
              <CardDescription>Últimos 50 registros de erro e eventos</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4">Nenhum log registrado.</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                      <Badge variant={typeColor(log.type) as any} className="mt-0.5 shrink-0">
                        {log.type}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{log.message}</p>
                        {log.endpoint && (
                          <p className="text-xs text-muted-foreground mt-1">Endpoint: {log.endpoint}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backups Tab */}
        <TabsContent value="backups">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Histórico de Backups
              </CardTitle>
              <CardDescription>Backups diários automáticos</CardDescription>
            </CardHeader>
            <CardContent>
              {backups.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4">Nenhum backup registrado ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tabelas</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Registros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backups.map((bk) => (
                      <TableRow key={bk.id}>
                        <TableCell>
                          {format(new Date(bk.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {bk.tables_backed_up?.join(', ') || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={bk.status === 'completed' ? 'default' : bk.status === 'failed' ? 'destructive' : 'secondary'}>
                            {bk.status === 'completed' ? 'Concluído' : bk.status === 'failed' ? 'Falhou' : 'Pendente'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {bk.row_counts ? JSON.stringify(bk.row_counts) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
