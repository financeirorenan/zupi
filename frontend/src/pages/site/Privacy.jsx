import { Link } from "react-router-dom";
import Logo from "@/components/Logo";

const SECTIONS = [
  ["Quem somos", "A Zupi Delivery é um marketplace de delivery local que conecta clientes a restaurantes e estabelecimentos da sua cidade. Esta política explica como tratamos seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018)."],
  ["Dados que coletamos", "Cadastro: nome, e-mail, telefone e senha (armazenada de forma criptografada). Pedidos: endereços de entrega, itens, forma de pagamento escolhida e histórico. Uso do app: cidade selecionada, favoritos, avaliações e, se você autorizar, o token para envio de notificações. Não armazenamos dados completos de cartão de crédito."],
  ["Para que usamos", "Processar e entregar seus pedidos, comunicar o status (notificações, e-mail e WhatsApp pelo restaurante), oferecer cupons e promoções, prevenir fraudes, cumprir obrigações legais e melhorar o serviço."],
  ["Com quem compartilhamos", "Com o restaurante do seu pedido (nome, telefone, endereço e itens — o mínimo necessário para preparar e entregar), com entregadores do restaurante e com sistemas de PDV integrados pelo restaurante. Com provedores de infraestrutura (hospedagem, armazenamento de imagens, envio de e-mail e notificações). Nunca vendemos seus dados."],
  ["Seus direitos", "Você pode acessar, corrigir e excluir seus dados a qualquer momento em Perfil, ou solicitar a exclusão completa da conta pelo e-mail abaixo. Também pode revogar as notificações nas configurações do aparelho."],
  ["Retenção e segurança", "Mantemos os dados enquanto sua conta estiver ativa e pelo prazo legal necessário para registros fiscais de pedidos. Usamos criptografia em trânsito (HTTPS), senhas com hash e controle de acesso por perfil."],
  ["Cookies", "Usamos apenas cookies essenciais para manter sua sessão autenticada. Não usamos cookies de rastreamento publicitário."],
  ["Contato", "Encarregado de dados (DPO): financeirorenanuk@gmail.com. Responderemos em até 15 dias."],
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900" data-testid="privacy-page">
      <header className="bg-[#121212] text-white">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center gap-4">
          <Link to="/"><Logo light /></Link>
          <span className="text-xs font-bold tracking-[0.2em] text-orange-400">PRIVACIDADE</span>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-5 py-10 space-y-8">
        <div>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl">Política de Privacidade</h1>
          <p className="text-slate-500 mt-2">Última atualização: junho de 2026</p>
        </div>
        {SECTIONS.map(([t, body]) => (
          <section key={t}>
            <h2 className="font-display font-bold text-base md:text-lg">{t}</h2>
            <p className="text-slate-600 mt-1 leading-relaxed">{body}</p>
          </section>
        ))}
        <p className="text-sm text-slate-400 pt-6 border-t">© {new Date().getFullYear()} Zupi Delivery · <Link to="/" className="hover:text-orange-600">Início</Link> · <Link to="/app" className="hover:text-orange-600">Abrir o app</Link></p>
      </main>
    </div>
  );
}
