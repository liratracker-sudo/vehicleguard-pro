import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, User, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface Scenario {
  id: string;
  name: string;
  icon: string;
  messages: Message[];
}

const scenarios: Scenario[] = [
  {
    id: "inadimplentes",
    name: "Consultar Inadimplentes",
    icon: "📋",
    messages: [
      { id: "1", role: "user", content: "Quem está devendo?", timestamp: "10:30" },
      { id: "2", role: "assistant", content: "📊 *RELATÓRIO DE INADIMPLENTES*\n━━━━━━━━━━━━━━━━━━\n\nVocê tem *3 clientes* inadimplentes totalizando *R$ 2.450,00*:\n\n1️⃣ *João Silva*\n   💰 R$ 800,00 (15 dias de atraso)\n   📱 (21) 99999-1111\n\n2️⃣ *Maria Santos*\n   💰 R$ 1.150,00 (8 dias de atraso)\n   📱 (21) 99999-2222\n\n3️⃣ *Pedro Costa*\n   💰 R$ 500,00 (3 dias de atraso)\n   📱 (21) 99999-3333\n\nDeseja que eu envie cobrança para algum deles?", timestamp: "10:30" },
    ],
  },
  {
    id: "cobranca",
    name: "Cobrança Imediata",
    icon: "💰",
    messages: [
      { id: "1", role: "user", content: "Cobra o João com tom agressivo", timestamp: "14:15" },
      { id: "2", role: "assistant", content: "✅ *COBRANÇA ENVIADA!*\n━━━━━━━━━━━━━━━━━━\n\n👤 Cliente: *João Silva*\n📱 Telefone: (21) 99999-1111\n💰 Valor: R$ 800,00\n🎭 Tom: AGRESSIVO\n\n📝 *Mensagem enviada:*\n\n\"Sr. João, esta é uma NOTIFICAÇÃO URGENTE. Sua fatura de R$ 800,00 está vencida há 15 dias e não podemos mais aguardar. O não pagamento IMEDIATO resultará em negativação do CPF nos órgãos de proteção ao crédito e possíveis medidas judiciais. Regularize HOJE: [link do pix]\"\n\n✅ Mensagem entregue às 14:15", timestamp: "14:15" },
    ],
  },
  {
    id: "lembrete",
    name: "Agendar Lembrete",
    icon: "⏰",
    messages: [
      { id: "1", role: "user", content: "Me lembra amanhã às 14h de revisar os contratos", timestamp: "18:00" },
      { id: "2", role: "assistant", content: "✅ *LEMBRETE AGENDADO!*\n━━━━━━━━━━━━━━━━━━\n\n📅 Data: *12/12/2025*\n⏰ Horário: *14:00*\n📝 Mensagem: \"Revisar os contratos\"\n\nVou te enviar uma notificação no horário programado! 🔔", timestamp: "18:00" },
    ],
  },
  {
    id: "relatorio",
    name: "Relatório Financeiro",
    icon: "📊",
    messages: [
      { id: "1", role: "user", content: "Gera um relatório financeiro", timestamp: "09:00" },
      { id: "2", role: "assistant", content: "📊 *RELATÓRIO FINANCEIRO*\n━━━━━━━━━━━━━━━━━━\n📅 Data: 11/12/2025\n\n💵 *RESUMO DO DIA*\n├ Recebido hoje: *R$ 3.200,00*\n├ Pagamentos: 5 confirmados\n└ Método mais usado: PIX (80%)\n\n⚠️ *INADIMPLÊNCIA*\n├ Total em atraso: *R$ 2.450,00*\n├ Clientes: 3\n└ Maior atraso: 15 dias\n\n📅 *PRÓXIMOS VENCIMENTOS*\n├ Pendente: *R$ 5.800,00*\n├ Cobranças: 12\n└ Vence esta semana: 4\n\n👥 *CLIENTES*\n├ Total: 45\n├ Ativos: 42\n└ Novos (mês): 3\n\n📈 Taxa de inadimplência: *6,6%*\n✅ Dentro da meta (<10%)", timestamp: "09:01" },
    ],
  },
];

const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-4 py-3">
    <motion.div
      className="w-2 h-2 bg-muted-foreground/50 rounded-full"
      animate={{ scale: [1, 1.2, 1] }}
      transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
    />
    <motion.div
      className="w-2 h-2 bg-muted-foreground/50 rounded-full"
      animate={{ scale: [1, 1.2, 1] }}
      transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
    />
    <motion.div
      className="w-2 h-2 bg-muted-foreground/50 rounded-full"
      animate={{ scale: [1, 1.2, 1] }}
      transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
    />
  </div>
);

const MessageBubble = ({ message, isNew }: { message: Message; isNew: boolean }) => {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 20, scale: 0.95 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn("flex gap-2 mb-3", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2 shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-card border border-border rounded-bl-md"
        )}
      >
        <p className="text-sm whitespace-pre-line">{message.content}</p>
        <span className={cn("text-[10px] mt-1 block text-right", isUser ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {message.timestamp}
        </span>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-primary" />
        </div>
      )}
    </motion.div>
  );
};

const WhatsAppChatSimulator = () => {
  const [activeScenario, setActiveScenario] = useState(scenarios[0]);
  const [displayedMessages, setDisplayedMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    setDisplayedMessages([]);
    setIsTyping(false);

    const showMessages = async () => {
      for (let i = 0; i < activeScenario.messages.length; i++) {
        const msg = activeScenario.messages[i];
        
        if (msg.role === "assistant") {
          setIsTyping(true);
          await new Promise(resolve => setTimeout(resolve, 1500));
          setIsTyping(false);
        }

        setDisplayedMessages(prev => [...prev, msg]);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    };

    showMessages();
  }, [activeScenario]);

  return (
    <section className="py-16 px-4">
      <div className="container mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Simulador de Conversa
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Veja como o Gerente de Contas Virtual interage com você pelo WhatsApp
          </p>
        </motion.div>

        {/* Scenario selector */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {scenarios.map((scenario) => (
            <Button
              key={scenario.id}
              variant={activeScenario.id === scenario.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveScenario(scenario)}
              className="gap-2"
            >
              <span>{scenario.icon}</span>
              {scenario.name}
            </Button>
          ))}
        </div>

        {/* Chat window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-lg mx-auto"
        >
          <div className="rounded-2xl overflow-hidden border border-border shadow-2xl shadow-black/10">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Gerente IA</h3>
                <p className="text-xs text-white/70">online</p>
              </div>
            </div>

            {/* Messages */}
            <div className="bg-[#0b141a] min-h-[400px] max-h-[500px] overflow-y-auto p-4">
              <AnimatePresence>
                {displayedMessages.map((msg, index) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isNew={index === displayedMessages.length - 1}
                  />
                ))}
              </AnimatePresence>
              {isTyping && (
                <div className="flex gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-card border border-border rounded-2xl rounded-bl-md">
                    <TypingIndicator />
                  </div>
                </div>
              )}
            </div>

            {/* Input bar */}
            <div className="bg-[#1f2c34] px-4 py-3 flex items-center gap-3">
              <input
                type="text"
                placeholder="Digite uma mensagem..."
                className="flex-1 bg-[#2a3942] rounded-full px-4 py-2 text-sm text-white placeholder:text-white/50 outline-none"
                disabled
              />
              <Button size="icon" className="rounded-full bg-green-500 hover:bg-green-600">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default WhatsAppChatSimulator;
