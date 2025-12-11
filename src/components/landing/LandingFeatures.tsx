import { motion } from "framer-motion";
import { 
  Bot, 
  Bell, 
  FileText, 
  CreditCard, 
  BarChart3, 
  Building2,
  MessageSquare,
  Shield
} from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "Gerente de Contas Virtual",
    description: "Assistente de IA via WhatsApp que cobra, consulta e gerencia automaticamente.",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    icon: Bell,
    title: "Notificações Automáticas",
    description: "Lembretes de vencimento pré e pós-vencimento enviados automaticamente.",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: FileText,
    title: "Contratos Digitais",
    description: "Gere e envie contratos para assinatura digital integrado com Assinafy.",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    icon: CreditCard,
    title: "Multi-Gateway",
    description: "Integração com Asaas, MercadoPago, Inter e Gerencianet para cobranças.",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    icon: BarChart3,
    title: "Dashboard Completo",
    description: "Relatórios financeiros, métricas e análises em tempo real.",
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
  },
  {
    icon: Building2,
    title: "White-Label",
    description: "Personalize com sua marca, cores e domínio próprio.",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Evolution",
    description: "Integração oficial com Evolution API para mensagens em massa.",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    icon: Shield,
    title: "Segurança Total",
    description: "Dados criptografados, autenticação segura e backup automático.",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
];

export const LandingFeatures = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Tudo que você precisa em um só lugar
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Sistema completo de gestão financeira com automações inteligentes
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="group p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className={`w-12 h-12 rounded-lg ${feature.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <feature.icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
