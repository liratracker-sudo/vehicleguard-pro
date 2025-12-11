import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Bot, MessageSquare, Calendar, FileText, Bell, TrendingUp, ArrowRight } from "lucide-react";

export const LandingAIShowcase = () => {
  const features = [
    { icon: MessageSquare, text: "Cobrar clientes com tons personalizados" },
    { icon: FileText, text: "Gerar relatórios financeiros instantâneos" },
    { icon: Calendar, text: "Agendar lembretes e cobranças" },
    { icon: Bell, text: "Notificações automáticas de vencimento" },
    { icon: TrendingUp, text: "Consultar inadimplentes em tempo real" },
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-background to-card/50">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm font-medium mb-4">
              <Bot className="w-4 h-4" />
              Destaque
            </span>
            
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Gerente de Contas Virtual por IA
            </h2>
            
            <p className="text-lg text-muted-foreground mb-6">
              Converse com seu assistente de IA via WhatsApp e gerencie suas cobranças 
              de forma inteligente. Ele entende linguagem natural e executa ações automaticamente.
            </p>

            <ul className="space-y-3 mb-8">
              {features.map((feature, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="flex items-center gap-3 text-muted-foreground"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <feature.icon className="w-4 h-4 text-primary" />
                  </div>
                  {feature.text}
                </motion.li>
              ))}
            </ul>

            <Button
              variant="premium"
              size="lg"
              onClick={() => window.location.href = "/demo"}
              className="group"
            >
              Ver Demonstração Interativa
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>

          {/* Right - Chat Preview */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-emerald-600 px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-white font-medium">Gerente IA</div>
                  <div className="text-emerald-100 text-xs">Online</div>
                </div>
              </div>

              {/* Messages */}
              <div className="p-4 space-y-3 bg-[#0b141a] min-h-[300px]">
                <div className="flex justify-end">
                  <div className="bg-emerald-700 text-white px-3 py-2 rounded-lg rounded-tr-none max-w-[80%] text-sm">
                    Quem está inadimplente?
                  </div>
                </div>
                
                <div className="flex justify-start">
                  <div className="bg-[#1f2c34] text-gray-100 px-3 py-2 rounded-lg rounded-tl-none max-w-[85%] text-sm">
                    <p className="mb-2">📊 <strong>3 clientes inadimplentes</strong> totalizando <strong>R$ 2.450,00</strong>:</p>
                    <p className="text-gray-300">1. João Silva - R$ 800,00 (15 dias)</p>
                    <p className="text-gray-300">2. Maria Santos - R$ 1.150,00 (8 dias)</p>
                    <p className="text-gray-300">3. Pedro Costa - R$ 500,00 (3 dias)</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="bg-emerald-700 text-white px-3 py-2 rounded-lg rounded-tr-none max-w-[80%] text-sm">
                    Cobra o João com tom firme
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="bg-[#1f2c34] text-gray-100 px-3 py-2 rounded-lg rounded-tl-none max-w-[85%] text-sm">
                    ✅ <strong>Cobrança enviada para João Silva!</strong>
                    <p className="text-gray-400 text-xs mt-1">Tom: Firme | Via WhatsApp</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};
