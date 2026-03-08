import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CreditCard, LogOut } from 'lucide-react';

export function SubscriptionBlocked() {
  const { subscription, company } = useCompany();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <Card className="w-full max-w-md border-destructive/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-display text-destructive">
            Assinatura {subscription?.status === 'suspenso' ? 'Suspensa' : 'Cancelada'}
          </CardTitle>
          <CardDescription>
            O acesso da empresa <strong>{company?.name}</strong> está bloqueado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground text-center">
              {subscription?.status === 'suspenso' 
                ? 'Sua assinatura está suspensa por falta de pagamento. Regularize para continuar usando o sistema.'
                : 'Sua assinatura foi cancelada. Entre em contato para reativar seu acesso.'}
            </p>
          </div>

          <div className="space-y-2">
            <Button className="w-full gap-2">
              <CreditCard className="h-4 w-4" />
              Regularizar Pagamento
            </Button>
            <Button variant="outline" className="w-full gap-2" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Dúvidas? Entre em contato: contato@shfinancas.com.br
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
