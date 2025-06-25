
'use client';

import type { EquipmentType } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { selectableIconsList, DynamicLucideIcon } from '@/lib/lucide-icons';

const equipmentTypeSchema = z.object({
  name: z.string().min(2, "Nome do tipo deve ter pelo menos 2 caracteres."),
  iconName: z.string().optional(),
});

type EquipmentTypeFormValues = z.infer<typeof equipmentTypeSchema>;

interface EquipmentTypeFormProps {
  initialData?: EquipmentType;
  onSubmitAction: (data: EquipmentTypeFormValues) => Promise<EquipmentType | null | void>;
  onClose: () => void;
}

export function EquipmentTypeForm({ initialData, onSubmitAction, onClose }: EquipmentTypeFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const form = useForm<EquipmentTypeFormValues>({
    resolver: zodResolver(equipmentTypeSchema),
    defaultValues: initialData || {
      name: '',
      iconName: 'Package', // Default icon
    },
  });

  const onSubmit = async (data: EquipmentTypeFormValues) => {
    setIsLoading(true);
    try {
      await onSubmitAction(data);
      toast({
        title: `Tipo ${initialData ? 'Atualizado' : 'Criado'}`,
        description: `O tipo de equipamento foi ${initialData ? 'atualizado' : 'salvo'} com sucesso.`,
        variant: 'success',
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Erro',
        description: `Falha ao ${initialData ? 'atualizar' : 'criar'} tipo. ${(error as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{initialData ? 'Editar Tipo de Equipamento' : 'Adicionar Novo Tipo de Equipamento'}</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do Tipo</FormLabel>
                <FormControl><Input placeholder="ex: Ferramentas Elétricas" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="iconName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ícone do Tipo</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <div className="flex items-center gap-2">
                        {field.value && <DynamicLucideIcon iconName={field.value} className="h-4 w-4" />}
                        <SelectValue placeholder="Selecione um ícone" />
                      </div>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {selectableIconsList.map(iconInfo => (
                      <SelectItem key={iconInfo.name} value={iconInfo.name}>
                        <div className="flex items-center gap-2">
                          <iconInfo.icon className="h-4 w-4" />
                          <span>{iconInfo.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" disabled={isLoading}>Cancelar</Button></DialogClose>
            <Button type="submit" disabled={isLoading}>{isLoading ? 'Salvando...' : (initialData ? 'Salvar Alterações' : 'Adicionar Tipo')}</Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
