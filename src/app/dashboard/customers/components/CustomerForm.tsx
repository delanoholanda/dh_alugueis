
'use client';

import type { Customer } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useState, type ChangeEvent, useEffect } from 'react';
import Image from 'next/image';
import { User, X } from 'lucide-react';

const applyPhoneMask = (value: string): string => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  const len = digits.length;

  if (len === 0) return "";
  if (len <= 2) return `(${digits}`;
  let maskedValue = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (len > 2 && len <= 6) {
    maskedValue = `(${digits.slice(0, 2)}) ${digits.slice(2, len)}`;
  } else if (len > 6 && len <= 10) {
    maskedValue = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, len)}`;
  } else if (len > 10) {
    maskedValue = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }
  return maskedValue;
};

const applyCpfMask = (value: string): string => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  const len = digits.length;

  if (len === 0) return "";
  if (len <= 3) return digits;
  if (len <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (len <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;

const customerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z.string().regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, "Formato do telefone deve ser (XX) XXXXX-XXXX ou (XX) XXXX-XXXX"),
  address: z.string().optional().or(z.literal('')),
  cpf: z.string()
    .refine(val => val === '' || cpfRegex.test(val), {
      message: "CPF deve estar no formato XXX.XXX.XXX-XX ou vazio.",
    })
    .optional()
    .or(z.literal('')),
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
  responsiveness: z.enum(['very responsive', 'responsive', 'not very responsive', 'never responds']),
  rentalHistory: z.enum(['always on time', 'sometimes late', 'often late', 'always late']),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface CustomerFormProps {
  initialData?: Customer;
  onSubmitAction: (data: CustomerFormValues) => Promise<Customer | null | void>;
  onClose: () => void;
  isSubForm?: boolean;
}

export function CustomerForm({ initialData, onSubmitAction, onClose, isSubForm = false }: CustomerFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: initialData ? {
      ...initialData,
      phone: initialData.phone ? applyPhoneMask(initialData.phone) : '',
      address: initialData.address || '',
      cpf: initialData.cpf ? applyCpfMask(initialData.cpf) : '',
      imageUrl: initialData.imageUrl || '',
    } : {
      name: '',
      phone: '',
      address: '',
      cpf: '',
      imageUrl: '',
      responsiveness: 'responsive',
      rentalHistory: 'always on time',
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
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const file = item.getAsFile();
          if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
              toast({
                title: 'Arquivo Muito Grande',
                description: 'A imagem colada é maior que 2MB.',
                variant: 'destructive',
              });
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              form.setValue('imageUrl', result, { shouldValidate: true });
              toast({
                title: "Imagem Colada!",
                description: "A imagem da área de transferência foi carregada com sucesso.",
                variant: 'success'
              });
            };
            reader.readAsDataURL(file);
            return; 
          }
        }
      }
    };
    
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [form, toast]);

  const onSubmit = async (data: CustomerFormValues) => {
    setIsLoading(true);
    const submitData = {
      ...data,
      cpf: data.cpf?.replace(/\D/g, '') || undefined, 
    };
    try {
      await onSubmitAction(submitData);
      
      if (!isSubForm) {
        toast({
          title: `Cliente ${initialData ? 'Atualizado' : 'Criado'}`,
          description: `Detalhes do cliente foram ${initialData ? 'atualizados' : 'salvos'} com sucesso.`,
          variant: 'success',
        });
      }
      onClose(); 
    } catch (error) {
      toast({
        title: 'Erro',
        description: `Falha ao ${initialData ? 'atualizar' : 'criar'} cliente. ${(error as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{initialData ? 'Editar Cliente' : 'Adicionar Novo Cliente'}</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome Completo</FormLabel>
                <FormControl><Input placeholder="ex: João da Silva" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormItem>
            <FormLabel>Foto do Cliente</FormLabel>
            <div className="mt-2 flex justify-center">
                <div className="relative group w-32 h-32" key={watchedImageUrl || 'customer-image-wrapper'}>
                    <div className="w-full h-full rounded-full overflow-hidden border bg-muted flex items-center justify-center">
                    {watchedImageUrl ? (
                        <Image src={watchedImageUrl} alt="Pré-visualização do cliente" layout="fill" objectFit="cover" data-ai-hint="person portrait"/>
                    ) : (
                        <User className="w-20 h-20 text-muted-foreground" data-ai-hint="person portrait"/>
                    )}
                    </div>
                    {watchedImageUrl && (
                        <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-0 right-0 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            onClick={() => form.setValue('imageUrl', '', { shouldValidate: true })}
                        >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Remover Imagem</span>
                        </Button>
                    )}
                </div>
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
             <FormDescription>Forneça uma URL, carregue um arquivo (máx 2MB), ou cole (Ctrl+V) uma imagem da área de transferência.</FormDescription>
          </FormItem>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Telefone</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="(XX) XXXXX-XXXX" 
                      {...field}
                      onChange={(e) => {
                        const maskedValue = applyPhoneMask(e.target.value);
                        field.onChange(maskedValue); 
                      }}
                      maxLength={15}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cpf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF (Opcional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="XXX.XXX.XXX-XX" 
                      {...field}
                      onChange={(e) => {
                        const maskedValue = applyCpfMask(e.target.value);
                        field.onChange(maskedValue); 
                      }}
                      maxLength={14}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
           <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Endereço (Opcional)</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="ex: Rua das Flores, 123, Bairro, Cidade - UF, CEP 00000-000" 
                    {...field} 
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="responsiveness"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Responsividade do Cliente</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione a responsividade" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="very responsive">Muito Responsivo</SelectItem>
                    <SelectItem value="responsive">Responsivo</SelectItem>
                    <SelectItem value="not very responsive">Pouco Responsivo</SelectItem>
                    <SelectItem value="never responds">Nunca Responde</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="rentalHistory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Histórico de Aluguel</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione o histórico de aluguel" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="always on time">Sempre em Dia</SelectItem>
                    <SelectItem value="sometimes late">Às Vezes Atrasado</SelectItem>
                    <SelectItem value="often late">Frequentemente Atrasado</SelectItem>
                    <SelectItem value="always late">Sempre Atrasado</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter className="py-4 border-t">
            <DialogClose asChild><Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button></DialogClose>
            <Button type="submit" disabled={isLoading}>{isLoading ? 'Salvando...' : (initialData ? 'Salvar Alterações' : 'Adicionar Cliente')}</Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
