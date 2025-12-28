import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { User, Session } from "@supabase/supabase-js"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Car, Eye, EyeOff } from "lucide-react"
import { SatelliteTrackingBackground } from "@/components/ui/satellite-tracking-background"
import { motion } from "framer-motion"

const AuthPage = () => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: ""
  })
  
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  
  const defaultTab = searchParams.get("tab") === "signup" ? "signup" : "signin"

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          // Redirect authenticated users to dashboard
          navigate("/dashboard")
        }
      }
    )

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        navigate("/dashboard")
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email || !formData.password) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    
    const { error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    })

    if (error) {
      toast({
        title: "Erro ao fazer login",
        description: error.message === "Invalid login credentials" 
          ? "Credenciais inválidas. Verifique seu email e senha."
          : error.message,
        variant: "destructive"
      })
    } else {
      toast({
        title: "Login realizado com sucesso!",
        description: "Redirecionando para o dashboard...",
      })
    }

    setLoading(false)
  }

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email || !formData.password || !formData.fullName) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    
    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: formData.fullName
        }
      }
    })

    if (error) {
      toast({
        title: "Erro ao criar conta",
        description: error.message === "User already registered" 
          ? "Este email já está cadastrado. Tente fazer login."
          : error.message,
        variant: "destructive"
      })
    } else {
      toast({
        title: "Conta criada com sucesso!",
        description: "Verifique seu email para confirmar a conta.",
      })
    }

    setLoading(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  // If user is already authenticated, redirect
  if (user) {
    navigate("/dashboard")
    return null
  }

  return (
    <SatelliteTrackingBackground
      showSatellite={true}
      showSignals={true}
      showGrid={true}
    >
      <div className="container mx-auto px-4 min-h-screen flex items-center justify-center py-4">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-full max-w-md px-2"
        >
          {/* Logo and Header */}
          <div className="text-center mb-2">
            <motion.div 
              className="w-10 h-10 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-xl flex items-center justify-center mx-auto mb-1"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Car className="w-5 h-5 text-white" />
            </motion.div>
            <motion.h1 
              className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              GestaoTracker
            </motion.h1>
            <motion.p 
              className="text-muted-foreground text-xs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              Sistema de Rastreamento Veicular
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <Card className="border border-border shadow-2xl bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base text-center">Acesse sua conta</CardTitle>
                <CardDescription className="text-center text-xs">
                  Entre com suas credenciais ou crie uma nova conta
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <Tabs defaultValue={defaultTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-9">
                    <TabsTrigger value="signin" className="text-sm">Entrar</TabsTrigger>
                    <TabsTrigger value="signup" className="text-sm">Cadastrar</TabsTrigger>
                  </TabsList>
              
              <TabsContent value="signin" className="mt-3">
                <form onSubmit={signIn} className="space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor="signin-email" className="text-xs">Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="h-9"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="signin-password" className="text-xs">Senha</Label>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Digite sua senha"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        className="h-9 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-9 w-9 px-0 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full mt-3 h-9" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="mt-3">
                <form onSubmit={signUp} className="space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor="signup-name" className="text-xs">Nome Completo</Label>
                    <Input
                      id="signup-name"
                      name="fullName"
                      type="text"
                      placeholder="Seu nome completo"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      required
                      className="h-9"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="signup-email" className="text-xs">Email</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="h-9"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="signup-password" className="text-xs">Senha</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Crie uma senha segura"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        minLength={6}
                        className="h-9 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-9 w-9 px-0 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Mínimo 6 caracteres
                    </p>
                  </div>
                  
                  <Button type="submit" className="w-full mt-3 h-9" disabled={loading}>
                    {loading ? "Criando conta..." : "Criar conta"}
                  </Button>
                </form>
              </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <p className="text-center text-[10px] text-muted-foreground mt-2">
              Ao continuar, você concorda com nossos Termos de Serviço e Política de Privacidade
            </p>
          </motion.div>
        </motion.div>
      </div>
    </SatelliteTrackingBackground>
  )
}

export default AuthPage