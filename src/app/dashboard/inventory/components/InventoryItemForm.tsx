
'use client';

import type { Equipment, EquipmentType } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, type ChangeEvent } from 'react';
import { ImageIcon, PlusCircle, Tags, X, DollarSign } from 'lucide-react';
import { formatToBRL, parseFromBRL } from '@/lib/utils';
import { EquipmentTypeForm } from '@/app/dashboard/settings/equipment-types/components/EquipmentTypeForm';
import { createEquipmentType, getEquipmentTypes as fetchEquipmentTypesAction } from '@/actions/equipmentTypeActions';
import { Switch } from '@/components/ui/switch';

const inventoryItemSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  typeId: z.string().min(1, "Tipo é obrigatório"),
  quantity: z.coerce.number().min(0, "Quantidade não pode ser negativa"),
  dailyRentalRate: z.coerce.number({invalid_type_error: "Taxa diária deve ser um número."}).min(0, "Taxa diária não pode ser negativa"),
  unitAcquisitionPrice: z.coerce.number({invalid_type_error: "Preço de aquisição deve ser um número."}).min(0, "Preço não pode ser negativo"),
  status: z.enum(['available', 'rented']), 
  forRental: z.boolean().default(true),
  imageUrl: z.string().refine(val => {
    if (val === '') return true;
    if (val.startsWith('data:image/')) return true;
    if (val.startsWith('/uploads/')) return true;
    try {
      new URL(val);
      return val.startsWith('http://') || val.startsWith('https://');
    } catch (_) {
      return false;
    }
  }, { message: "Deve ser uma URL válida (http/https) ou uma imagem carregada" }).optional().or(z.literal('')),
});

type InventoryItemFormValues = z.infer<typeof inventoryItemSchema>;

interface InventoryItemFormProps {
  initialData?: Equipment;
  equipmentTypes: EquipmentType[];
  inventory: Equipment[];
  onSubmitAction: (data: InventoryItemFormValues) => Promise<Equipment | null | void>;
  onClose: () => void;
  onEquipmentTypesUpdate?: (updatedTypes: EquipmentType[]) => void; 
}

export function InventoryItemForm({ initialData, equipmentTypes: initialEquipmentTypes, inventory, onSubmitAction, onClose, onEquipmentTypesUpdate }: InventoryItemFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [currentEquipmentTypes, setCurrentEquipmentTypes] = useState<EquipmentType[]>(initialEquipmentTypes);
  const [isEquipmentTypeFormOpen, setIsEquipmentTypeFormOpen] = useState(false);
  const [isRateFocused, setIsRateFocused] = useState(false);
  const [isAcqPriceFocused, setIsAcqPriceFocused] = useState(false);

  useEffect(() => {
    setCurrentEquipmentTypes(initialEquipmentTypes.sort((a, b) => a.name.localeCompare(b.name)));
  }, [initialEquipmentTypes]);

  const form = useForm<InventoryItemFormValues>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: initialData ?
    {
      ...initialData,
      status: initialData.status || 'available',
      unitAcquisitionPrice: initialData.unitAcquisitionPrice || 0,
      forRental: initialData.forRental ?? true,
    }
    : {
      name: '',
      typeId: currentEquipmentTypes.find(et => et.name.toLowerCase() === 'outro')?.id || currentEquipmentTypes[0]?.id || '',
      quantity: 0,
      dailyRentalRate: 0,
      unitAcquisitionPrice: 0,
      status: 'available',
      forRental: true,
      imageUrl: '',
    },
  });

  const watchedImageUrl = form.watch("imageUrl");

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { 
        toast({
          title: 'Arquivo Muito Grande',
          description: 'Por favor, selecione uma imagem menor que 2MB.',
          variant: 'destructive',
        });
        event.target.value = ''; 
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        form.setValue('imageUrl', result, { shouldValidate: true });
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    }
  };

  const handleNewEquipmentTypeCreated = async (data: Pick<EquipmentType, 'name' | 'iconName'>) => {
    try {
      const newType = await createEquipmentType(data.name, data.iconName);
      if (newType) {
        const updatedTypes = await fetchEquipmentTypesAction();
        setCurrentEquipmentTypes(updatedTypes.sort((a, b) => a.name.localeCompare(b.name)));
        if (onEquipmentTypesUpdate) {
          onEquipmentTypesUpdate(updatedTypes);
        }
        form.setValue('typeId', newType.id, { shouldValidate: true });
        toast({
          title: "Tipo de Equipamento Criado",
          description: `${newType.name} foi adicionado e selecionado.`,
          variant: 'success',
        });
        setIsEquipmentTypeFormOpen(false);
      }
    } catch (error) {
      toast({
        title: 'Erro ao Criar Tipo',
        description: `Não foi possível criar o novo tipo. ${(error as Error).message}`,
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (data: InventoryItemFormValues) => {
    setIsLoading(true);
    try {
      await onSubmitAction(data);
      toast({
        title: `Item ${initialData ? 'Atualizado' : 'Criado'}`,
        description: `O item do inventário foi ${initialData ? 'atualizado' : 'criado'} com sucesso.`,
        variant: 'success',
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Erro ao Salvar Item',
        description: (error as Error).message || `Falha ao ${initialData ? 'atualizar' : 'criar'} item.`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const getSelectedTypeNameForHint = () => {
    const typeId = form.getValues('typeId');
    const type = currentEquipmentTypes.find(t => t.id === typeId);
    return type ? type.name.toLowerCase().split(' ')[0] : 'equipment';
  };

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{initialData ? 'Editar Item do Inventário' : 'Adicionar Novo Item ao Inventário'}</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do Item</FormLabel>
                <FormControl>
                  <Input placeholder="ex: Veículo Reboque / Andaime Tubular" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormItem>
            <FormLabel>Imagem do Item</FormLabel>
            <div className="relative mt-2 group">
              <div className="w-full h-40 relative rounded-md overflow-hidden border bg-muted flex items-center justify-center">
                {watchedImageUrl ? (
                   <div className="relative w-full h-full">
                    <Image 
                      src={watchedImageUrl} 
                      alt="Pré-visualização do item" 
                      layout="fill" 
                      objectFit="contain" 
                      className="p-1"
                      data-ai-hint={getSelectedTypeNameForHint()}
                    />
                  </div>
                ) : (
                  <ImageIcon className="w-16 h-16 text-muted-foreground" data-ai-hint={getSelectedTypeNameForHint()}/>
                )}
              </div>
              {watchedImageUrl && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  onClick={() => form.setValue('imageUrl', '', { shouldValidate: true })}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
                <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">URL da imagem (opcional)</FormLabel>
                        <FormControl>
                        <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Ou carregue do computador</FormLabel>
                    <FormControl>
                        <Input type="file" accept="image/*" onChange={handleImageChange} className="cursor-pointer file:mr-2 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary file:border-0 file:rounded file:px-2 file:py-1 hover:file:bg-primary/20" />
                    </FormControl>
                </FormItem>
            </div>
          </FormItem>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="typeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <div className="flex gap-2 items-center">
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currentEquipmentTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Dialog open={isEquipmentTypeFormOpen} onOpenChange={setIsEquipmentTypeFormOpen}>
                        <DialogTrigger asChild>
                            <Button type="button" variant="outline" size="icon"><Tags className="h-4 w-4 text-primary" /></Button>
                        </DialogTrigger>
                        {isEquipmentTypeFormOpen && <EquipmentTypeForm onSubmitAction={handleNewEquipmentTypeCreated} onClose={() => setIsEquipmentTypeFormOpen(false)} />}
                    </Dialog>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade em Estoque</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="ex: 1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="unitAcquisitionPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço de Aquisição Unit. (Patrimônio)</FormLabel>
                  <FormControl>
                     <Input
                      type={isAcqPriceFocused ? 'number' : 'text'}
                      placeholder="R$ 0,00"
                      value={isAcqPriceFocused ? (field.value ?? '') : formatToBRL(field.value)}
                      onFocus={() => setIsAcqPriceFocused(true)}
                      onBlur={() => setIsAcqPriceFocused(false)}
                      onChange={(e) => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      step="0.01"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dailyRentalRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Taxa de Aluguel Diária</FormLabel>
                  <FormControl>
                     <Input
                      type={isRateFocused ? 'number' : 'text'}
                      placeholder="R$ 0,00"
                      value={isRateFocused ? (field.value ?? '') : formatToBRL(field.value)}
                      onFocus={() => setIsRateFocused(true)}
                      onBlur={() => setIsRateFocused(false)}
                      onChange={(e) => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      step="0.01"
                      disabled={!form.watch('forRental')}
                    />
                  </FormControl>
                  <FormDescription className="text-[10px]">Desative se não for para aluguel.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="forRental"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-primary/5">
                <div className="space-y-0.5">
                  <FormLabel className="text-sm font-semibold">Disponível para Aluguel?</FormLabel>
                  <FormDescription className="text-xs">
                    Desative para itens como carros ou ferramentas de uso interno (Ativos Fixos).
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (!checked) form.setValue('dailyRentalRate', 0);
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status Base</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="available">Disponível / Ativo</SelectItem>
                    <SelectItem value="rented">Indisponível / Manutenção</SelectItem> 
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter className="py-4 border-t">
            <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : (initialData ? 'Salvar Alterações' : 'Adicionar Item')}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
