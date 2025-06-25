
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
import { ImageIcon, PlusCircle, Tags, X } from 'lucide-react';
import { formatToBRL, parseFromBRL } from '@/lib/utils';
import { EquipmentTypeForm } from '@/app/dashboard/settings/equipment-types/components/EquipmentTypeForm';
import { createEquipmentType, getEquipmentTypes as fetchEquipmentTypesAction } from '@/actions/equipmentTypeActions';

const inventoryItemSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  typeId: z.string().min(1, "Tipo é obrigatório"),
  quantity: z.coerce.number().min(0, "Quantidade não pode ser negativa"),
  dailyRentalRate: z.coerce.number({invalid_type_error: "Taxa diária deve ser um número."}).min(0, "Taxa diária não pode ser negativa"),
  status: z.enum(['available', 'rented']), 
  imageUrl: z.string().refine(val => {
    if (val === '') return true;
    if (val.startsWith('data:image/')) return true;
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

  useEffect(() => {
    setCurrentEquipmentTypes(initialEquipmentTypes.sort((a, b) => a.name.localeCompare(b.name)));
  }, [initialEquipmentTypes]);

  const form = useForm<InventoryItemFormValues>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: initialData ?
    {
      ...initialData,
      status: initialData.status || 'available',
    }
    : {
      name: '',
      typeId: currentEquipmentTypes.find(et => et.name.toLowerCase() === 'outro')?.id || currentEquipmentTypes[0]?.id || '',
      quantity: 0,
      dailyRentalRate: 0,
      status: 'available',
      imageUrl: '',
    },
  });

  const watchedImageUrl = form.watch("imageUrl");

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
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

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          event.preventDefault();
          const file = item.getAsFile();
          if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
              toast({
                title: "Arquivo Muito Grande",
                description: "A imagem colada é maior que 2MB.",
                variant: "destructive",
              });
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              form.setValue("imageUrl", result, { shouldValidate: true });
              toast({
                title: "Imagem Colada!",
                description: "A imagem da área de transferência foi carregada com sucesso.",
                variant: "success",
              });
            };
            reader.readAsDataURL(file);
            return;
          }
        }
      }
    };
    
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [form, toast]);


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
        title: 'Erro',
        description: `Falha ao ${initialData ? 'atualizar' : 'criar'} item. ${(error as Error).message}`,
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
                  <Input placeholder="ex: Andaime Tubular Metálico" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormItem key={watchedImageUrl || 'inventory-image-form-item'}>
            <FormLabel>Imagem do Item</FormLabel>
            <div className="relative mt-2 group">
              <div className="w-full h-40 relative rounded-md overflow-hidden border bg-muted flex items-center justify-center">
                {watchedImageUrl ? (
                   <div className="relative w-full h-full" key={watchedImageUrl}>
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
                  <span className="sr-only">Remover Imagem</span>
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
                        <Input
                            placeholder="https://..."
                            {...field} 
                        />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Ou carregue do computador</FormLabel>
                    <FormControl>
                        <Input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="cursor-pointer file:mr-2 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary file:border-0 file:rounded file:px-2 file:py-1 hover:file:bg-primary/20"
                        />
                    </FormControl>
                </FormItem>
            </div>
             <FormDescription>Forneça uma URL, carregue uma imagem (máx 2MB), ou cole (Ctrl+V) uma imagem.</FormDescription>
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
                          <SelectValue placeholder="Selecione o tipo do item" />
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
                            <Button type="button" variant="outline" size="icon" title="Adicionar Novo Tipo de Equipamento">
                                <Tags className="h-4 w-4 text-primary" />
                            </Button>
                        </DialogTrigger>
                        {isEquipmentTypeFormOpen && (
                            <EquipmentTypeForm
                                onSubmitAction={handleNewEquipmentTypeCreated}
                                onClose={() => setIsEquipmentTypeFormOpen(false)}
                            />
                        )}
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
                  <FormLabel>Quantidade Total em Estoque</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="ex: 100" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="dailyRentalRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Taxa de Aluguel Diária (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      value={formatToBRL(field.value)}
                      onChange={(e) => field.onChange(parseFromBRL(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status Base do Item</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="available">Disponível (Geral)</SelectItem>
                      <SelectItem value="rented">Em Manutenção/Indisponível</SelectItem> 
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs">Status geral do item. A disponibilidade real para aluguel é calculada dinamicamente.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
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
