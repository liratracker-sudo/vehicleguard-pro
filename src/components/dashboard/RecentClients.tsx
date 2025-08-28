import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const recentClients = [
  {
    id: 1,
    name: "Maria Santos",
    email: "maria@email.com",
    plan: "Premium",
    status: "active",
    joinedAt: "2024-01-15"
  },
  {
    id: 2,
    name: "João Oliveira",
    email: "joao@email.com",
    plan: "Básico",
    status: "active",
    joinedAt: "2024-01-14"
  },
  {
    id: 3,
    name: "Ana Costa",
    email: "ana@email.com",
    plan: "Premium",
    status: "suspended",
    joinedAt: "2024-01-13"
  },
  {
    id: 4,
    name: "Carlos Silva",
    email: "carlos@email.com",
    plan: "Empresarial",
    status: "active",
    joinedAt: "2024-01-12"
  }
]

export function RecentClients() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Clientes Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentClients.map((client) => (
            <div key={client.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {client.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium leading-none">{client.name}</p>
                  <p className="text-xs text-muted-foreground">{client.email}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-xs">
                  {client.plan}
                </Badge>
                <Badge 
                  variant={client.status === 'active' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {client.status === 'active' ? 'Ativo' : 'Suspenso'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}