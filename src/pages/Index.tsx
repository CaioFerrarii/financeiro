import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { TrendingUp, BarChart3, Shield, ArrowRight } from 'lucide-react';
// TrendingUp ainda usado nas features cards abaixo

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="gradient-bg absolute inset-0 opacity-10" />
        <div className="container mx-auto px-4 py-20 lg:py-32 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <img src="/favicon-64x64.png" alt="Fihub" className="w-12 h-12 rounded-xl" />
              <h1 className="text-4xl lg:text-5xl font-display font-bold text-foreground">
                Fihub
              </h1>
            </div>
            <p className="text-xl text-muted-foreground mb-8 max-w-xl mx-auto">
              Gestão financeira inteligente para seu negócio. Controle receitas, despesas e acompanhe sua evolução.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="gap-2 text-lg px-8">
                  Acessar Sistema
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center p-6">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-accent mx-auto mb-4">
              <TrendingUp className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-display font-semibold text-lg mb-2">Controle Total</h3>
            <p className="text-muted-foreground">
              Acompanhe receitas e despesas em tempo real com filtros avançados.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-accent mx-auto mb-4">
              <BarChart3 className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-display font-semibold text-lg mb-2">Relatórios</h3>
            <p className="text-muted-foreground">
              Visualize seus dados com gráficos interativos e relatórios detalhados.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-accent mx-auto mb-4">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-display font-semibold text-lg mb-2">Segurança</h3>
            <p className="text-muted-foreground">
              Seus dados protegidos com criptografia e acesso restrito.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2024 Fihub. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}