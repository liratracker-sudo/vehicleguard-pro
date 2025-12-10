import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateBR } from "@/lib/timezone"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  FileText, 
  Edit, 
  Trash, 
  Save, 
  X 
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useContractTemplates, ContractTemplate } from "@/hooks/useContractTemplates"

interface TemplateFormProps {
  template?: ContractTemplate | null
  onSuccess: () => void
  onCancel: () => void
}

const TemplateForm = ({ template, onSuccess, onCancel }: TemplateFormProps) => {
  const [formData, setFormData] = useState({
    name: template?.name || "",
    content: template?.content || `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATANTE: {{cliente_nome}}
E-mail: {{cliente_email}}
Telefone: {{cliente_telefone}}
Documento: {{cliente_documento}}

CONTRATADA: {{empresa_razao_social}}
CNPJ: {{empresa_cnpj}}
Endereço: {{empresa_endereco}}
Responsável: {{empresa_responsavel}}

OBJETO DO CONTRATO:
A contratada se compromete a prestar os seguintes serviços:

PLANO: {{plano_nome}}
VALOR MENSAL: R$ {{valor_mensal}}
VEÍCULO: {{veiculo_info}}

VIGÊNCIA: {{data_inicio}} {{data_fim}}

CLÁUSULAS:

1. DO PAGAMENTO
O pagamento será efetuado mensalmente, no valor de R$ {{valor_mensal}}, até o dia 10 de cada mês.

2. DA VIGÊNCIA
Este contrato terá vigência de {{data_inicio}} {{data_fim}}.

3. DAS RESPONSABILIDADES
A contratada se responsabiliza pela prestação dos serviços conforme especificado.

4. DA RESCISÃO
Este contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 30 dias.

LOCAL E DATA: ________________, ____ de ____________ de ______

_________________________________
{{cliente_nome}}
Contratante

_________________________________
{{empresa_responsavel}}
{{empresa_razao_social}}
Contratada`
  })
  const { createTemplate, updateTemplate, loading } = useContractTemplates()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.content.trim()) {
      return
    }

    let success = false
    if (template) {
      success = await updateTemplate(template.id, formData)
    } else {
      success = await createTemplate(formData)
    }

    if (success) {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome do Modelo *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Ex: Padrão, Mensalidade, Serviço Técnico"
          required
        />
      </div>
      
      <div>
        <Label htmlFor="content">Conteúdo do Modelo *</Label>
        <Textarea
          id="content"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          placeholder="Digite o conteúdo do contrato..."
          className="min-h-[400px] font-mono text-sm"
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          <strong>Cliente:</strong> {`{{cliente_nome}}, {{cliente_email}}, {{cliente_telefone}}, {{cliente_documento}}`}<br />
          <strong>Empresa:</strong> {`{{empresa_razao_social}}, {{empresa_cnpj}}, {{empresa_endereco}}, {{empresa_responsavel}}`}<br />
          <strong>Contrato:</strong> {`{{plano_nome}}, {{valor_mensal}}, {{veiculo_info}}, {{data_inicio}}, {{data_fim}}`}
        </p>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          <Save className="w-4 h-4 mr-2" />
          {template ? 'Atualizar' : 'Criar'} Modelo
        </Button>
      </div>
    </form>
  )
}

export const ContractTemplates = () => {
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null)
  const { templates, loading, deleteTemplate, loadTemplates } = useContractTemplates()

  const handleEdit = (template: ContractTemplate) => {
    setEditingTemplate(template)
    setShowForm(true)
  }

  const handleDelete = async (template: ContractTemplate) => {
    if (!confirm(`Tem certeza que deseja excluir o modelo "${template.name}"?`)) return
    await deleteTemplate(template.id)
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    setEditingTemplate(null)
    loadTemplates() // Força recarga da lista
  }

  const handleFormCancel = () => {
    setShowForm(false)
    setEditingTemplate(null)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Modelos de Contrato
            </CardTitle>
            <CardDescription>
              Crie e gerencie modelos personalizados para seus contratos
            </CardDescription>
          </div>
          
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingTemplate(null); setShowForm(true) }}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Modelo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? 'Editar Modelo' : 'Novo Modelo'}
                </DialogTitle>
                <DialogDescription>
                  Crie ou edite modelos de contrato com variáveis personalizadas
                </DialogDescription>
              </DialogHeader>
              <TemplateForm
                template={editingTemplate}
                onSuccess={handleFormSuccess}
                onCancel={handleFormCancel}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando modelos...</p>
            </div>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum modelo encontrado</h3>
            <p className="text-muted-foreground mb-4">
              Crie seu primeiro modelo de contrato para facilitar a geração de novos contratos.
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Modelo
            </Button>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {template.content.substring(0, 100)}...
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDateBR(template.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Ativo</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Ações</span>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(template)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(template)}
                            className="text-destructive"
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}