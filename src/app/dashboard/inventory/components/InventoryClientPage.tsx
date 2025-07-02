
'use client';

import type { Equipment, EquipmentType } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { InventoryItemForm } from './InventoryItemForm';
import { createInventoryItem, updateInventoryItem, deleteInventoryItem } from '@/actions/inventoryActions';
import { PlusCircle, Edit, Trash2, ImageIcon as ImageIconLucide, PackageCheck, PackageX, DollarSign, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { BadgeProps } from '@/components/ui/badge';
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
import { formatToBRL } from '@/lib/utils';

interface InventoryClientPageProps {
  initialItems: Equipment[];
  rentedQuantities: Record<string, number>;
  initialEquipmentTypes: EquipmentType[];
}

function determineGeneralStatus(availableQuantity: number): { text: string; variant: BadgeProps['variant']; icon: React.ElementType } {
  if (availableQuantity <= 0) {
    return { text: 'Esgotado', variant: 'destructive', icon: PackageX };
  }
  return { text: 'Disponível', variant: 'default', icon: PackageCheck };
}

export default function InventoryClientPage({ initialItems, rentedQuantities: initialRentedQuantities, initialEquipmentTypes }: InventoryClientPageProps) {
  const [items, setItems] = useState<Equipment[]>(initialItems);
  const [rentedQuantities, setRentedQuantities] = useState<Record<string, number>>(initialRentedQuantities);
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>(initialEquipmentTypes);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | undefined>(undefined);
  const { toast } = useToast();

  const typeDetailsMap = useMemo(() => {
    return equipmentTypes.reduce((map, type) => {
      map[type.id] = { name: type.name, iconName: type.iconName };
      return map;
    }, {} as Record<string, { name: string, iconName?: string }>);
  }, [equipmentTypes]);

  useEffect(() => {
    setItems(initialItems.sort((a,b) => a.name.localeCompare(b.name)));
  }, [initialItems]);

  useEffect(() => {
    setRentedQuantities(initialRentedQuantities);
  }, [initialRentedQuantities]);

  useEffect(() => {
    setEquipmentTypes(initialEquipmentTypes.sort((a,b) => a.name.localeCompare(b.name)));
  }, [initialEquipmentTypes]);

  const handleEquipmentTypesUpdate = (updatedTypes: EquipmentType[]) => {
    setEquipmentTypes(updatedTypes.sort((a,b) => a.name.localeCompare(b.name)));
  };

  const handleFormSubmit = async (data: Omit<Equipment, 'id'>) => {
    let updatedItem;
    if (editingItem) {
      updatedItem = await updateInventoryItem(editingItem.id, data);
      if (updatedItem) {
        setItems(prevItems => prevItems.map(item => item.id === editingItem.id ? updatedItem! : item).sort((a,b) => a.name.localeCompare(b.name)));
      }
    } else {
      updatedItem = await createInventoryItem(data);
      if (updatedItem) {
        setItems(prevItems => [...prevItems, updatedItem!].sort((a,b) => a.name.localeCompare(b.name)));
      }
    }
    setIsFormOpen(false);
    setEditingItem(undefined);
  };

  const openEditForm = (item: Equipment) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const openNewForm = () => {
    setEditingItem(undefined);
    setIsFormOpen(true);
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteInventoryItem(itemId);
      toast({ title: 'Item Excluído', description: 'Item do inventário removido.', variant: 'success' });
      setItems(prevItems => prevItems.filter(item => item.id !== itemId));
    } catch (error) {
      toast({ title: 'Erro', description: (error as Error).message || 'Falha ao excluir item.', variant: 'destructive' });
    }
  };
  
  const getAINTHintForItem = (item: Equipment) => {
    const typeInfo = typeDetailsMap[item.typeId];
    const typeName = typeInfo ? typeInfo.name : 'equipment';
    // Using the first word of typeName and "item"
    return `${typeName.toLowerCase().split(' ')[0]} item`;
  };


  return (
    <>
      <div className="flex justify-end mb-6">
        <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditingItem(undefined); }}>
          <DialogTrigger asChild>
            <Button onClick={openNewForm}>
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Novo Item
            </Button>
          </DialogTrigger>
          {isFormOpen && (
             <InventoryItemForm
                key={editingItem ? editingItem.id : 'new'}
                initialData={editingItem}
                equipmentTypes={equipmentTypes}
                inventory={items}
                onSubmitAction={handleFormSubmit}
                onClose={() => {setIsFormOpen(false); setEditingItem(undefined);}}
                onEquipmentTypesUpdate={handleEquipmentTypesUpdate}
              />
          )}
        </Dialog>
      </div>
      {items.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item) => {
            const totalQuantity = item.quantity;
            const currentRentedQuantity = rentedQuantities[item.id] || 0;
            const availableQuantity = totalQuantity - currentRentedQuantity;
            const { text: generalStatusText, variant: generalStatusVariant, icon: StatusIcon } = determineGeneralStatus(availableQuantity);
            const itemTypeDetails = typeDetailsMap[item.typeId] || { name: 'Desconhecido', iconName: 'HelpCircle' };

            return (
              <Card key={item.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="p-4">
                  <div className="w-full h-40 relative rounded-md overflow-hidden bg-muted flex items-center justify-center mb-3">
                    {item.imageUrl ? (
                       <Image
                         src={item.imageUrl}
                         alt={item.name}
                         fill
                         sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw, 25vw"
                         className="object-contain p-1"
                         placeholder="blur"
                         blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
                         data-ai-hint={getAINTHintForItem(item)}
                       />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted rounded-md" data-ai-hint={getAINTHintForItem(item)}>
                         <ImageIconLucide className="w-16 h-16 text-muted-foreground opacity-50" />
                      </div>
                    )}
                   </div>
                  <CardTitle className="text-lg font-headline truncate" title={item.name}>{item.name}</CardTitle>
                  <CardDescription className="flex items-center text-xs text-muted-foreground">
                    <DynamicLucideIcon iconName={itemTypeDetails.iconName} className="h-3 w-3 mr-1.5" />
                    {itemTypeDetails.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-2 text-sm flex-grow">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total em Estoque:</span>
                    <span className="font-semibold">{totalQuantity} un.</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Alugados Atualmente:</span>
                    <span className="font-semibold text-orange-600">{currentRentedQuantity} un.</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Disponíveis:</span>
                    <span className="font-bold text-green-600">{Math.max(0, availableQuantity)} un.</span>
                  </div>
                   <div className="flex justify-between items-center pt-1">
                    <span className="text-muted-foreground flex items-center"><DollarSign className="h-4 w-4 mr-1"/>Taxa Diária:</span>
                    <span className="font-semibold">{formatToBRL(item.dailyRentalRate)}</span>
                  </div>
                </CardContent>
                <CardFooter className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-2">
                   <Badge variant={generalStatusVariant} className="capitalize w-full sm:w-auto justify-center py-1.5">
                       <StatusIcon className="h-4 w-4 mr-1.5" /> {generalStatusText}
                   </Badge>
                  <div className="flex flex-wrap justify-end gap-1 mt-2 sm:mt-0">
                    <Button variant="outline" size="sm" onClick={() => openEditForm(item)} className="flex-1 sm:flex-none">
                      <Edit className="h-3.5 w-3.5 mr-1.5 md:mr-0 lg:mr-1.5" /> <span className="md:hidden lg:inline">Editar</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50 hover:border-destructive/70 flex-1 sm:flex-none">
                          <Trash2 className="h-3.5 w-3.5 mr-1.5 md:mr-0 lg:mr-1.5" /> <span className="md:hidden lg:inline">Excluir</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir Item: {item.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso excluirá permanentemente este item do inventário.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteItem(item.id)} className="bg-destructive hover:bg-destructive/90">
                            Confirmar Exclusão
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="shadow-lg">
          <CardContent className="py-12 text-center">
            <PackageX className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Nenhum item de inventário encontrado.</h3>
            <p className="text-muted-foreground">Adicione itens ao seu inventário para começar a gerenciá-los aqui.</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
