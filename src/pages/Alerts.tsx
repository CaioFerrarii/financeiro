import { useState, useEffect } from 'react';
import { Bell, Search, Filter, Eye, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useRequireCompany } from '@/hooks/useRequireCompany';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Alert {
  id: string;
  type: string;
  message: string;
  metadata: any;
  resolved: boolean;
  created_at: string;
  user_id: string;
  company_id: string | null;
}

const ALERT_TYPES = {
  create: { label: 'Criação', icon: CheckCircle, color: 'text-primary' },
  edit: { label: 'Edição', icon: Info, color: 'text-info' },
  delete: { label: 'Exclusão', icon: XCircle, color: 'text-destructive' },
  import: { label: 'Importação', icon: Info, color: 'text-info' },
  export: { label: 'Exportação', icon: Info, color: 'text-info' },
  duplicate: { label: 'Duplicidade', icon: AlertTriangle, color: 'text-warning' },
  api_sync: { label: 'Sincronização API', icon: Info, color: 'text-info' },
  login: { label: 'Login', icon: CheckCircle, color: 'text-primary' },
  logout: { label: 'Logout', icon: Info, color: 'text-muted-foreground' },
  system: { label: 'Sistema', icon: Info, color: 'text-muted-foreground' },
  transaction_created: { label: 'Criação', icon: CheckCircle, color: 'text-primary' },
  transaction_edited: { label: 'Edição', icon: Info, color: 'text-info' },
  transaction_deleted: { label: 'Exclusão', icon: XCircle, color: 'text-destructive' },
  import_completed: { label: 'Importação', icon: CheckCircle, color: 'text-primary' },
  export_completed: { label: 'Exportação', icon: CheckCircle, color: 'text-primary' },
  duplicate_detected: { label: 'Duplicidade', icon: AlertTriangle, color: 'text-warning' },
};

export default function Alerts() {
  const { user } = useAuth();
  const { company } = useCompany();
  const { companyId, isReady } = useRequireCompany();
  const { toast } = useToast();
  
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  useEffect(() => {
    if (!isReady || !companyId) return;
    
    fetchAlerts();
    setupRealtimeSubscription();
  }, [isReady, companyId]);

  const setupRealtimeSubscription = () => {
    if (!companyId) return;
    
    const channel = supabase
      .channel('alerts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          setAlerts(prev => [payload.new as Alert, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchAlerts = async () => {
    if (!companyId) return;
    
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os alertas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsResolved = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ resolved: true })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(prev => 
        prev.map(a => a.id === alertId ? { ...a, resolved: true } : a)
      );

      toast({
        title: 'Marcado como resolvido',
        description: 'Alerta marcado como resolvido.',
      });
    } catch (error) {
      console.error('Error updating alert:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o alerta.',
        variant: 'destructive',
      });
    }
  };

  const getAlertTypeConfig = (type: string) => {
    return ALERT_TYPES[type as keyof typeof ALERT_TYPES] || ALERT_TYPES.system;
  };

  const formatMetadata = (metadata: any): string => {
    if (!metadata) return '-';
    try {
      return JSON.stringify(metadata, null, 2);
    } catch {
      return String(metadata);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = 
      alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || alert.type === filterType;
    const matchesMonth = filterMonth === 'all' || 
      alert.created_at.substring(0, 7) === filterMonth;
    return matchesSearch && matchesType && matchesMonth;
  });

  const months = [...new Set(alerts.map(a => a.created_at.substring(0, 7)))].sort().reverse();

  const totalAlerts = alerts.length;
  const unresolvedAlerts = alerts.filter(a => !a.resolved).length;
  const duplicateAlerts = alerts.filter(a => a.type === 'duplicate_detected' || a.type === 'duplicate').length;
  const todayAlerts = alerts.filter(a => 
    a.created_at.startsWith(new Date().toISOString().split('T')[0])
  ).length;

  if (!company) {
    return (
      <div className="p-6 lg:p-8">
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Empresa não configurada</h2>
          <p className="text-muted-foreground">
            Configure sua empresa para acessar esta funcionalidade.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Alarmes
          </h1>
          <p className="text-muted-foreground">
            Histórico de ações e alertas do sistema
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalAlerts}</p>
              <p className="text-sm text-muted-foreground">Total de alertas</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{unresolvedAlerts}</p>
              <p className="text-sm text-muted-foreground">Não resolvidos</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{duplicateAlerts}</p>
              <p className="text-sm text-muted-foreground">Duplicidades</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <Info className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{todayAlerts}</p>
              <p className="text-sm text-muted-foreground">Hoje</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar alertas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(ALERT_TYPES).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {format(new Date(m + '-01'), 'MMMM yyyy', { locale: ptBR })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Alerts Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="min-w-[300px]">Mensagem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredAlerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum alerta encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAlerts.map((alert) => {
                  const typeConfig = getAlertTypeConfig(alert.type);
                  const IconComponent = typeConfig.icon;
                  
                  return (
                    <TableRow key={alert.id} className={alert.resolved ? 'opacity-60' : ''}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {format(new Date(alert.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <IconComponent className={`h-4 w-4 ${typeConfig.color}`} />
                          <Badge variant="outline" className="font-normal">
                            {typeConfig.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {alert.message}
                      </TableCell>
                      <TableCell>
                        {alert.resolved ? (
                          <Badge variant="secondary" className="bg-muted">
                            Resolvido
                          </Badge>
                        ) : (
                          <Badge variant="default" className="bg-warning/10 text-warning border-warning/20">
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedAlert(alert)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {!alert.resolved && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => markAsResolved(alert.id)}
                              className="text-primary hover:text-primary"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Alert Details Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {selectedAlert && (
                <>
                  {(() => {
                    const config = getAlertTypeConfig(selectedAlert.type);
                    const Icon = config.icon;
                    return <Icon className={`h-5 w-5 ${config.color}`} />;
                  })()}
                  Detalhes do Alerta
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedAlert && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Data/Hora</p>
                  <p className="font-medium">
                    {format(new Date(selectedAlert.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <p className="font-medium">
                    {getAlertTypeConfig(selectedAlert.type).label}
                  </p>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Mensagem</p>
                <p className="font-medium">{selectedAlert.message}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={selectedAlert.resolved ? 'secondary' : 'default'}>
                  {selectedAlert.resolved ? 'Resolvido' : 'Pendente'}
                </Badge>
              </div>
              
              {selectedAlert.metadata && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Metadados</p>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-60">
                    {formatMetadata(selectedAlert.metadata)}
                  </pre>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                {!selectedAlert.resolved && (
                  <Button 
                    onClick={() => {
                      markAsResolved(selectedAlert.id);
                      setSelectedAlert(null);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Marcar como resolvido
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedAlert(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
