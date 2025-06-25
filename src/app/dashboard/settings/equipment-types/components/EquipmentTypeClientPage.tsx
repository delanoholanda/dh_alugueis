
'use client';

import type { EquipmentType } from '@/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { EquipmentTypeForm } from './EquipmentTypeForm';
import { createEquipmentType, updateEquipmentType, deleteEquipmentType } from '@/actions/equipmentTypeActions';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { DynamicLucideIcon } from '@/lib/lucide-icons';
import { useRouter } from 'next/navigation'; // Importar useRouter

export default function EquipmentTypeClientPage({ initialEquipmentTypes }: { initialEquipmentTypes: EquipmentType[] }) {
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>(initialEquipmentTypes);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingType, setEditingType] = useState<EquipmentType | undefined>(undefined);
  const { toast } = useToast();
  const router = useRouter(); // Instanciar useRouter

  const handleFormSubmit = async (data: Pick<EquipmentType, 'name' | 'iconName'>) => {
    let newOrUpdatedType;
    if (editingType) {
      newOrUpdatedType = await updateEquipmentType(editingType.id, data.name, data.iconName);
      if (newOrUpdatedType) {
        setEquipmentTypes(prev => prev.map(t => t.id === newOrUpdatedType!.id ? newOrUpdatedType! : t));
      }
    } else {
      newOrUpdatedType = await createEquipmentType(data.name, data.iconName);
      if (newOrUpdatedType) {
        setEquipmentTypes(prev => [...prev, newOrUpdatedType!]);
      }
    }
    setIsFormOpen(false);
    setEditingType(undefined);
    if (newOrUpdatedType) {
        router.refresh(); // Atualizar dados da rota
    }
  };

  const openEditForm = (type: EquipmentType) => {
    setEditingType(type);
    setIsFormOpen(true);
  };

  const openNewForm = () => {
    setEditingType(undefined);
    setIsFormOpen(true);
  };
  
  const handleDeleteType = async (typeId: string) => {
    try {
      const result = await deleteEquipmentType(typeId);
      if (result.success) {
        toast({ title: 'Tipo Excluído', description: 'O tipo de equipamento foi removido.', variant: 'success' });
        setEquipmentTypes(prev => prev.filter(t => t.id !== typeId));
        router.refresh(); // Atualizar dados da rota
      } else {
        toast({ title: 'Erro', description: 'Falha ao excluir tipo de equipamento. Verifique se ele não está em uso.', variant: 'destructive' });
      }
    } catch (error) {
      // Check if the error message is the specific one about being in use
      if (error instanceof Error && error.message.includes('in use by inventory items')) {
        toast({ title: 'Erro de Exclusão', description: 'Não é possível excluir: este tipo de equipamento está em uso por itens do inventário.', variant: 'destructive' });
      } else {
        toast({ title: 'Erro', description: (error as Error).message || 'Falha ao excluir tipo de equipamento.', variant: 'destructive' });
      }
    }
  };

  const isDefaultType = (typeId: string) => {
    // IDs dos tipos padrão que não devem ser excluídos se forem os únicos restantes
    const defaultTypeIds = ['type_scaffolding', 'type_shoring', 'type_platforms', 'type_other'];
    // Considera um tipo como padrão se o ID dele estiver na lista de IDs padrão
    // E se o número total de tipos for igual ou menor que o número de tipos padrão (para evitar exclusão do último)
    return defaultTypeIds.includes(typeId.toLowerCase()) && equipmentTypes.length <= defaultTypeIds.length;
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditingType(undefined); }}>
          <DialogTrigger asChild>
            <Button onClick={openNewForm}>
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Novo Tipo
            </Button>
          </DialogTrigger>
          {isFormOpen && (
            <EquipmentTypeForm
              key={editingType ? editingType.id : 'new'}
              initialData={editingType}
              onSubmitAction={handleFormSubmit}
              onClose={() => {setIsFormOpen(false); setEditingType(undefined);}}
            />
          )}
        </Dialog>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Lista de Tipos de Equipamento</CardTitle>
        </CardHeader>
        <CardContent>
          {equipmentTypes.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Ícone</TableHead>
                    <TableHead>Nome do Tipo</TableHead>
                    <TableHead className="hidden md:table-cell">ID</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipmentTypes.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell>
                        <DynamicLucideIcon iconName={type.iconName} className="h-5 w-5 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell className="font-mono text-xs hidden md:table-cell">{type.id}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditForm(type)} title="Editar Tipo">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Excluir Tipo" disabled={isDefaultType(type.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Tipo: {type.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. Isso excluirá permanentemente o tipo de equipamento.
                                  Certifique-se de que nenhum item de inventário esteja usando este tipo antes de excluir.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteType(type.id)} className="bg-destructive hover:bg-destructive/90">
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-lg">Nenhum tipo de equipamento encontrado.</p>
              <p>Adicione tipos para categorizar seu inventário.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
