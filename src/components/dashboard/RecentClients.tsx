import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { RecentClient } from "@/hooks/useDashboardStats"

interface RecentClientsProps {
  clients: RecentClient[];
  isLoading?: boolean;
}

export function RecentClients({ clients, isLoading }: RecentClientsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Clientes Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-12" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (clients.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Clientes Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum cliente cadastrado ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clientes Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {clients.map((client) => (
            <div key={client.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium leading-none">{client.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {client.email || client.phone}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {client.planName && (
                  <Badge variant="outline" className="text-xs">
                    {client.planName}
                  </Badge>
                )}
                <Badge 
                  variant={client.status === 'active' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {client.status === 'active' ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
