import { Link } from 'react-router-dom';
import { 
  Truck, MapPin, Route, Package, Navigation, 
  Clock, AlertTriangle, Weight, Eye, Camera,
  FileSpreadsheet, GitFork, Map, CheckCircle2, 
  Timer, Fuel, Shield, BarChart3,
  ArrowRight, Check, X, Zap, Users,
  Menu, X as XIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

function Section({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={`px-4 py-16 md:py-24 ${className ?? ''}`}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-12 text-center">
      <h2 className="text-3xl font-bold tracking-tight md:text-4xl text-foreground">{children}</h2>
      {sub && <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAVBAR */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/landing" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Truck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">Rota Certa</span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <a href="#como-funciona" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Como funciona</a>
            <a href="#beneficios" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Benefícios</a>
            <a href="#planos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Planos</a>
            <Link to="/login"><Button variant="ghost" size="sm">Entrar</Button></Link>
            <Link to="/login"><Button size="sm">Começar grátis</Button></Link>
          </div>

          <button className="md:hidden text-foreground" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <XIcon className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden">
            <div className="flex flex-col gap-3">
              <a href="#como-funciona" className="text-sm py-2" onClick={() => setMobileMenuOpen(false)}>Como funciona</a>
              <a href="#beneficios" className="text-sm py-2" onClick={() => setMobileMenuOpen(false)}>Benefícios</a>
              <a href="#planos" className="text-sm py-2" onClick={() => setMobileMenuOpen(false)}>Planos</a>
              <Link to="/login"><Button variant="outline" className="w-full">Entrar</Button></Link>
              <Link to="/login"><Button className="w-full">Começar grátis</Button></Link>
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen bg-background pt-16 flex items-center justify-center px-4">
        <div className="max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-6xl">
            Planeje, execute e comprove suas entregas{' '}
            <span className="text-primary">em um só lugar.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            Roteirização inteligente, romaneio automático e prova de entrega para operações logísticas que precisam funcionar de verdade.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground/70">
            O Rota Certa transforma planilhas do ERP em rotas inteligentes, organiza o carregamento dos caminhões e acompanha cada entrega até a confirmação final.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/login">
              <Button size="lg" className="h-14 px-8 text-base">
                Começar agora <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a href="#como-funciona">
              <Button size="lg" variant="outline" className="h-14 px-8 text-base">
                Ver demonstração
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* PARA QUEM É */}
      <Section id="para-quem">
        <SectionTitle sub="Segmentos que já transformam sua logística com o Rota Certa">
          Feito para quem vive a logística todos os dias
        </SectionTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {[
            { icon: Package, label: 'Distribuidoras' },
            { icon: Truck, label: 'Food Service' },
            { icon: Navigation, label: 'Entregas próprias' },
            { icon: FileSpreadsheet, label: 'Logística em planilha' },
            { icon: Users, label: 'Times operacionais' },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center transition-colors hover:border-primary/30">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <item.icon className="h-7 w-7 text-primary" />
              </div>
              <span className="text-sm font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* O PROBLEMA */}
      <Section id="problema" className="bg-muted/50">
        <SectionTitle sub="Erros que custam tempo, dinheiro e credibilidade todos os dias">
          O caos da logística manual custa caro
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { icon: Clock, title: 'Planejamento manual demorado', desc: 'Horas montando rotas em planilhas' },
            { icon: AlertTriangle, title: 'Erros de rota', desc: 'Endereços trocados e retrabalho' },
            { icon: Weight, title: 'Caminhão sobrecarregado', desc: 'Excesso de peso e risco de multa' },
            { icon: Eye, title: 'Falta de controle', desc: 'Sem visibilidade da operação em tempo real' },
            { icon: Camera, title: 'Sem comprovação', desc: 'Discussão com cliente sem evidência' },
          ].map((item, i) => (
            <div key={i} className="rounded-2xl border border-destructive/20 bg-card p-6">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
                <item.icon className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* COMO FUNCIONA */}
      <Section id="como-funciona">
        <SectionTitle sub="4 passos para transformar sua operação logística">
          Como o Rota Certa funciona
        </SectionTitle>
        <div className="relative grid gap-8 md:grid-cols-4">
          <div className="absolute left-0 right-0 top-14 hidden h-px bg-border md:block" />
          {[
            { icon: FileSpreadsheet, step: '1', title: 'Importe suas vendas', desc: 'Cole ou envie a planilha do ERP com os pedidos do dia.' },
            { icon: GitFork, step: '2', title: 'Rotas automáticas', desc: 'O sistema monta as rotas e divide entre os caminhões.' },
            { icon: Map, step: '3', title: 'Motorista executa', desc: 'O motorista segue a rota pelo Google Maps com múltiplas paradas.' },
            { icon: CheckCircle2, step: '4', title: 'Entrega confirmada', desc: 'Cada entrega é registrada com assinatura, foto e horário.' },
          ].map((item, i) => (
            <div key={i} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
                <item.icon className="h-8 w-8 text-primary-foreground" />
                <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                  {item.step}
                </span>
              </div>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* BENEFÍCIOS */}
      <Section id="beneficios" className="bg-muted/50">
        <SectionTitle sub="Resultados reais para quem precisa de eficiência todos os dias">
          Mais controle, menos improviso
        </SectionTitle>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { icon: Timer, title: 'Economia de tempo', desc: 'Planejamento que levava horas agora leva minutos.' },
            { icon: Shield, title: 'Menos erros', desc: 'Redução drástica de erros operacionais.' },
            { icon: Fuel, title: 'Menos combustível', desc: 'Rotas otimizadas que reduzem quilometragem.' },
            { icon: Camera, title: 'Prova de entrega', desc: 'Assinatura e foto em cada entrega.' },
            { icon: BarChart3, title: 'Visão em tempo real', desc: 'Acompanhe a operação inteira no painel.' },
          ].map((item, i) => (
            <div key={i} className="rounded-2xl border bg-card p-6 transition-colors hover:border-primary/30">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <item.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* FEATURES */}
      <Section id="features">
        <SectionTitle>Tudo que você precisa em uma plataforma</SectionTitle>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              title: 'Planejamento',
              colorClass: 'text-primary',
              items: ['Roteirização inteligente', 'Distribuição automática de carga', 'Ajuste manual por caminhão', 'Validação de peso e capacidade'],
            },
            {
              title: 'Operação',
              colorClass: 'text-blue-500',
              items: ['Google Maps com múltiplas paradas', 'Execução guiada por motorista', 'Check de entrega com horário real', 'Romaneio de carregamento'],
            },
            {
              title: 'Controle',
              colorClass: 'text-green-600',
              items: ['Assinatura digital do cliente', 'Foto da entrega', 'Relatórios completos', 'Histórico de operações'],
            },
          ].map((col, i) => (
            <div key={i} className="rounded-2xl border bg-card p-6">
              <h3 className={`mb-6 text-xl font-bold ${col.colorClass}`}>{col.title}</h3>
              <ul className="space-y-3">
                {col.items.map((item, j) => (
                  <li key={j} className="flex items-center gap-3 text-sm">
                    <Check className={`h-5 w-5 shrink-0 ${col.colorClass}`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* PLANOS */}
      <Section id="planos" className="bg-muted/50">
        <SectionTitle sub="Escolha o plano ideal para o tamanho da sua operação">
          Planos e Preços
        </SectionTitle>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-xl font-bold">Free</h3>
            <p className="mt-1 text-sm text-muted-foreground">Para testar o sistema</p>
            <p className="mt-4 text-3xl font-extrabold">R$ 0<span className="text-base font-normal text-muted-foreground">/mês</span></p>
            <ul className="mt-6 space-y-3 text-sm">
              {['Até 1 caminhão', 'Roteirização básica', 'Romaneio simples'].map((f, i) => (
                <li key={i} className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />{f}</li>
              ))}
              {['Prova de entrega', 'Suporte'].map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-muted-foreground"><X className="h-4 w-4" />{f}</li>
              ))}
            </ul>
            <Link to="/login" className="mt-6 block">
              <Button variant="outline" className="w-full">Começar grátis</Button>
            </Link>
          </div>

          <div className="relative rounded-2xl border-2 border-primary bg-card p-6 shadow-sm">
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">Mais popular</Badge>
            <h3 className="text-xl font-bold">Premium</h3>
            <p className="mt-1 text-sm text-muted-foreground">Para operações em crescimento</p>
            <p className="mt-4 text-3xl font-extrabold">R$ 197<span className="text-base font-normal text-muted-foreground">/mês</span></p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                'Até 6 caminhões', 'Roteirização inteligente', 'Ajuste manual de rotas',
                'Google Maps com paradas', 'Confirmação de entrega', 'Relatórios operacionais', 'Suporte padrão',
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />{f}</li>
              ))}
            </ul>
            <Link to="/login" className="mt-6 block">
              <Button className="w-full">Começar agora</Button>
            </Link>
          </div>

          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-xl font-bold">Pro</h3>
            <p className="mt-1 text-sm text-muted-foreground">Para grandes operações</p>
            <p className="mt-4 text-3xl font-extrabold">R$ 397<span className="text-base font-normal text-muted-foreground">/mês</span></p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                'Até 15 caminhões', 'Tudo do Premium', 'Assinatura do cliente',
                'Foto da entrega', 'Histórico completo', 'Controle de usuários', 'Suporte prioritário',
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />{f}</li>
              ))}
            </ul>
            <Link to="/login" className="mt-6 block">
              <Button variant="outline" className="w-full">Falar com vendas</Button>
            </Link>
          </div>
        </div>
      </Section>

      {/* DIFERENCIAL */}
      <section className="bg-primary px-4 py-16 md:py-24">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 md:flex-row md:gap-16">
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-3xl font-bold text-primary-foreground md:text-4xl">
              Não é só roteirização. <span className="opacity-80">É execução.</span>
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-primary-foreground/70">
              O Rota Certa não para no planejamento. Ele acompanha a entrega até o fim, com evidência real e controle total da operação.
            </p>
          </div>
          <div className="flex shrink-0 items-center justify-center">
            <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-primary-foreground/10">
              <Zap className="h-16 w-16 text-primary-foreground" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-primary px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-primary-foreground md:text-4xl">
            Pare de planejar no improviso. Comece a operar com controle.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80">
            Teste o Rota Certa gratuitamente e veja sua operação funcionar como deveria.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/login">
              <Button size="lg" variant="outline" className="h-14 bg-background px-8 text-base font-semibold text-foreground hover:bg-background/90">
                Testar gratuitamente <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a href="#como-funciona">
              <Button size="lg" variant="outline" className="h-14 border-primary-foreground/30 px-8 text-base text-primary-foreground hover:bg-primary-foreground/10">
                Ver demonstração
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-muted px-4 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 md:flex-row md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Truck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">Rota Certa</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Termos</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacidade</a>
            <a href="#" className="hover:text-foreground transition-colors">Contato</a>
            <a href="#" className="hover:text-foreground transition-colors">Suporte</a>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 Rota Certa</p>
        </div>
      </footer>
    </div>
  );
}
