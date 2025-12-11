import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Bot, Star } from "lucide-react";

const plans = [
  {
    name: "Básico",
    price: 97,
    description: "Para pequenas empresas",
    features: [
      "Até 50 clientes",
      "Notificações automáticas",
      "1 usuário",
      "Dashboard básico",
      "Suporte por email",
    ],
    popular: false,
    hasAI: false,
  },
  {
    name: "Profissional",
    price: 197,
    description: "Para empresas em crescimento",
    features: [
      "Até 200 clientes",
      "Notificações automáticas",
      "5 usuários",
      "Dashboard completo",
      "Contratos digitais",
      "Multi-gateway",
      "Suporte prioritário",
    ],
    popular: true,
    hasAI: false,
  },
  {
    name: "Enterprise",
    price: 397,
    description: "Para grandes operações",
    features: [
      "Clientes ilimitados",
      "Gerente de Contas IA",
      "Usuários ilimitados",
      "Dashboard avançado",
      "Contratos digitais",
      "Multi-gateway",
      "White-label completo",
      "API personalizada",
      "Suporte 24/7",
    ],
    popular: false,
    hasAI: true,
  },
];

export const LandingPricing = () => {
  const whatsappLink = "https://wa.me/5521992081803?text=Olá! Tenho interesse no plano ";

  return (
    <section className="py-24 bg-gradient-to-b from-card/50 to-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Planos para todos os tamanhos
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Escolha o plano ideal para sua empresa e comece a automatizar hoje
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className={`relative rounded-2xl p-6 ${
                plan.popular
                  ? "bg-gradient-to-b from-primary/10 to-card border-2 border-primary shadow-xl shadow-primary/10"
                  : "bg-card border border-border"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    <Star className="w-3 h-3" />
                    POPULAR
                  </span>
                </div>
              )}

              {plan.hasAI && (
                <div className="absolute -top-3 right-4">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-medium">
                    <Bot className="w-3 h-3" />
                    GERENTE IA
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center gap-2 text-sm">
                    <Check className={`w-4 h-4 ${plan.popular ? "text-primary" : "text-emerald-500"}`} />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={plan.popular ? "hero" : "outline"}
                onClick={() => window.open(`${whatsappLink}${plan.name}`, "_blank")}
              >
                Contratar {plan.name}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
