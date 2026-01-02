import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCronJobs, KNOWN_FUNCTIONS, CRON_PRESETS, CronJobHistory } from '@/hooks/useCronJobs'
import { Play, Plus, Trash2, Clock, CheckCircle2, XCircle, Loader2, RefreshCw, History, Calendar } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function CronJobsManagement() {
  const { 
    jobs, 
    history, 
    loading, 
    historyLoading, 
    fetchJobs, 
    fetchHistory, 
    runJobNow, 
    createJob, 
    deleteJob 
  } = useCronJobs()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedFunction, setSelectedFunction] = useState('')
  const [selectedSchedule, setSelectedSchedule] = useState('')
  const [customSchedule, setCustomSchedule] = useState('')
  const [jobName, setJobName] = useState('')
  const [creating, setCreating] = useState(false)
  const [runningJob, setRunningJob] = useState<string | null>(null)
  const [selectedJobHistory, setSelectedJobHistory] = useState<string | null>(null)

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleCreateJob = async () => {
    if (!selectedFunction || !jobName) return
    
    const schedule = customSchedule || selectedSchedule
    if (!schedule) return

    setCreating(true)
    const success = await createJob(jobName, selectedFunction, schedule)
    if (success) {
      setIsCreateOpen(false)
      setSelectedFunction('')
      setSelectedSchedule('')
      setCustomSchedule('')
      setJobName('')
    }
    setCreating(false)
  }

  const handleRunNow = async (functionName: string) => {
    setRunningJob(functionName)
    await runJobNow(functionName)
    setRunningJob(null)
  }

  const getStatusBadge = (status: string | null) => {
    if (status === 'success') {
      return <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" /> Sucesso</Badge>
    }
    if (status === 'error' || status === 'failed') {
      return <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Erro</Badge>
    }
    return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> {status || 'Pendente'}</Badge>
  }

  const formatExecutionTime = (ms: number | null) => {
    if (!ms) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  // Agrupar histórico por job
  const historyByJob = history.reduce((acc, item) => {
    const jobName = item.job_name
    if (!acc[jobName]) acc[jobName] = []
    acc[jobName].push(item)
    return acc
  }, {} as Record<string, CronJobHistory[]>)

  const uniqueJobNames = Object.keys(historyByJob)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Automações Agendadas
            </CardTitle>
            <CardDescription>
              Gerencie tarefas automáticas do sistema (cron jobs)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchHistory()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Agendamento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Agendamento</DialogTitle>
                  <DialogDescription>
                    Configure uma nova tarefa automática
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome do Job</Label>
                    <Input 
                      placeholder="ex: notificacoes-diarias"
                      value={jobName}
                      onChange={(e) => setJobName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Função</Label>
                    <Select value={selectedFunction} onValueChange={setSelectedFunction}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a função" />
                      </SelectTrigger>
                      <SelectContent>
                        {KNOWN_FUNCTIONS.map((fn) => (
                          <SelectItem key={fn.name} value={fn.name}>
                            {fn.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedFunction && (
                      <p className="text-xs text-muted-foreground">
                        {KNOWN_FUNCTIONS.find(f => f.name === selectedFunction)?.description}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <Select value={selectedSchedule} onValueChange={(v) => { setSelectedSchedule(v); setCustomSchedule(''); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o horário" />
                      </SelectTrigger>
                      <SelectContent>
                        {CRON_PRESETS.map((preset) => (
                          <SelectItem key={preset.value} value={preset.value}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedSchedule && (
                      <p className="text-xs text-muted-foreground">
                        Expressão cron: <code className="bg-muted px-1 rounded">{selectedSchedule}</code>
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Ou expressão cron customizada</Label>
                    <Input 
                      placeholder="ex: 0 12 * * *"
                      value={customSchedule}
                      onChange={(e) => { setCustomSchedule(e.target.value); setSelectedSchedule(''); }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Formato: minuto hora dia mês dia-da-semana (UTC)
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                  <Button 
                    onClick={handleCreateJob} 
                    disabled={!jobName || !selectedFunction || (!selectedSchedule && !customSchedule) || creating}
                  >
                    {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Criar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="functions">
            <TabsList>
              <TabsTrigger value="functions">Funções Disponíveis</TabsTrigger>
              <TabsTrigger value="history">Histórico de Execuções</TabsTrigger>
            </TabsList>

            <TabsContent value="functions" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Função</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Última Execução</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {KNOWN_FUNCTIONS.map((fn) => {
                    const lastExecution = history.find(h => h.job_name.includes(fn.name))
                    return (
                      <TableRow key={fn.name}>
                        <TableCell className="font-medium">{fn.label}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{fn.description}</TableCell>
                        <TableCell>
                          {lastExecution?.started_at ? (
                            <span className="text-sm">
                              {formatDistanceToNow(new Date(lastExecution.started_at), { addSuffix: true, locale: ptBR })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">Nunca</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {lastExecution ? getStatusBadge(lastExecution.status) : <Badge variant="secondary">-</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedJobHistory(fn.name)}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={() => handleRunNow(fn.name)}
                              disabled={runningJob === fn.name}
                            >
                              {runningJob === fn.name ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma execução registrada ainda
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Iniciado em</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.slice(0, 30).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.job_name}</TableCell>
                        <TableCell>
                          {item.started_at ? format(new Date(item.started_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : '-'}
                        </TableCell>
                        <TableCell>{formatExecutionTime(item.execution_time_ms)}</TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {item.error_message || item.response_body || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog para histórico de job específico */}
      <Dialog open={!!selectedJobHistory} onOpenChange={() => setSelectedJobHistory(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico: {selectedJobHistory}</DialogTitle>
            <DialogDescription>
              Últimas execuções desta função
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history
                  .filter(h => h.job_name.includes(selectedJobHistory || ''))
                  .slice(0, 20)
                  .map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.started_at ? format(new Date(item.started_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell>{formatExecutionTime(item.execution_time_ms)}</TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm">
                        {item.error_message || item.response_body || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
