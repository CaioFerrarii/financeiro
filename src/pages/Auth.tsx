import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  TrendingUp, 
  Shield, 
  BarChart3, 
  CheckCircle2, 
  Crown,
  FileSpreadsheet,
  Bell,
  Users,
  Wifi,
  Store,
  Building2,
  ArrowLeft,
  Mail
} from 'lucide-react';

const CheckCircleIcon = CheckCircle2;
import { loginSchema, subscriptionFormSchema } from '@/lib/validators';

const planFeatures = [
  { icon: BarChart3, text: 'Dashboard em tempo real' },
  { icon: FileSpreadsheet, text: 'Importação e exportação CSV/XLSX/PDF' },
  { icon: TrendingUp, text: 'Relatórios completos (DRE, Fluxo de Caixa, Curva ABC)' },
  { icon: Store, text: 'Integração com Marketplaces' },
  { icon: Bell, text: 'Alertas e auditoria' },
  { icon: Users, text: 'Múltiplos usuários por empresa' },
  { icon: Wifi, text: 'Modo offline' },
  { icon: Shield, text: 'Segurança total - seus dados isolados' },
];

type ViewMode = 'welcome' | 'login' | 'subscribe' | 'forgot-password';

const PENDING_COMPANY_BOOTSTRAP_KEY = 'pending_company_bootstrap_v1';

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('welcome');
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Forgot password form
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotEmailSent, setForgotEmailSent] = useState(false);
  
  // Subscription form - Dados do responsável
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  
  // Subscription form - Dados da empresa
  const [companyName, setCompanyName] = useState('');
  const [document, setDocument] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [address, setAddress] = useState('');
  
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const { createCompany, company, loading: companyLoading } = useCompany();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect to dashboard only when BOTH user AND company are fully loaded
  useEffect(() => {
    if (authLoading || companyLoading) return; // Wait for loading
    if (user && company) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, company, authLoading, companyLoading, navigate]);

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 18);
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .slice(0, 14);
    }
    return numbers
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 15);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validation = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
      if (!validation.success) {
        toast({
          title: 'Erro de validação',
          description: validation.error.errors[0].message,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const { error } = await signIn(loginEmail, loginPassword);
      
      if (error) {
        toast({
          title: 'Erro ao entrar',
          description: error.message === 'Invalid login credentials' 
            ? 'Email ou senha incorretos' 
            : error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Bem-vindo!',
          description: 'Login realizado com sucesso.',
        });
        navigate('/dashboard');
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast({
          title: 'Erro ao enviar email',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        setForgotEmailSent(true);
        toast({
          title: 'Email enviado!',
          description: 'Verifique sua caixa de entrada para redefinir sua senha.',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validation = subscriptionFormSchema.safeParse({ 
        fullName,
        email, 
        password,
        confirmPassword,
        phone: phone || undefined,
        companyName,
        document,
        companyEmail: companyEmail || undefined,
        companyPhone: companyPhone || undefined,
        address: address || undefined,
      });
      
      if (!validation.success) {
        const errorMessages = validation.error.errors.map(e => e.message).join(', ');
        toast({
          title: 'Erro de validação',
          description: errorMessages,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Salva os dados da empresa localmente para completar o bootstrap após o login
      // (não salvamos senha aqui)
      localStorage.setItem(PENDING_COMPANY_BOOTSTRAP_KEY, JSON.stringify({
        fullName,
        companyName,
        document,
        companyEmail: companyEmail || undefined,
        companyPhone: companyPhone || undefined,
        address: address || undefined,
      }));

      // 1. Criar conta do usuário
      const { error: signUpError } = await signUp(email, password, fullName);
      
      if (signUpError) {
        // Se o usuário já existe, tentamos entrar e continuar a assinatura
        if (signUpError.message?.includes('already registered')) {
          const { error: loginError } = await signIn(email, password);
          if (loginError) {
            toast({
              title: 'Conta já existe',
              description: 'Este email já está cadastrado. Entre para concluir a assinatura.',
              variant: 'destructive',
            });
            setViewMode('login');
            setIsLoading(false);
            return;
          }
        } else {
          toast({
            title: 'Erro ao criar conta',
            description: signUpError.message,
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
      } else {
        // Em muitos setups, o cadastro não cria sessão automaticamente.
        // Tentamos entrar para conseguir executar o bootstrap da empresa.
        const { error: loginError } = await signIn(email, password);
        if (loginError) {
          toast({
            title: 'Conta criada!',
            description: 'Agora faça login para concluir a assinatura e cadastrar sua empresa.',
          });
          setViewMode('login');
          setIsLoading(false);
          return;
        }
      }

      // 2. Criar empresa (via RPC unificado dentro do hook)
      const { error: companyError } = await createCompany({
        name: companyName,
        document: document,
        email: companyEmail || undefined,
        phone: companyPhone || undefined,
        address: address || undefined,
      });

      if (companyError) {
        toast({
          title: 'Erro ao concluir assinatura',
          description: companyError.message || 'Não foi possível cadastrar sua empresa.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      localStorage.removeItem(PENDING_COMPANY_BOOTSTRAP_KEY);

      toast({
        title: 'Assinatura realizada!',
        description: 'Sua empresa foi cadastrada com sucesso. Bem-vindo a Fihbub!',
      });
      navigate('/dashboard');
      
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Welcome view with subscription CTA
  if (viewMode === 'welcome') {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* Left side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 gradient-bg p-12 flex-col justify-between">
          <div>
            <h1 className="text-4xl font-display font-bold text-primary-foreground">
              Fihbub
            </h1>
            <p className="mt-2 text-primary-foreground/80">
              Gestão financeira inteligente
            </p>
          </div>
          
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary-foreground/10">
                <TrendingUp className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-foreground">Controle Total</h3>
                <p className="text-sm text-primary-foreground/70">
                  Acompanhe receitas e despesas em tempo real
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary-foreground/10">
                <BarChart3 className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-foreground">Relatórios Inteligentes</h3>
                <p className="text-sm text-primary-foreground/70">
                  Visualize seus dados com gráficos interativos
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary-foreground/10">
                <Shield className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-foreground">Segurança</h3>
                <p className="text-sm text-primary-foreground/70">
                  Seus dados protegidos com criptografia
                </p>
              </div>
            </div>
          </div>
          
          <p className="text-sm text-primary-foreground/60">
            © 2024 Fihbub. Todos os direitos reservados.
          </p>
        </div>
        
        {/* Right side - Subscription CTA */}
        <div className="flex-1 flex flex-col items-center justify-start p-8 bg-background overflow-y-auto">
          <div className="w-full max-w-md">
            <div className="lg:hidden mb-8 text-center">
              <h1 className="text-3xl font-display font-bold text-primary">
                Fihbub
              </h1>
              <p className="text-muted-foreground">
                Gestão financeira inteligente
              </p>
            </div>

            {/* Subscription Plan Card */}
            <Card className="border-2 border-primary/20 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-primary-foreground">
                <div className="flex items-center gap-3">
                  <Crown className="h-8 w-8" />
                  <div>
                    <h2 className="text-2xl font-display font-bold">Plano Fihbub Completo</h2>
                    <p className="text-primary-foreground/80">Tudo que você precisa para sua gestão financeira</p>
                  </div>
                </div>
              </div>
              <CardContent className="pt-6">
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold text-foreground line-through opacity-50">R$ 99,90</span>
                </div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-5xl font-bold text-green-600">R$ 0,00</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <p className="text-sm text-green-600 font-medium mb-6">
                  🎉 Promoção de lançamento - Gratuito por tempo limitado!
                </p>

                <div className="space-y-3 mb-6">
                  {planFeatures.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-foreground">{feature.text}</span>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-muted rounded-lg mb-6">
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-medium">Apenas a sua empresa acessa seus dados.</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Segurança total com isolamento de dados por empresa.
                  </p>
                </div>

                <Button 
                  className="w-full gap-2 mb-4" 
                  size="lg"
                  onClick={() => setViewMode('subscribe')}
                >
                  <Crown className="h-5 w-5" />
                  Assinar Gratuitamente
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Cancele a qualquer momento. Sem taxas escondidas.
                </p>
              </CardContent>
            </Card>

            {/* Login link for existing users */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Já é assinante?
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setViewMode('login')}
              >
                Entrar na minha conta
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Login view
  if (viewMode === 'login') {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* Left side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 gradient-bg p-12 flex-col justify-between">
          <div>
            <h1 className="text-4xl font-display font-bold text-primary-foreground">
              Fihbub
            </h1>
            <p className="mt-2 text-primary-foreground/80">
              Gestão financeira inteligente
            </p>
          </div>
          
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary-foreground/10">
                <TrendingUp className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-foreground">Bem-vindo de volta!</h3>
                <p className="text-sm text-primary-foreground/70">
                  Entre com suas credenciais para acessar sua conta
                </p>
              </div>
            </div>
          </div>
          
          <p className="text-sm text-primary-foreground/60">
            © 2024 Fihbub. Todos os direitos reservados.
          </p>
        </div>
        
        {/* Right side - Login form */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
          <div className="w-full max-w-md">
            <Button 
              variant="ghost" 
              className="mb-6"
              onClick={() => setViewMode('welcome')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>

            <Card className="border-0 shadow-lg">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-2xl font-display">Entrar</CardTitle>
                <CardDescription>
                  Entre com seu email e senha
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  
                  <div className="text-right">
                    <button 
                      type="button"
                      className="text-sm text-primary hover:underline"
                      onClick={() => {
                        setForgotEmail(loginEmail);
                        setForgotEmailSent(false);
                        setViewMode('forgot-password');
                      }}
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      'Entrar'
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Não tem uma conta?{' '}
                    <button 
                      className="text-primary hover:underline font-medium"
                      onClick={() => setViewMode('subscribe')}
                    >
                      Assine agora
                    </button>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Forgot password view
  if (viewMode === 'forgot-password') {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* Left side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 gradient-bg p-12 flex-col justify-between">
          <div>
            <h1 className="text-4xl font-display font-bold text-primary-foreground">
              Fihbub
            </h1>
            <p className="mt-2 text-primary-foreground/80">
              Gestão financeira inteligente
            </p>
          </div>
          
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary-foreground/10">
                <Mail className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-foreground">Recuperação de Senha</h3>
                <p className="text-sm text-primary-foreground/70">
                  Enviaremos um link para você redefinir sua senha
                </p>
              </div>
            </div>
          </div>
          
          <p className="text-sm text-primary-foreground/60">
            © 2024 Fihbub. Todos os direitos reservados.
          </p>
        </div>
        
        {/* Right side - Forgot password form */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
          <div className="w-full max-w-md">
            <Button 
              variant="ghost" 
              className="mb-6"
              onClick={() => setViewMode('login')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para login
            </Button>

            <Card className="border-0 shadow-lg">
              <CardHeader className="space-y-1 pb-4 text-center">
                <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl font-display">Esqueci minha senha</CardTitle>
                <CardDescription>
                  {forgotEmailSent 
                    ? 'Verifique sua caixa de entrada' 
                    : 'Digite seu email para receber o link de recuperação'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {forgotEmailSent ? (
                  <div className="text-center space-y-4">
                    <div className="mx-auto p-4 rounded-full bg-accent w-fit">
                      <CheckCircleIcon className="h-8 w-8 text-accent-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Enviamos um email para <strong>{forgotEmail}</strong> com as instruções para redefinir sua senha.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Não recebeu? Verifique sua pasta de spam ou{' '}
                      <button 
                        className="text-primary hover:underline"
                        onClick={() => setForgotEmailSent(false)}
                      >
                        tente novamente
                      </button>
                    </p>
                    <Button 
                      className="w-full mt-4" 
                      onClick={() => setViewMode('login')}
                    >
                      Voltar para login
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email">Email</Label>
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        'Enviar link de recuperação'
                      )}
                    </Button>
                  </form>
                )}

                <div className="mt-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Lembrou sua senha?{' '}
                    <button 
                      className="text-primary hover:underline font-medium"
                      onClick={() => setViewMode('login')}
                    >
                      Entrar
                    </button>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Subscription form view
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side - Plan info */}
      <div className="lg:w-1/2 gradient-bg p-8 lg:p-12 flex flex-col justify-center">
        <div className="max-w-md mx-auto">
          <Button 
            variant="ghost" 
            className="mb-6 text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => setViewMode('welcome')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>

          <div className="flex items-center gap-3 mb-6">
            <Crown className="h-8 w-8 text-primary-foreground" />
            <h1 className="text-3xl font-display font-bold text-primary-foreground">
              Plano Fihbub Completo
            </h1>
          </div>
          
          <div className="mb-8">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold text-primary-foreground/50 line-through">R$ 99,90</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-5xl font-bold text-primary-foreground">R$ 0,00</span>
              <span className="text-primary-foreground/70">/mês</span>
            </div>
            <p className="text-primary-foreground/80">
              🎉 Gratuito por tempo limitado!
            </p>
          </div>

          <div className="space-y-4 mb-8">
            {planFeatures.slice(0, 5).map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
                <span className="text-primary-foreground">{feature.text}</span>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-lg bg-primary-foreground/10 border border-primary-foreground/20">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-primary-foreground" />
              <span className="font-semibold text-primary-foreground">Segurança Total</span>
            </div>
            <p className="text-sm text-primary-foreground/80">
              Apenas a sua empresa acessa seus dados. Isolamento completo garantido.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Subscription form */}
      <div className="lg:w-1/2 flex items-start justify-center p-8 bg-background overflow-y-auto">
        <Card className="w-full max-w-lg border-0 shadow-lg my-8">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-display">Complete sua Assinatura</CardTitle>
            <CardDescription>
              Preencha os dados abaixo para criar sua conta e cadastrar sua empresa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubscription} className="space-y-6">
              {/* Dados do Responsável */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Dados do Responsável
                </h3>
                
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo *</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="João da Silva"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      placeholder="(11) 99999-9999"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              {/* Dados da Empresa */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Dados da Empresa
                </h3>
                
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nome da Empresa / Razão Social *</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Minha Empresa Ltda"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="document">CNPJ *</Label>
                  <Input
                    id="document"
                    value={document}
                    onChange={(e) => setDocument(formatCNPJ(e.target.value))}
                    placeholder="00.000.000/0001-00"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyEmail">Email da Empresa</Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      placeholder="contato@empresa.com"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyPhone">Telefone da Empresa</Label>
                    <Input
                      id="companyPhone"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(formatPhone(e.target.value))}
                      placeholder="(11) 3333-4444"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Rua, Número, Bairro - Cidade/UF"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando assinatura...
                  </>
                ) : (
                  <>
                    <Crown className="mr-2 h-5 w-5" />
                    Assinar Gratuitamente
                  </>
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Ao assinar, você concorda com os{' '}
              <a href="#" className="text-primary hover:underline">Termos de Uso</a>
              {' '}e{' '}
              <a href="#" className="text-primary hover:underline">Política de Privacidade</a>
              {' '}do Fihbub.
            </p>

            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                Já tem uma conta?{' '}
                <button 
                  className="text-primary hover:underline font-medium"
                  onClick={() => setViewMode('login')}
                >
                  Entrar
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}