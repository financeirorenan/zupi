import { useState } from "react";
import { Link } from "react-router-dom";
import { Zap, Store, Smartphone, Bike, Wallet, Plug, ArrowRight, Check, MapPin, Star, Clock } from "lucide-react";
import Logo from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api, apiError } from "@/lib/api";
import { toast } from "sonner";

const BENEFITS = [
  { icon: Wallet, title: "Só R$ 2,00 por pedido", text: "Sem porcentagem sobre a venda, sem mensalidade. Você sabe exatamente quanto paga." },
  { icon: Bike, title: "Motoboy da casa", text: "Cadastre seus entregadores, controle diárias e cobre a taxa de entrega por bairro." },
  { icon: Smartphone, title: "App que instala no celular", text: "Seus clientes pedem pelo app Zupi da cidade, com cupons, favoritos e acompanhamento ao vivo." },
  { icon: Plug, title: "Integra com seu PDV", text: "API aberta e webhooks prontos para Saipos, TakeEat, Consumer e qualquer sistema." },
  { icon: Clock, title: "Central de Pedidos para tablet", text: "Alerta sonoro, tela cheia e fluxo de status pensado para o balcão." },
  { icon: MapPin, title: "Feito para cidades pequenas", text: "Bairros reais da sua cidade, restaurantes que os clientes já conhecem." },
];

const STEPS = ["Cadastre seu restaurante em 5 minutos", "Monte o cardápio com fotos e adicionais", "Receba pedidos no tablet e entregue com seu motoboy"];

export default function Landing() {
  const [form, setForm] = useState({ name: "", business: "", city: "", phone: "", email: "" });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/leads", form);
      setSent(true);
      toast.success("Recebemos seu contato! Vamos falar com você em breve.");
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white" data-testid="landing-page">
      <header className="max-w-6xl mx-auto px-5 h-20 flex items-center gap-4">
        <Logo light />
        <div className="flex-1" />
        <Link to="/dev" data-testid="landing-dev-link" className="hidden sm:block text-sm font-semibold text-slate-400 hover:text-white">Desenvolvedores</Link>
        <Link to="/entrar" data-testid="landing-login-link" className="text-sm font-semibold text-slate-300 hover:text-white">Entrar</Link>
        <Link to="/app" data-testid="landing-open-app" className="h-11 px-5 rounded-full bg-white text-slate-900 text-sm font-bold flex items-center gap-2 hover:bg-orange-50">
          <Smartphone className="w-4 h-4" /> Abrir o app
        </Link>
      </header>

      <section className="max-w-6xl mx-auto px-5 pt-10 pb-20 grid lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-orange-400 uppercase">
            <Zap className="w-4 h-4" fill="currentColor" /> O delivery da sua cidade
          </span>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-[1.05] mt-4">
            Venda mais no delivery pagando <span className="text-orange-500">R$ 2 por pedido</span>. Só isso.
          </h1>
          <p className="text-slate-400 text-base md:text-lg mt-6 max-w-xl">
            A Zupi é o marketplace de delivery feito para cidades pequenas e médias. Sem comissão abusiva, com motoboy da casa e integração com o seu PDV.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link to="/cadastrar?tipo=restaurante" data-testid="landing-cta-register" className="h-14 px-7 rounded-full bg-orange-600 hover:bg-orange-500 font-bold flex items-center gap-2 transition-colors">
              <Store className="w-5 h-5" /> Cadastrar meu restaurante <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#contato" data-testid="landing-cta-contact" className="h-14 px-7 rounded-full border border-white/20 hover:bg-white/10 font-bold flex items-center transition-colors">Falar com a Zupi</a>
          </div>
          <div className="flex flex-wrap gap-6 mt-10 text-sm text-slate-400">
            {["Sem mensalidade", "Sem % sobre a venda", "Cancele quando quiser"].map((t) => (
              <span key={t} className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> {t}</span>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 bg-orange-600/20 blur-3xl rounded-full" />
          <div className="relative bg-white text-slate-900 rounded-[2rem] p-5 shadow-2xl rotate-[-2deg]" data-testid="landing-mock-order">
            <div className="flex items-center justify-between">
              <p className="font-display font-extrabold text-lg">#1042</p>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Novo pedido</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Ana Oliveira • Pix • Entrega — Jardim Santa Rosa</p>
            <div className="mt-3 space-y-1 text-sm">
              <p><b>2x</b> Marmita Parmegiana</p><p><b>1x</b> Refrigerante 2L</p>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <span className="font-display font-extrabold text-orange-600 text-xl">R$ 58,80</span>
              <span className="text-xs text-slate-500">Taxa Zupi: R$ 2,00</span>
            </div>
            <div className="mt-4 h-11 rounded-xl bg-emerald-500 text-white font-bold flex items-center justify-center gap-2"><Check className="w-4 h-4" /> Aceitar</div>
          </div>
          <div className="relative -mt-8 ml-auto w-3/4 bg-[#1f1f1f] border border-white/10 rounded-2xl p-4 rotate-[2deg]">
            <div className="flex items-center gap-1 text-orange-400"><Star className="w-4 h-4" fill="currentColor" /><Star className="w-4 h-4" fill="currentColor" /><Star className="w-4 h-4" fill="currentColor" /><Star className="w-4 h-4" fill="currentColor" /><Star className="w-4 h-4" fill="currentColor" /></div>
            <p className="text-sm text-slate-300 mt-2">"Migrei do app grande e economizei mais de R$ 900 no primeiro mês."</p>
            <p className="text-xs text-slate-500 mt-1">Carlos, Sabor da Terra — Sertãozinho</p>
          </div>
        </div>
      </section>

      <section className="bg-[#F8F9FA] text-slate-900 py-20">
        <div className="max-w-6xl mx-auto px-5">
          <p className="text-xs font-bold tracking-[0.2em] text-orange-600 uppercase">Por que Zupi</p>
          <h2 className="font-display font-extrabold text-base md:text-lg mt-2 max-w-2xl">Tudo que um restaurante de cidade pequena precisa para vender no delivery — sem pagar o preço das capitais.</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="bg-white rounded-2xl border p-6 hover:-translate-y-1 hover:shadow-lg transition-transform" data-testid="landing-benefit">
                <div className="w-11 h-11 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center"><Icon className="w-5 h-5" /></div>
                <h3 className="font-display font-bold mt-4">{title}</h3>
                <p className="text-sm text-slate-500 mt-1">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-orange-400 uppercase">Como funciona</p>
          <h2 className="font-display font-extrabold text-base md:text-lg mt-2">Comece a vender hoje</h2>
          <ol className="mt-8 space-y-5">
            {STEPS.map((s, i) => (
              <li key={s} className="flex gap-4 items-start">
                <span className="w-9 h-9 rounded-full bg-orange-600 font-display font-extrabold flex items-center justify-center shrink-0">{i + 1}</span>
                <p className="text-slate-300 pt-1.5">{s}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="bg-[#1f1f1f] border border-white/10 rounded-3xl p-8" data-testid="landing-pricing">
          <p className="text-xs font-bold tracking-[0.2em] text-orange-400 uppercase">Preço transparente</p>
          <p className="font-display font-extrabold text-5xl mt-3">R$ 2,00<span className="text-lg text-slate-400 font-bold"> / pedido</span></p>
          <ul className="mt-6 space-y-2 text-sm text-slate-300">
            {["Painel do lojista completo", "Cardápio com fotos e adicionais", "Cupons e promoções", "Logística com motoboy da casa", "API aberta e webhooks", "Suporte via WhatsApp"].map((t) => (
              <li key={t} className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> {t}</li>
            ))}
          </ul>
          <Link to="/cadastrar?tipo=restaurante" data-testid="landing-pricing-cta" className="mt-8 h-12 rounded-full bg-orange-600 hover:bg-orange-500 font-bold flex items-center justify-center gap-2">Criar conta grátis <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </section>

      <section id="contato" className="bg-orange-600 py-20">
        <div className="max-w-6xl mx-auto px-5 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="font-display font-extrabold text-base md:text-lg">Quer levar a Zupi para a sua cidade?</h2>
            <p className="text-orange-100 mt-3">Deixe seu contato. Nossa equipe ajuda a cadastrar o restaurante, importar o cardápio e treinar a equipe no tablet.</p>
          </div>
          <form onSubmit={submit} className="bg-white text-slate-900 rounded-3xl p-6 grid sm:grid-cols-2 gap-3" data-testid="lead-form">
            {sent ? (
              <p className="sm:col-span-2 text-center py-8 font-bold text-emerald-600" data-testid="lead-success">Contato recebido! Falamos com você em breve.</p>
            ) : (
              <>
                <Input data-testid="lead-name" required placeholder="Seu nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 rounded-xl" />
                <Input data-testid="lead-business" placeholder="Nome do restaurante" value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} className="h-12 rounded-xl" />
                <Input data-testid="lead-city" required placeholder="Cidade *" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="h-12 rounded-xl" />
                <Input data-testid="lead-phone" required placeholder="WhatsApp *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-12 rounded-xl" />
                <Input data-testid="lead-email" type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-12 rounded-xl sm:col-span-2" />
                <Button data-testid="lead-submit" disabled={loading} className="h-12 rounded-xl font-bold sm:col-span-2">{loading ? "Enviando..." : "Quero a Zupi na minha cidade"}</Button>
              </>
            )}
          </form>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-5 py-10 flex flex-wrap items-center gap-4 text-sm text-slate-500">
        <Logo light small />
        <div className="flex-1" />
        <Link to="/app" className="hover:text-white">App do cliente</Link>
        <Link to="/entrar" className="hover:text-white">Painel do lojista</Link>
        <Link to="/dev" className="hover:text-white">API para desenvolvedores</Link>
        <Link to="/privacidade" data-testid="landing-privacy-link" className="hover:text-white">Privacidade</Link>
        <span>© {new Date().getFullYear()} Zupi Delivery</span>
      </footer>
    </div>
  );
}
