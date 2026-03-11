import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useRequireCompany } from '@/hooks/useRequireCompany';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'react-router-dom';
import { useApiSync } from '@/hooks/useApiSync';
import { isMercadoLivreConnected, getMercadoLivreAuthUrl } from '@/lib/marketplaceSync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Settings as SettingsIcon,
  Users,
  Target,
  Clock,
  Link2,
  Database,
  Plus,
  Trash2,
  Save,
  Download,
  Upload,
  Eye,
  EyeOff,
  Store,
  Building2,
  CreditCard,
  Crown,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AuthorizedEmail {
  id: string;
  email: string;
  created_at: string;
}

interface UserSettings {
  id?: string;
  monthly_revenue_goal: number;
  max_expense_goal: number;
  sync_frequency: string;
}

interface ApiConnection {
  id: string;
  platform: string;
  api_key: string;
  api_secret: string;
  access_token: string;
  is_active: boolean;
  last_sync_at: string | null;
}

interface Company {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface Subscription {
  id: string;
  plano: string;
  valor: number;
  status: 'ativo' | 'suspenso' | 'cancelado';
  data_ativacao: string;
  data_renovacao: string;
}

interface CompanyUser {
  user_id: string;
  role: 'admin' | 'financeiro' | 'leitura';
  email?: string;
  full_name?: string;
}

const platforms = [
  { name: 'Mercado Livre', value: 'mercado_livre', icon: Store },
  { name: 'Shopee', value: 'shopee', icon: Store },
  { name: 'Magalu', value: 'magalu', icon: Store },
  { name: 'Loja Integrada', value: 'loja_integrada', icon: Store },
];

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  financeiro: 'Financeiro',
  leitura: 'Somente Leitura',
};

export default function Settings() {
  const { user } = useAuth();
  const { company, userRole, loading: companyLoading, isAdmin, canEdit } = useCompany();
  const { companyId, isReady } = useRequireCompany();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSyncing, syncConnection, syncAll } = useApiSync(companyId);
  const [mlConnected, setMlConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Tratar retorno OAuth do Mercado Livre
  useEffect(() => {
    const mlSuccess = searchParams.get('ml_success');
    const mlError   = searchParams.get('ml_error');
    const mlNick    = searchParams.get('ml_nickname');

    if (mlSuccess === 'true') {
      toast({
        title: '🎉 Mercado Livre conectado!',
        description: `Conta @${mlNick || 'vendedor'} vinculada. Sincronizando pedidos...`,
      });
      setMlConnected(true);
      setSearchParams(prev => { prev.delete('ml_success'); prev.delete('ml_nickname'); return prev; });
      // Auto-sync após OAuth
      const mlConn = apiConnections.find(c => c.platform === 'mercado_livre');
      if (mlConn) syncConnection(mlConn, fetchData);
    }

    if (mlError) {
      toast({
        title: 'Erro ao conectar Mercado Livre',
        description: `Falha: ${mlError}`,
        variant: 'destructive',
      });
      setSearchParams(prev => { prev.delete('ml_error'); return prev; });
    }
  }, [searchParams]);

  // Verificar se ML está conectado via OAuth
  useEffect(() => {
    if (companyId) {
      isMercadoLivreConnected(companyId).then(setMlConnected);
    }
  }, [companyId]);
  
  // States
  const [authorizedEmails, setAuthorizedEmails] = useState<AuthorizedEmail[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  
  const [settings, setSettings] = useState<UserSettings>({
    monthly_revenue_goal: 0,
    max_expense_goal: 0,
    sync_frequency: 'manual',
  });
  
  const [apiConnections, setApiConnections] = useState<ApiConnection[]>([]);
  const [apiDialogOpen, setApiDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ApiConnection | null>(null);
  const [formPlatform, setFormPlatform] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formApiSecret, setFormApiSecret] = useState('');
  const [formAccessToken, setFormAccessToken] = useState('');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // New user dialog state
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'financeiro' | 'leitura'>('leitura');

  useEffect(() => {
    if (isReady && companyId) {
      fetchData();
    }
  }, [isReady, companyId]);

  const fetchData = async () => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      // Fetch authorized emails (only for admins)
      if (isAdmin) {
        const { data: emailsData, error: emailsError } = await supabase
          .from('authorized_emails')
          .select('*')
          .order('created_at', { ascending: false });

        if (emailsError) throw emailsError;
        setAuthorizedEmails(emailsData || []);
      }

      // Fetch company data
      const { data: compData, error: compError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (compError) throw compError;
      setCompanyData(compData);

      // Fetch subscription
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('company_id', companyId)
        .single();

      if (!subError && subData) {
        setSubscription(subData);
      }

      // Fetch company users (only for admins)
      if (isAdmin) {
        const { data: usersData, error: usersError } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .eq('company_id', companyId);

        if (!usersError && usersData) {
          // Fetch profiles for these users
          const userIds = usersData.map(u => u.user_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', userIds);

          const usersWithProfiles = usersData.map(u => ({
            ...u,
            full_name: profilesData?.find(p => p.user_id === u.user_id)?.full_name || 'Usuário',
          }));

          setCompanyUsers(usersWithProfiles as CompanyUser[]);
        }
      }

      // Fetch user settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user?.id)
        .eq('company_id', companyId)
        .maybeSingle();

      if (settingsError) throw settingsError;
      if (settingsData) {
        setSettings(settingsData);
      }

      // Fetch API connections
      const { data: connectionsData, error: connectionsError } = await supabase
        .from('api_connections')
        .select('*')
        .eq('company_id', companyId)
        .order('platform');

      if (connectionsError) throw connectionsError;
      setApiConnections(connectionsData || []);
    } catch (error) {
      console.error('Error fetching settings data:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Company management
  const handleSaveCompany = async () => {
    if (!companyData || !isAdmin) return;

    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: companyData.name,
          document: companyData.document,
          email: companyData.email,
          phone: companyData.phone,
          address: companyData.address,
        })
        .eq('id', companyData.id);

      if (error) throw error;
      
      toast({
        title: 'Sucesso',
        description: 'Dados da empresa atualizados.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível atualizar os dados.',
        variant: 'destructive',
      });
    }
  };

  // Email management
  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !isAdmin) return;

    try {
      const { error } = await supabase
        .from('authorized_emails')
        .insert({ email: newEmail.toLowerCase().trim(), user_id: user?.id });

      if (error) throw error;
      
      toast({
        title: 'Sucesso',
        description: 'Email autorizado adicionado.',
      });
      setNewEmail('');
      setEmailDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível adicionar o email.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteEmail = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este email autorizado?') || !isAdmin) return;

    try {
      const { error } = await supabase
        .from('authorized_emails')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: 'Sucesso',
        description: 'Email removido.',
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível remover o email.',
        variant: 'destructive',
      });
    }
  };

  // User role management
  const handleUpdateUserRole = async (userId: string, newRole: 'admin' | 'financeiro' | 'leitura') => {
    if (!isAdmin || !company) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId)
        .eq('company_id', companyId!);

      if (error) throw error;
      
      toast({
        title: 'Sucesso',
        description: 'Permissão atualizada.',
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível atualizar a permissão.',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja remover este usuário da empresa?') || !isAdmin || !companyId) return;
    if (userId === user?.id) {
      toast({
        title: 'Erro',
        description: 'Você não pode remover a si mesmo.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('company_id', companyId!);

      if (error) throw error;
      
      toast({
        title: 'Sucesso',
        description: 'Usuário removido da empresa.',
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível remover o usuário.',
        variant: 'destructive',
      });
    }
  };
  
const handleInviteUser = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!isAdmin || !companyId || !newUserEmail) return;

  try {
    // cria convite
    const { error } = await supabase
      .from('company_invites')
      .insert({
        email: newUserEmail.toLowerCase().trim(),
        company_id: companyId,
        role: newUserRole,
        invited_by: user?.id,
      });

    if (error) throw error;

    toast({
      title: 'Convite enviado',
      description: 'O usuário poderá entrar ao criar login.',
    });

    setNewUserEmail('');
    setNewUserDialogOpen(false);

  } catch (error: any) {
    toast({
      title: 'Erro',
      description: error.message,
      variant: 'destructive',
    });
  }
};
  // Settings management
  const handleSaveSettings = async () => {
    if (!canEdit || !companyId) return;

    try {
      const settingsData = {
        user_id: user?.id,
        company_id: companyId,
        monthly_revenue_goal: settings.monthly_revenue_goal,
        max_expense_goal: settings.max_expense_goal,
        sync_frequency: settings.sync_frequency,
      };

      const { error } = await supabase
        .from('user_settings')
        .upsert(settingsData, { onConflict: 'user_id' });

      if (error) throw error;
      
      toast({
        title: 'Sucesso',
        description: 'Configurações salvas.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    }
  };

  // API connections management
  const resetApiForm = () => {
    setFormPlatform('');
    setFormApiKey('');
    setFormApiSecret('');
    setFormAccessToken('');
    setEditingConnection(null);
  };

  const openEditApiDialog = (connection: ApiConnection) => {
    setEditingConnection(connection);
    setFormPlatform(connection.platform);
    setFormApiKey(connection.api_key || '');
    setFormApiSecret(connection.api_secret || '');
    setFormAccessToken(connection.access_token || '');
    setApiDialogOpen(true);
  };

  const handleSaveApiConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !companyId) return;

    try {
      const connectionData = {
        user_id: user?.id,
        company_id: companyId,
        platform: formPlatform,
        api_key: formApiKey,
        api_secret: formApiSecret,
        access_token: formAccessToken,
        is_active: true,
      };

      if (editingConnection) {
        const { error } = await supabase
          .from('api_connections')
          .update(connectionData)
          .eq('id', editingConnection.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('api_connections')
          .insert([connectionData]);

        if (error) throw error;
      }

      toast({
        title: 'Sucesso',
        description: 'Conexão de API salva.',
      });
      setApiDialogOpen(false);
      resetApiForm();
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar a conexão.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteApiConnection = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta conexão?') || !canEdit) return;

    try {
      const { error } = await supabase
        .from('api_connections')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: 'Sucesso',
        description: 'Conexão removida.',
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível remover a conexão.',
        variant: 'destructive',
      });
    }
  };

  const toggleConnectionStatus = async (id: string, currentStatus: boolean) => {
    if (!canEdit) return;

    try {
      const { error } = await supabase
        .from('api_connections')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error toggling connection status:', error);
    }
  };

  // Backup functions
  const handleExportBackup = async () => {
    if (!company) return;

    try {
      const [transactionsRes, categoriesRes, settingsRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('company_id', company.id).is('deleted_at', null),
        supabase.from('categories').select('*').eq('company_id', company.id).is('deleted_at', null),
        supabase.from('user_settings').select('*').eq('company_id', company.id),
      ]);

      const backupData = {
        exportedAt: new Date().toISOString(),
        company: companyData,
        transactions: transactionsRes.data || [],
        categories: categoriesRes.data || [],
        settings: settingsRes.data || [],
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sh-financas-backup-${companyData?.name || 'empresa'}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Sucesso',
        description: 'Backup exportado com sucesso.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível exportar o backup.',
        variant: 'destructive',
      });
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      toast({
        title: 'Atenção',
        description: 'Funcionalidade de restauração em desenvolvimento.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Arquivo de backup inválido.',
        variant: 'destructive',
      });
    }
    e.target.value = '';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const toggleSecretVisibility = (id: string) => {
    setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const maskSecret = (value: string | null) => {
    if (!value) return '-';
    return value.substring(0, 4) + '****' + value.substring(value.length - 4);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ativo':
        return <Badge className="bg-green-500">Ativo</Badge>;
      case 'suspenso':
        return <Badge variant="secondary" className="bg-yellow-500">Suspenso</Badge>;
      case 'cancelado':
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (companyLoading || loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          Configurações
        </h1>
        <p className="text-muted-foreground">
          Configure o sistema e preferências da empresa
        </p>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7 gap-2">
          <TabsTrigger value="company" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Empresa</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Assinatura</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Usuários</span>
          </TabsTrigger>
          <TabsTrigger value="goals" className="gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Metas</span>
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Sincronização</span>
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-2">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">APIs</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Backup</span>
          </TabsTrigger>
        </TabsList>

        {/* Company Tab */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Dados da Empresa
              </CardTitle>
              <CardDescription>
                Informações cadastrais da sua empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {companyData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Nome da Empresa</Label>
                    <Input
                      id="company_name"
                      value={companyData.name}
                      onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_document">CNPJ/CPF</Label>
                    <Input
                      id="company_document"
                      value={companyData.document || ''}
                      onChange={(e) => setCompanyData({ ...companyData, document: e.target.value })}
                      placeholder="00.000.000/0001-00"
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_email">Email</Label>
                    <Input
                      id="company_email"
                      type="email"
                      value={companyData.email || ''}
                      onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                      placeholder="contato@empresa.com"
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_phone">Telefone</Label>
                    <Input
                      id="company_phone"
                      value={companyData.phone || ''}
                      onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="company_address">Endereço</Label>
                    <Input
                      id="company_address"
                      value={companyData.address || ''}
                      onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                      placeholder="Rua, número, bairro, cidade - UF"
                      disabled={!isAdmin}
                    />
                  </div>
                </div>
              )}
              {isAdmin && (
                <Button onClick={handleSaveCompany} className="gap-2">
                  <Save className="h-4 w-4" />
                  Salvar Dados
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                Status da Assinatura
              </CardTitle>
              <CardDescription>
                Informações sobre seu plano e renovação
              </CardDescription>
            </CardHeader>
            <CardContent>
              {subscription ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Plano</p>
                      <p className="text-xl font-semibold">SH Completo</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Valor Mensal</p>
                      <p className="text-xl font-semibold">{formatCurrency(subscription.valor)}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Status</p>
                      <div className="mt-1">{getStatusBadge(subscription.status)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Data de Ativação</p>
                      <p className="text-lg font-medium">
                        {format(new Date(subscription.data_ativacao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Próxima Renovação</p>
                      <p className="text-lg font-medium">
                        {format(new Date(subscription.data_renovacao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-semibold mb-2">Recursos inclusos:</h4>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <li>✓ Dashboard em tempo real</li>
                      <li>✓ Importação e exportação CSV/XLSX/PDF</li>
                      <li>✓ Relatórios completos</li>
                      <li>✓ Integração com Marketplaces</li>
                      <li>✓ Alertas e auditoria</li>
                      <li>✓ Múltiplos usuários</li>
                      <li>✓ Modo offline</li>
                      <li>✓ Suporte prioritário</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhuma assinatura ativa encontrada.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <div className="space-y-6">
            {/* Company Users */}
              <CardHeader className="flex flex-row items-center justify-between">
  <div>
    <CardTitle>Usuários da Empresa</CardTitle>
    <CardDescription>
      Gerencie os usuários com acesso à empresa
    </CardDescription>
  </div>

  {isAdmin && (
    <Dialog open={newUserDialogOpen} onOpenChange={setNewUserDialogOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar usuário</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleInviteUser} className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Permissão</Label>
            <Select
              value={newUserRole}
              onValueChange={(v) => setNewUserRole(v as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
                <SelectItem value="leitura">Somente leitura</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full">
            Enviar convite
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )}
</CardHeader>

            {/* Authorized Emails - Admin Only */}
            {isAdmin && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Emails Autorizados</CardTitle>
                    <CardDescription>
                      Emails que podem se cadastrar no sistema
                    </CardDescription>
                  </div>
                  <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Adicionar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Email Autorizado</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddEmail} className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="usuario@email.com"
                            required
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setEmailDialogOpen(false)}>
                            Cancelar
                          </Button>
                          <Button type="submit">Adicionar</Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Data de Cadastro</TableHead>
                        <TableHead className="w-[80px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {authorizedEmails.map((email) => (
                        <TableRow key={email.id}>
                          <TableCell className="font-medium">{email.email}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(email.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteEmail(email.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {authorizedEmails.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            Nenhum email autorizado cadastrado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Goals Tab */}
        <TabsContent value="goals">
          <Card>
            <CardHeader>
              <CardTitle>Metas Financeiras</CardTitle>
              <CardDescription>
                Defina suas metas mensais de faturamento e gastos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="revenue_goal">Meta de Faturamento Mensal</Label>
                  <Input
                    id="revenue_goal"
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.monthly_revenue_goal}
                    onChange={(e) => setSettings({ ...settings, monthly_revenue_goal: parseFloat(e.target.value) || 0 })}
                    placeholder="0,00"
                    disabled={!canEdit}
                  />
                  <p className="text-xs text-muted-foreground">
                    Meta atual: {formatCurrency(settings.monthly_revenue_goal)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense_goal">Meta de Gastos Máxima</Label>
                  <Input
                    id="expense_goal"
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.max_expense_goal}
                    onChange={(e) => setSettings({ ...settings, max_expense_goal: parseFloat(e.target.value) || 0 })}
                    placeholder="0,00"
                    disabled={!canEdit}
                  />
                  <p className="text-xs text-muted-foreground">
                    Limite atual: {formatCurrency(settings.max_expense_goal)}
                  </p>
                </div>
              </div>
              {canEdit && (
                <Button onClick={handleSaveSettings} className="gap-2">
                  <Save className="h-4 w-4" />
                  Salvar Metas
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync Tab */}
        <TabsContent value="sync">
          <Card>
            <CardHeader>
              <CardTitle>Frequência de Sincronização</CardTitle>
              <CardDescription>
                Configure a periodicidade de sincronização automática com as APIs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="sync_frequency">Frequência</Label>
                <Select
                  value={settings.sync_frequency}
                  onValueChange={(value) => setSettings({ ...settings, sync_frequency: value })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">A cada 1 hora</SelectItem>
                    <SelectItem value="6h">A cada 6 horas</SelectItem>
                    <SelectItem value="24h">A cada 24 horas</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {canEdit && (
                <Button onClick={handleSaveSettings} className="gap-2">
                  <Save className="h-4 w-4" />
                  Salvar Configuração
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Tab */}
        <TabsContent value="api">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Conexões de API</CardTitle>
                <CardDescription>
                  Configure as credenciais para integração com marketplaces
                </CardDescription>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2">
                  {apiConnections.filter(c => c.is_active).length > 0 && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => syncAll(apiConnections, fetchData)}
                      disabled={apiConnections.some(c => isSyncing(c.id))}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Sincronizar Tudo
                    </Button>
                  )}
                <Dialog open={apiDialogOpen} onOpenChange={(open) => {
                  setApiDialogOpen(open);
                  if (!open) resetApiForm();
                }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Nova Conexão
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingConnection ? 'Editar Conexão' : 'Nova Conexão de API'}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveApiConnection} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Plataforma</Label>
                        <Select value={formPlatform} onValueChange={setFormPlatform} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {platforms.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="api_key">API Key</Label>
                        <Input
                          id="api_key"
                          type="password"
                          value={formApiKey}
                          onChange={(e) => setFormApiKey(e.target.value)}
                          placeholder="Sua API Key"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="api_secret">API Secret</Label>
                        <Input
                          id="api_secret"
                          type="password"
                          value={formApiSecret}
                          onChange={(e) => setFormApiSecret(e.target.value)}
                          placeholder="Seu API Secret"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="access_token">Access Token</Label>
                        <Input
                          id="access_token"
                          type="password"
                          value={formAccessToken}
                          onChange={(e) => setFormAccessToken(e.target.value)}
                          placeholder="Seu Access Token"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setApiDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit">Salvar</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última Sincronização</TableHead>
                    {canEdit && <TableHead className="w-[120px]">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiConnections.map((conn) => (
                    <TableRow key={conn.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="capitalize">
                            {platforms.find(p => p.value === conn.platform)?.name || conn.platform}
                          </span>
                          {conn.platform === 'mercado_livre' && (
                            <Badge variant={mlConnected ? 'default' : 'secondary'} className="text-xs gap-1">
                              {mlConnected
                                ? <><CheckCircle2 className="h-3 w-3" /> OAuth OK</>
                                : <><AlertCircle className="h-3 w-3" /> Requer autorização</>
                              }
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            {showSecrets[conn.id] ? conn.api_key : maskSecret(conn.api_key)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleSecretVisibility(conn.id)}
                          >
                            {showSecrets[conn.id] ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={conn.is_active}
                            onCheckedChange={() => toggleConnectionStatus(conn.id, conn.is_active)}
                            disabled={!canEdit}
                          />
                          <Badge variant={conn.is_active ? 'default' : 'secondary'}>
                            {conn.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {conn.last_sync_at
                          ? new Date(conn.last_sync_at).toLocaleString('pt-BR')
                          : 'Nunca'}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {/* Botão Sincronizar */}
                            {conn.platform === 'mercado_livre' && !mlConnected ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-xs"
                                onClick={() => window.location.href = getMercadoLivreAuthUrl(companyId!)}
                              >
                                <Link2 className="h-3 w-3" />
                                Autorizar
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-xs"
                                disabled={isSyncing(conn.id) || !conn.is_active}
                                onClick={() => syncConnection(conn, fetchData)}
                              >
                                <RefreshCw className={`h-3 w-3 ${isSyncing(conn.id) ? 'animate-spin' : ''}`} />
                                {isSyncing(conn.id) ? 'Sync...' : 'Sincronizar'}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditApiDialog(conn)}
                            >
                              <SettingsIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteApiConnection(conn.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {apiConnections.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhuma conexão de API configurada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup Tab */}
        <TabsContent value="backup">
          <Card>
            <CardHeader>
              <CardTitle>Backup e Restauração</CardTitle>
              <CardDescription>
                Exporte ou restaure seus dados do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold">Exportar Backup</h3>
                  <p className="text-sm text-muted-foreground">
                    Baixe uma cópia completa dos seus dados em formato JSON.
                  </p>
                  <Button onClick={handleExportBackup} className="gap-2">
                    <Download className="h-4 w-4" />
                    Exportar Dados
                  </Button>
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold">Restaurar Backup</h3>
                  <p className="text-sm text-muted-foreground">
                    Restaure seus dados a partir de um arquivo de backup.
                  </p>
                  <div>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackup}
                      className="hidden"
                      id="backup-file"
                      disabled={!canEdit}
                    />
                    <Button variant="outline" asChild className="gap-2" disabled={!canEdit}>
                      <label htmlFor="backup-file" className="cursor-pointer">
                        <Upload className="h-4 w-4" />
                        Restaurar Dados
                      </label>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};