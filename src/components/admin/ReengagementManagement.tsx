import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useReengagement } from '@/hooks/useReengagement';
import { formatDateBR } from '@/lib/timezone';
import { Mail, Send, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle, Users } from 'lucide-react';

export function ReengagementManagement() {
  const { inactiveCompanies, emailLogs, stats, loading, sending, loadData, sendEmails } = useReengagement();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const selectableIds = inactiveCompanies
      .filter(c => !c.already_sent)
      .map(c => c.id);
    
    if (selectedIds.length === selectableIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableIds);
    }
  };

  const handleSendSelected = () => {
    if (selectedIds.length === 0) return;
    sendEmails(selectedIds);
    setSelectedIds([]);
  };

  const handleSendAll = () => {
    const eligibleIds = inactiveCompanies
      .filter(c => !c.already_sent)
      .map(c => c.id);
    
    if (eligibleIds.length === 0) return;
    sendEmails(eligibleIds);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="gap-1"><CheckCircle className="w-3 h-3" /> Enviado</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Falhou</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empresas Inativas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalInactive}</div>
            <p className="text-xs text-muted-foreground">Sem atividade recente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Enviados</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.emailsSentThisMonth}</div>
            <p className="text-xs text-muted-foreground">Este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Último Envio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.lastSentAt ? formatDateBR(stats.lastSentAt) : 'Nunca'}
            </div>
            <p className="text-xs text-muted-foreground">Data do último email</p>
          </CardContent>
        </Card>
      </div>

      {/* Inactive Companies */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Empresas Inativas
              </CardTitle>
              <CardDescription>
                Empresas sem clientes, veículos ou contratos cadastrados
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {inactiveCompanies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p>Nenhuma empresa inativa encontrada!</p>
              <p className="text-sm">Todas as empresas estão utilizando o sistema</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={selectedIds.length === inactiveCompanies.filter(c => !c.already_sent).length && selectedIds.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Email Admin</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead>Dias Inativo</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inactiveCompanies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedIds.includes(company.id)}
                            onCheckedChange={() => toggleSelect(company.id)}
                            disabled={company.already_sent}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell>{company.admin_email || '-'}</TableCell>
                        <TableCell>{formatDateBR(company.created_at)}</TableCell>
                        <TableCell>
                          <Badge variant={company.days_inactive > 7 ? 'destructive' : 'secondary'}>
                            {company.days_inactive} dias
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {company.already_sent ? (
                            <Badge variant="outline" className="gap-1">
                              <CheckCircle className="w-3 h-3" /> Já enviado
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <AlertCircle className="w-3 h-3" /> Pendente
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-2 mt-4">
                <Button 
                  onClick={handleSendSelected} 
                  disabled={selectedIds.length === 0 || sending}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Selecionados ({selectedIds.length})
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleSendAll}
                  disabled={sending || inactiveCompanies.filter(c => !c.already_sent).length === 0}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Enviar para Todos Elegíveis
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Email History */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Envios</CardTitle>
          <CardDescription>
            Últimos emails de reengajamento enviados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum email enviado ainda
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.company_name}</TableCell>
                      <TableCell>{log.email}</TableCell>
                      <TableCell>{log.sent_at ? formatDateBR(log.sent_at) : '-'}</TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
