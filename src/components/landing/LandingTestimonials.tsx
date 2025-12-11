import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Ricardo Oliveira",
    role: "Dono de Rastreamento",
    company: "RO Rastreadores",
    content: "Reduzi a inadimplência em 45% no primeiro mês usando o Gerente de Contas IA. O sistema cobra automaticamente e ainda responde minhas perguntas pelo WhatsApp!",
    rating: 5,
  },
  {
    name: "Fernanda Costa",
    role: "Gestora Financeira",
    company: "Track Pro",
    content: "Antes gastava 4 horas por dia com cobranças manuais. Agora o sistema faz tudo sozinho e ainda me manda relatórios semanais. Transformou minha rotina.",
    rating: 5,
  },
  {
    name: "Carlos Mendes",
    role: "Diretor",
    company: "GPS Total",
    content: "A integração com Asaas e WhatsApp é perfeita. Meus clientes recebem o boleto no WhatsApp e pagam na hora. PIX automático funcionando 100%.",
    rating: 5,
  },
];

export const LandingTestimonials = () => {
  return (
    <section className="py-24 bg-gradient-to-b from-background to-card/50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            O que nossos clientes dizem
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Empresas que já transformaram sua gestão financeira
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="relative bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-colors"
            >
              <Quote className="w-8 h-8 text-primary/20 absolute top-4 right-4" />
              
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                ))}
              </div>
              
              <p className="text-muted-foreground mb-6 relative z-10">
                "{testimonial.content}"
              </p>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-semibold">
                    {testimonial.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-foreground">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role} • {testimonial.company}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
