import { motion } from "framer-motion";
import { 
  Users, 
  CreditCard, 
  FileText, 
  Bell, 
  Calendar, 
  Search, 
  MessageSquare,
  TrendingUp
} from "lucide-react";

const commands = [
  {
    icon: Users,
    title: "Consultar Inadimplentes",
    description: "Lista todos os clientes com pagamentos em atraso",
    examples: ["Quem está devendo?", "Lista inadimplentes", "Clientes em atraso"],
    color: "from-red-500 to-orange-500",
  },
  {
    icon: CreditCard,
    title: "Forçar Cobrança",
    description: "Envia cobrança imediata para cliente específico",
    examples: ["Cobra o João", "Envia cobrança para Maria", "Cobra cliente X com tom firme"],
    color: "from-green-500 to-emerald-500",
  },
  {
    icon: FileText,
    title: "Relatório Financeiro",
    description: "Gera resumo completo das finanças da empresa",
    examples: ["Me envia um relatório", "Resumo financeiro", "Como estão as finanças?"],
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Bell,
    title: "Agendar Lembrete",
    description: "Cria lembrete para data e hora específica",
    examples: ["Me lembra amanhã às 9h", "Agenda lembrete para sexta", "Lembra de ligar para cliente"],
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: Calendar,
    title: "Agendar Cobrança",
    description: "Programa cobrança para momento específico",
    examples: ["Agenda cobrança do Pedro para sexta às 10h", "Cobra João amanhã de manhã"],
    color: "from-amber-500 to-yellow-500",
  },
  {
    icon: Search,
    title: "Informações de Cliente",
    description: "Busca dados cadastrais completos do cliente",
    examples: ["Qual o telefone do Maria?", "Dados do João Silva", "Endereço do cliente X"],
    color: "from-indigo-500 to-violet-500",
  },
  {
    icon: TrendingUp,
    title: "Pagamentos de Hoje",
    description: "Lista todos os pagamentos recebidos no dia",
    examples: ["Quem pagou hoje?", "Pagamentos de hoje", "Entradas do dia"],
    color: "from-teal-500 to-green-500",
  },
  {
    icon: MessageSquare,
    title: "Busca Web",
    description: "Pesquisa informações gerais na internet",
    examples: ["Cotação do dólar hoje", "Previsão do tempo", "Notícias do mercado"],
    color: "from-slate-500 to-zinc-500",
  },
];

const CommandsShowcase = () => {
  return (
    <section className="py-16 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Comandos Disponíveis
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Converse naturalmente com a IA. Ela entende linguagem natural e executa as ações automaticamente.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {commands.map((command, index) => (
            <motion.div
              key={command.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group"
            >
              <div className="h-full bg-card border border-border rounded-xl p-5 hover:shadow-lg hover:shadow-black/5 transition-all duration-300 hover:-translate-y-1">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${command.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <command.icon className="w-6 h-6 text-white" />
                </div>

                {/* Title & Description */}
                <h3 className="font-semibold text-lg mb-2">{command.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{command.description}</p>

                {/* Examples */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Exemplos:</p>
                  {command.examples.map((example, i) => (
                    <div
                      key={i}
                      className="text-xs px-3 py-1.5 bg-muted/50 rounded-lg text-muted-foreground italic"
                    >
                      "{example}"
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CommandsShowcase;
