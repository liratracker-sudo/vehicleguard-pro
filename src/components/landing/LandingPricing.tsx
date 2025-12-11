import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Bot, Star, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export const LandingPricing = () => {
  const whatsappLink = "https://wa.me/5521992081803?text=Olá! Tenho interesse no plano ";

  const { data: plans, isLoading } = useQuery({
    queryKey: ['landing-subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const hasAIFeature = (features: string[] | null) => {
    if (!features) return false;
    return features.some(f => 
      f.toLowerCase().includes('gerente') || 
      f.toLowerCase().includes('ia') ||
      f.toLowerCase().includes('inteligência artificial')
    );
  };

  const formatFeatures = (plan: any) => {
    const features: string[] = [];
    
    if (plan.max_vehicles) {
      features.push(plan.max_vehicles >= 10000 ? "Veículos ilimitados" : `Até ${plan.max_vehicles} veículos`);
    }
    if (plan.max_users) {
      features.push(plan.max_users >= 100 ? "Usuários ilimitados" : `${plan.max_users} usuário${plan.max_users > 1 ? 's' : ''}`);
    }
    if (plan.max_messages_per_month) {
      features.push(plan.max_messages_per_month >= 100000 ? "Mensagens ilimitadas" : `${plan.max_messages_per_month.toLocaleString('pt-BR')} mensagens/mês`);
    }
    
    if (plan.features && Array.isArray(plan.features)) {
      features.push(...plan.features);
    }
    
    return features;
  };

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
            Escolha o plano ideal para sua empresa e comerce a automatizar hoje
          </p>
        </motion.div>

        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl p-6 bg-card border border-border">
                <Skeleton className="h-6 w-24 mx-auto mb-2" />
                <Skeleton className="h-4 w-32 mx-auto mb-4" />
                <Skeleton className="h-10 w-20 mx-auto mb-6" />
                <div className="space-y-3 mb-6">
                  {[1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
                </div>
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className={`grid gap-8 max-w-6xl mx-auto ${
            plans && plans.length <= 3 ? 'md:grid-cols-3' : 
            plans && plans.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 
            'md:grid-cols-2 lg:grid-cols-3'
          }`}>
            {plans?.map((plan, index) => {
              const isPopular = plan.name.toLowerCase() === 'profissional';
              const hasAI = hasAIFeature(plan.features as string[] | null);
              const features = formatFeatures(plan);

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className={`relative rounded-2xl p-6 ${
                    isPopular
                      ? "bg-gradient-to-b from-primary/10 to-card border-2 border-primary shadow-xl shadow-primary/10"
                      : "bg-card border border-border"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                        <Star className="w-3 h-3" />
                        POPULAR
                      </span>
                    </div>
                  )}

                  {hasAI && (
                    <div className="absolute -top-3 right-4">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-medium">
                        <Bot className="w-3 h-3" />
                        GERENTE IA
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-6 pt-2">
                    <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{plan.description || 'Plano completo'}</p>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-sm text-muted-foreground">R$</span>
                      <span className="text-4xl font-bold text-foreground">
                        {plan.price_monthly?.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                      </span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-6 min-h-[180px]">
                    {features.slice(0, 7).map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-2 text-sm">
                        <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isPopular ? "text-primary" : "text-emerald-500"}`} />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={isPopular ? "default" : "outline"}
                    onClick={() => window.open(`${whatsappLink}${plan.name}`, "_blank")}
                  >
                    Contratar {plan.name}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}

        <motion.p 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-muted-foreground mt-8"
        >
          Dúvidas? Fale conosco: <a href="tel:+5521992081803" className="text-primary hover:underline font-medium">(21) 99208-1803</a>
        </motion.p>
      </div>
    </section>
  );
};
