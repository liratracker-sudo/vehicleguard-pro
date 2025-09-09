import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { useAsaasRealtime } from '@/hooks/useAsaasRealtime';

export function AsaasStatusIndicator() {
  const { isConnected, triggerSync, lastUpdate } = useAsaasRealtime();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync();
    } finally {
      setSyncing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'overdue':
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <AlertCircle className="w-4 h-4 text-warning" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Pago';
      case 'overdue':
        return 'Em Atraso';
      case 'cancelled':
        return 'Cancelado';
      case 'pending':
        return 'Pendente';
      default:
        return status;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span className="flex items-center gap-2">
            Status Asaas
            {isConnected ? (
              <Wifi className="w-4 h-4 text-success" />
            ) : (
              <WifiOff className="w-4 h-4 text-muted-foreground" />
            )}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="h-7 px-2"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${syncing ? 'animate-spin' : ''}`} />
            Sync
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Conexão:</span>
          <Badge variant={isConnected ? 'default' : 'secondary'} className="text-xs">
            {isConnected ? 'Online' : 'Offline'}
          </Badge>
        </div>

        {lastUpdate && (
          <div className="space-y-2 p-2 rounded-md bg-muted/50">
            <div className="text-xs font-medium">Última Atualização:</div>
            <div className="flex items-center gap-2">
              {getStatusIcon(lastUpdate.newStatus)}
              <span className="text-xs">
                {getStatusLabel(lastUpdate.oldStatus)} → {getStatusLabel(lastUpdate.newStatus)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(lastUpdate.updatedAt).toLocaleString('pt-BR')}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {isConnected 
            ? 'Atualizações automáticas ativas'
            : 'Use o botão Sync para verificar manualmente'
          }
        </div>
      </CardContent>
    </Card>
  );
}