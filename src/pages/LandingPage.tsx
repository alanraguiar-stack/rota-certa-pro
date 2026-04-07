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

function AnimatedRoutes() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full opacity-20" style={{ filter: 'blur(0.5px)' }}>
      <path d="M50,250 Q100,200 150,180 T250,120 T350,80" fill="none" stroke="url(#routeGrad)" strokeWidth="2" strokeDasharray="8 4" className="lp-dash" />
      <path d="M30,280 Q120,220 200,200 T320,140 T380,60" fill="none" stroke="url(#routeGrad2)" strokeWidth="1.5" strokeDasharray="6 6" className="lp-dash" style={{ animationDelay: '1s' }} />
      <path d="M80,260 Q140,190 220,160 T360,100" fill="none" stroke="url(#routeGrad3)" strokeWidth="1" strokeDasharray="4 8" className="lp-dash" style={{ animationDelay: '2s' }} />
      <defs>
        <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="routeGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="routeGrad3" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.2" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Section({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={`px-4 py-16 md:py-24 ${className ?? ''}`}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

function SectionTitle({ children, sub, light }: { children: React.ReactNode; sub?: string; light?: boolean }) {
  return (
    <div className="mb-12 text-center">
      <h2 className={`text-3xl font-bold tracking-tight md:text-4xl ${light ? 'text-white' : 'text-white'}`}>{children}</h2>
      {sub && <p className={`mx-auto mt-4 max-w-2xl text-lg ${light ? 'text-slate-300' : 'text-slate-400'}`}>{sub}</p>}
    </div>
  );
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen text-white" style={{ background: '#0f172a' }}>
      {/* Scoped animations */}
      <style>{`
        @keyframes lp-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes lp-float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes lp-dash {
          to { stroke-dashoffset: -100; }
        }
        @keyframes lp-shimmer {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
        @keyframes lp-pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(249,115,22,0.3); }
          50% { box-shadow: 0 0 40px rgba(249,115,22,0.6); }
        }
        .lp-float { animation: lp-float 6s ease-in-out infinite; }
        .lp-float-slow { animation: lp-float-slow 8s ease-in-out infinite; }
        .lp-dash { animation: lp-dash 8s linear infinite; }
        .lp-shimmer { animation: lp-shimmer 3s ease-in-out infinite; }
        .lp-pulse-glow { animation: lp-pulse-glow 3s ease-in-out infinite; }
        .lp-glass { background: rgba(255,255,255,0.05); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.1); }
        .lp-glass-hover:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
      `}</style>

      {/* NAVBAR */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10" style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/landing" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
              <Truck className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">Rota Certa</span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <a href="#como-funciona" className="text-sm text-slate-400 hover:text-white transition-colors">Como funciona</a>
            <a href="#beneficios" className="text-sm text-slate-400 hover:text-white transition-colors">Benefícios</a>
            <a href="#planos" className="text-sm text-slate-400 hover:text-white transition-colors">Planos</a>
            <Link to="/login"><Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/10">Entrar</Button></Link>
            <Link to="/login">
              <Button size="sm" className="text-white border-0" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                Começar grátis
              </Button>
            </Link>
          </div>

          <button className="md:hidden text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <XIcon className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-white/10 px-4 pb-4 pt-2 md:hidden" style={{ background: 'rgba(15,23,42,0.95)' }}>
            <div className="flex flex-col gap-3">
              <a href="#como-funciona" className="text-sm text-slate-300 py-2" onClick={() => setMobileMenuOpen(false)}>Como funciona</a>
              <a href="#beneficios" className="text-sm text-slate-300 py-2" onClick={() => setMobileMenuOpen(false)}>Benefícios</a>
              <a href="#planos" className="text-sm text-slate-300 py-2" onClick={() => setMobileMenuOpen(false)}>Planos</a>
              <Link to="/login"><Button className="w-full text-white border-0 hover:opacity-90" style={{ background: 'rgba(249,115,22,0.25)', border: '1px solid rgba(249,115,22,0.4)' }}>Entrar</Button></Link>
              <Link to="/login"><Button className="w-full text-white border-0" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>Começar grátis</Button></Link>
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen pt-16 flex items-center justify-center px-4 overflow-hidden">
        {/* Mesh gradient background */}
        <div className="absolute inset-0" style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(249,115,22,0.15), transparent),
            radial-gradient(ellipse 60% 40% at 80% 50%, rgba(59,130,246,0.1), transparent),
            radial-gradient(ellipse 50% 60% at 20% 80%, rgba(139,92,246,0.08), transparent)
          `
        }} />

        {/* Animated SVG routes */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatedRoutes />
        </div>

        {/* Floating icons */}
        <div className="absolute top-32 left-[10%] lp-float opacity-20">
          <Truck className="h-12 w-12 text-orange-400" />
        </div>
        <div className="absolute top-48 right-[15%] lp-float-slow opacity-15" style={{ animationDelay: '2s' }}>
          <Package className="h-10 w-10 text-blue-400" />
        </div>
        <div className="absolute bottom-32 left-[20%] lp-float opacity-10" style={{ animationDelay: '4s' }}>
          <MapPin className="h-8 w-8 text-purple-400" />
        </div>

        {/* Orb decorations */}
        <div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full lp-float-slow" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.12), transparent 70%)', filter: 'blur(40px)' }} />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full lp-float" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.1), transparent 70%)', filter: 'blur(60px)', animationDelay: '3s' }} />

        <div className="max-w-3xl text-center relative z-10">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            <span className="text-white">Sua logística no controle. </span>
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #f97316, #fb923c, #f59e0b)' }}>
              Do pedido à prova de entrega.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl">
            Roteirização inteligente, romaneio automático e prova de entrega para operações logísticas que precisam funcionar de verdade.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm text-slate-500">
            O Rota Certa transforma planilhas do ERP em rotas inteligentes, organiza o carregamento dos caminhões e acompanha cada entrega até a confirmação final.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/login">
              <Button size="lg" className="h-14 px-8 text-base text-white border-0 lp-pulse-glow" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                Começar agora <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a href="#como-funciona">
              <Button size="lg" className="h-14 px-8 text-base text-white hover:opacity-90 border-0" style={{ background: 'rgba(249,115,22,0.2)', border: '1px solid rgba(249,115,22,0.4)' }}>
                Ver demonstração
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* PARA QUEM É */}
      <Section id="para-quem" className="border-t border-white/5" >
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
            <div key={i} className="lp-glass lp-glass-hover flex flex-col items-center gap-3 rounded-2xl p-6 text-center transition-all duration-300 cursor-default">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl" style={{ background: 'rgba(249,115,22,0.15)' }}>
                <item.icon className="h-7 w-7 text-orange-400" />
              </div>
              <span className="text-sm font-medium text-slate-200">{item.label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* O PROBLEMA */}
      <Section id="problema" className="relative">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(30,41,59,1) 50%, rgba(15,23,42,1) 100%)' }} />
        <div className="relative z-10">
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
              <div key={i} className="rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'rgba(239,68,68,0.1)' }}>
                  <item.icon className="h-6 w-6 text-red-400" />
                </div>
                <h3 className="font-semibold text-white">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* COMO FUNCIONA */}
      <Section id="como-funciona">
        <SectionTitle sub="4 passos para transformar sua operação logística">
          Como o Rota Certa funciona
        </SectionTitle>
        <div className="relative grid gap-8 md:grid-cols-4">
          {/* Connector line */}
          <div className="absolute left-0 right-0 top-14 hidden h-px md:block" style={{ background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.4), rgba(59,130,246,0.4), transparent)' }} />
          {[
            { icon: FileSpreadsheet, step: '1', title: 'Importe suas vendas', desc: 'Cole ou envie a planilha do ERP com os pedidos do dia.' },
            { icon: GitFork, step: '2', title: 'Rotas automáticas', desc: 'O sistema monta as rotas e divide entre os caminhões.' },
            { icon: Map, step: '3', title: 'Motorista executa', desc: 'O motorista segue a rota pelo Google Maps com múltiplas paradas.' },
            { icon: CheckCircle2, step: '4', title: 'Entrega confirmada', desc: 'Cada entrega é registrada com assinatura, foto e horário.' },
          ].map((item, i) => (
            <div key={i} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                boxShadow: '0 0 30px rgba(249,115,22,0.3)'
              }}>
                <item.icon className="h-8 w-8 text-white" />
                <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" style={{ background: '#1e293b', border: '2px solid #f97316', color: '#f97316' }}>
                  {item.step}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* BENEFÍCIOS */}
      <Section id="beneficios" className="relative">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(30,41,59,1) 50%, rgba(15,23,42,1) 100%)' }} />
        <div className="relative z-10">
          <SectionTitle sub="Resultados reais para quem precisa de eficiência todos os dias">
            Mais controle, menos improviso
          </SectionTitle>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { icon: Timer, title: 'Economia de tempo', desc: 'Planejamento que levava horas agora leva minutos.', color: '#f97316' },
              { icon: Shield, title: 'Menos erros', desc: 'Redução drástica de erros operacionais.', color: '#3b82f6' },
              { icon: Fuel, title: 'Menos combustível', desc: 'Rotas otimizadas que reduzem quilometragem.', color: '#10b981' },
              { icon: Camera, title: 'Prova de entrega', desc: 'Assinatura e foto em cada entrega.', color: '#8b5cf6' },
              { icon: BarChart3, title: 'Visão em tempo real', desc: 'Acompanhe a operação inteira no painel.', color: '#06b6d4' },
            ].map((item, i) => (
              <div key={i} className="lp-glass lp-glass-hover rounded-2xl p-6 transition-all duration-300 cursor-default">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: `${item.color}15` }}>
                  <item.icon className="h-6 w-6" style={{ color: item.color }} />
                </div>
                <h3 className="font-semibold text-white">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* FEATURES */}
      <Section id="features">
        <SectionTitle>Tudo que você precisa em uma plataforma</SectionTitle>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              title: 'Planejamento',
              color: '#f97316',
              items: ['Roteirização inteligente', 'Distribuição automática de carga', 'Ajuste manual por caminhão', 'Validação de peso e capacidade'],
            },
            {
              title: 'Operação',
              color: '#3b82f6',
              items: ['Google Maps com múltiplas paradas', 'Execução guiada por motorista', 'Check de entrega com horário real', 'Romaneio de carregamento'],
            },
            {
              title: 'Controle',
              color: '#10b981',
              items: ['Assinatura digital do cliente', 'Foto da entrega', 'Relatórios completos', 'Histórico de operações'],
            },
          ].map((col, i) => (
            <div key={i} className="lp-glass rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1" style={{ borderColor: `${col.color}20` }}>
              <h3 className="mb-6 text-xl font-bold" style={{ color: col.color }}>{col.title}</h3>
              <ul className="space-y-3">
                {col.items.map((item, j) => (
                  <li key={j} className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 shrink-0" style={{ color: col.color }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* PLANOS */}
      <Section id="planos" className="relative">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(30,41,59,1) 50%, rgba(15,23,42,1) 100%)' }} />
        <div className="relative z-10">
          <SectionTitle sub="Escolha o plano ideal para o tamanho da sua operação">
            Planos e Preços
          </SectionTitle>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Free */}
            {/* Free */}
            <div className="lp-glass rounded-2xl p-6 flex flex-col">
              <h3 className="text-xl font-bold text-white">Free</h3>
              <p className="mt-1 text-sm text-slate-400">Para testar o sistema</p>
              <p className="mt-4 text-3xl font-extrabold text-white">R$ 0<span className="text-base font-normal text-slate-500">/mês</span></p>
              <ul className="mt-6 space-y-3 text-sm">
                {['Até 1 caminhão', 'Roteirização básica', 'Romaneio simples'].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-300"><Check className="h-4 w-4 text-orange-400" />{f}</li>
                ))}
                {['Prova de entrega', 'Suporte'].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-500"><X className="h-4 w-4" />{f}</li>
                ))}
              </ul>
              <Link to="/login" className="mt-auto pt-6 block">
                <Button className="w-full text-white hover:brightness-110" style={{ background: 'rgba(249,115,22,0.25)', border: '1px solid rgba(249,115,22,0.4)' }}>Começar grátis</Button>
              </Link>
            </div>

            {/* Premium */}
            <div className="relative rounded-2xl p-6 flex flex-col" style={{
              background: 'rgba(249,115,22,0.05)',
              border: '2px solid rgba(249,115,22,0.4)',
              boxShadow: '0 0 40px rgba(249,115,22,0.1)'
            }}>
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 text-white border-0" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>Mais popular</Badge>
              <h3 className="text-xl font-bold text-white">Premium</h3>
              <p className="mt-1 text-sm text-slate-400">Para operações em crescimento</p>
              <p className="mt-4 text-3xl font-extrabold text-white">R$ 197<span className="text-base font-normal text-slate-500">/mês</span></p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  'Até 6 caminhões', 'Roteirização inteligente', 'Ajuste manual de rotas',
                  'Google Maps com paradas', 'Confirmação de entrega', 'Relatórios operacionais', 'Suporte padrão',
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-300"><Check className="h-4 w-4 text-orange-400" />{f}</li>
                ))}
              </ul>
              <Link to="/login" className="mt-auto pt-6 block">
                <Button className="w-full text-white border-0" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>Começar agora</Button>
              </Link>
            </div>

            {/* Pro */}
            <div className="lp-glass rounded-2xl p-6 flex flex-col">
              <h3 className="text-xl font-bold text-white">Pro</h3>
              <p className="mt-1 text-sm text-slate-400">Para grandes operações</p>
              <p className="mt-4 text-3xl font-extrabold text-white">R$ 397<span className="text-base font-normal text-slate-500">/mês</span></p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  'Até 15 caminhões', 'Tudo do Premium', 'Assinatura do cliente',
                  'Foto da entrega', 'Histórico completo', 'Controle de usuários', 'Suporte prioritário',
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-300"><Check className="h-4 w-4 text-orange-400" />{f}</li>
                ))}
              </ul>
              <Link to="/login" className="mt-auto pt-6 block">
                <Button className="w-full text-white hover:brightness-110" style={{ background: 'rgba(249,115,22,0.25)', border: '1px solid rgba(249,115,22,0.4)' }}>Falar com vendas</Button>
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {/* DIFERENCIAL */}
      <section className="px-4 py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(59,130,246,0.1))'
        }} />
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 md:flex-row md:gap-16 relative z-10">
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              Não é só roteirização. <span className="text-slate-400">É execução.</span>
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-300">
              O Rota Certa não para no planejamento. Ele acompanha a entrega até o fim, com evidência real e controle total da operação.
            </p>
          </div>
          <div className="flex shrink-0 items-center justify-center">
            <div className="flex h-32 w-32 items-center justify-center rounded-3xl lp-pulse-glow" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)' }}>
              <Zap className="h-16 w-16 text-orange-400" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="px-4 py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(135deg, #f97316, #ea580c)'
        }} />
        <div className="mx-auto max-w-3xl text-center relative z-10">
          <h2 className="text-3xl font-bold text-white md:text-4xl">
            Pare de planejar no improviso. Comece a operar com controle.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
            Teste o Rota Certa gratuitamente e veja sua operação funcionar como deveria.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/login">
              <Button size="lg" className="h-14 px-8 text-base font-semibold" style={{ background: '#0f172a', color: '#fff' }}>
                Testar gratuitamente <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a href="#como-funciona">
              <Button size="lg" variant="outline" className="h-14 px-8 text-base border-white/30 text-white hover:bg-white/10">
                Ver demonstração
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-4 py-12 border-t border-white/10" style={{ background: '#0b1120' }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 md:flex-row md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
              <Truck className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">Rota Certa</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-slate-300 transition-colors">Termos</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Privacidade</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Contato</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Suporte</a>
          </div>
          <p className="text-sm text-slate-600">© 2026 Rota Certa</p>
        </div>
      </footer>
    </div>
  );
}
