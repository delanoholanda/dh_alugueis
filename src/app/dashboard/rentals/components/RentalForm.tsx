
'use client';

import type { Rental, Customer, Equipment as InventoryEquipment, PaymentMethod, EquipmentType } from '@/types';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { CalendarIcon, PlusCircle, Trash2, Save, Truck, Percent, Info, CreditCard, Landmark, CircleDollarSign, UserPlus, PackagePlus, MapPin, AlertCircle, ChevronsUpDown, Check, Package } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
import { formatToBRL, parseFromBRL, cn } from '@/lib/utils';
import { CustomerForm } from '@/app/dashboard/customers/components/CustomerForm';
import { createCustomer, getCustomers } from '@/actions/customerActions';
import { InventoryItemForm } from '@/app/dashboard/inventory/components/InventoryItemForm';
import { createInventoryItem, getInventoryItems } from '@/actions/inventoryActions';
import { getEquipmentTypes as fetchEquipmentTypesAction } from '@/actions/equipmentTypeActions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";


const rentalFormSchema = z.object({
  customerId: z.string().min(1, "Cliente é obrigatório"),
  equipment: z.array(z.object({
    equipmentId: z.string().min(1, "Equipamento é obrigatório"),
    quantity: z.coerce.number({invalid_type_error: "Quantidade deve ser um número.", required_error: "Quantidade é obrigatória."})
      .min(1, "Quantidade deve ser pelo menos 1")
      .refine(val => !isNaN(val) && Number.isInteger(val), { message: "Quantidade deve ser um número inteiro válido." }),
    customDailyRentalRate: z.preprocess(
      (val) => (val === undefined || val === null || val === '' ? undefined : val),
      z.coerce.number({ invalid_type_error: "Taxa diária customizada deve ser um número." })
        .min(0, "Taxa diária customizada não pode ser negativa")
        .optional()
    ),
  })).min(1, "Pelo menos um item de equipamento é obrigatório"),
  rentalStartDate: z.date({ required_error: "Data de início do aluguel é obrigatória." }),
  isOpenEnded: z.boolean().default(false),
  chargeSaturdays: z.boolean().default(true),
  chargeSundays: z.boolean().default(true),
  rentalDays: z.coerce.number({invalid_type_error: "Dias de aluguel deve ser um número."})
      .min(0, "Dias de aluguel deve ser no mínimo 0")
      .refine(val => !isNaN(val) && Number.isInteger(val), { message: "Dias de aluguel deve ser um número inteiro válido." }),
  freightValue: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? 0 : val), 
      z.coerce.number({invalid_type_error: "Valor do frete deve ser um número."})
        .min(0, "Valor do frete não pode ser negativo")
        .optional()
    ),
  discountValue: z.coerce.number({invalid_type_error: "Valor do desconto deve ser um número."})
    .min(0, "Valor do desconto não pode ser negativo")
    .optional(),
  value: z.coerce.number({invalid_type_error: "Valor deve ser um número.", required_error: "Valor é obrigatório."})
    .min(0, "Valor não pode ser negativo"),
  paymentStatus: z.enum(['paid', 'pending', 'overdue']),
  paymentMethod: z.enum(['pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'nao_definido']).optional(),
  paymentDate: z.date().optional(),
  notes: z.string().optional(),
  deliveryAddress: z.string().optional(),
}).refine(data => {
    if (!data.isOpenEnded) {
        return data.rentalDays >= 1;
    }
    return true;
}, {
    message: "Deve ser pelo menos 1 para contratos com data final.",
    path: ["rentalDays"],
});


type RentalFormValues = z.infer<typeof rentalFormSchema>;

interface RentalFormProps {
  initialData?: Rental;
  customers: Customer[];
  inventory: InventoryEquipment[];
  equipmentTypes: EquipmentType[];
  allRentals: Rental[]; 
  onSubmitAction: (data: RentalFormValues) => Promise<Rental | null | void>;
  formTitle: string;
  submitButtonText: string;
}

export function RentalForm({ 
  initialData, 
  customers: initialCustomers, 
  inventory: initialInventory, 
  equipmentTypes: initialEquipmentTypes, 
  allRentals, 
  onSubmitAction, 
  formTitle, 
  submitButtonText 
}: RentalFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
  const [customerList, setCustomerList] = useState<Customer[]>(() =>
    initialCustomers.sort((a, b) => a.name.localeCompare(b.name))
  );
  const [openCustomerCombobox, setOpenCustomerCombobox] = useState(false);
  const [openEquipmentCombobox, setOpenEquipmentCombobox] = useState<Record<number, boolean>>({});

  const [isInventoryItemFormOpen, setIsInventoryItemFormOpen] = useState(false);
  const [inventoryList, setInventoryList] = useState<InventoryEquipment[]>(() =>
    initialInventory.sort((a, b) => a.name.localeCompare(b.name))
  );
  const [inventoryWithAvailability, setInventoryWithAvailability] = useState<Array<InventoryEquipment & { availableQuantity: number }>>([]);
  const [equipmentTypesList, setEquipmentTypesList] = useState<EquipmentType[]>(() =>
    initialEquipmentTypes.sort((a, b) => a.name.localeCompare(b.name))
  );
  const [currentEquipmentIndexForAddItem, setCurrentEquipmentIndexForAddItem] = useState<number | null>(null);


   useEffect(() => {
    const calculateAvailability = () => {
      const rentedMap = new Map<string, number>();
      allRentals.forEach(r => {
        if (!r.actualReturnDate && (!initialData || r.id !== initialData.id)) {
          r.equipment.forEach(eq => {
            rentedMap.set(eq.equipmentId, (rentedMap.get(eq.equipmentId) || 0) + eq.quantity);
          });
        }
      });

      const newInventoryWithAvailability = inventoryList.map(invItem => {
        const totalRentedByOthers = rentedMap.get(invItem.id) || 0;
        const available = invItem.quantity - totalRentedByOthers;
        return { ...invItem, availableQuantity: Math.max(0, available) };
      }).sort((a, b) => a.name.localeCompare(b.name));
      
      setInventoryWithAvailability(newInventoryWithAvailability);
    };

    calculateAvailability();
  }, [inventoryList, allRentals, initialData]);


  const form = useForm<RentalFormValues>({
    resolver: zodResolver(rentalFormSchema),
    defaultValues: initialData ? {
      ...initialData,
      rentalStartDate: initialData.rentalStartDate ? parseISO(initialData.rentalStartDate) : new Date(),
      equipment: initialData.equipment.map(eq => ({
        equipmentId: eq.equipmentId,
        quantity: eq.quantity,
        customDailyRentalRate: eq.customDailyRentalRate === null ? undefined : eq.customDailyRentalRate 
      })),
      isOpenEnded: initialData.isOpenEnded ?? false,
      chargeSaturdays: initialData.chargeSaturdays ?? true,
      chargeSundays: initialData.chargeSundays ?? true,
      rentalDays: initialData.isOpenEnded ? 0 : initialData.rentalDays,
      freightValue: initialData.freightValue || 0,
      discountValue: initialData.discountValue || 0,
      paymentMethod: initialData.paymentMethod || 'pix',
      paymentDate: initialData.paymentDate ? parseISO(initialData.paymentDate) : undefined,
      notes: initialData.notes ?? '', 
      deliveryAddress: initialData.deliveryAddress || 'A definir',
    } : {
      customerId: '',
      equipment: [{ equipmentId: '', quantity: 1, customDailyRentalRate: undefined }],
      rentalStartDate: new Date(),
      isOpenEnded: false,
      chargeSaturdays: true,
      chargeSundays: true,
      rentalDays: 7,
      freightValue: 0,
      discountValue: 0,
      value: 0,
      paymentStatus: 'pending',
      paymentMethod: 'pix',
      paymentDate: undefined,
      notes: '',
      deliveryAddress: 'A definir',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "equipment"
  });

  const watchedIsOpenEnded = form.watch("isOpenEnded");
  const watchedEquipment = form.watch("equipment");
  const watchedRentalDays = form.watch("rentalDays");
  const watchedFreightValue = form.watch("freightValue");
  const watchedPaymentStatus = form.watch("paymentStatus");
  const watchedCustomerId = form.watch("customerId");

  useEffect(() => {
    if (watchedIsOpenEnded) {
        form.setValue('rentalDays', 0);
        form.clearErrors('rentalDays');
    } else {
        if (form.getValues('rentalDays') === 0) {
            form.setValue('rentalDays', 1);
        }
    }
  }, [watchedIsOpenEnded, form]);

  useEffect(() => {
    if (watchedCustomerId) {
      const selectedCustomer = customerList.find(c => c.id === watchedCustomerId);
      const currentDeliveryAddressValue = form.getValues('deliveryAddress');
      
      const isDeliveryAddressConsideredEmpty = 
        currentDeliveryAddressValue === undefined ||
        currentDeliveryAddressValue === null ||
        currentDeliveryAddressValue.trim() === '' ||
        currentDeliveryAddressValue === 'A definir';

      if (selectedCustomer) {
        if (isDeliveryAddressConsideredEmpty) {
          if (selectedCustomer.address && selectedCustomer.address.trim() !== '') {
            form.setValue('deliveryAddress', selectedCustomer.address, { shouldValidate: true });
          } else {
            form.setValue('deliveryAddress', '', { shouldValidate: true });
          }
        }
      }
    } else {
      const currentDeliveryAddressValue = form.getValues('deliveryAddress');
      const isDeliveryAddressConsideredEmpty = 
        currentDeliveryAddressValue === undefined ||
        currentDeliveryAddressValue === null ||
        currentDeliveryAddressValue.trim() === '' ||
        currentDeliveryAddressValue === 'A definir';
      if (isDeliveryAddressConsideredEmpty) {
         form.setValue('deliveryAddress', '', { shouldValidate: true });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [watchedCustomerId, customerList, form]); 


  
  useEffect(() => {
    let subTotalBasedOnCustomRates = 0;
    let subTotalBasedOnStandardRates = 0;

    const daysInput = watchedRentalDays;
    const days = (!watchedIsOpenEnded && daysInput && !isNaN(Number(daysInput)) && Number(daysInput) > 0) ? Number(daysInput) : (watchedIsOpenEnded ? 1 : 0);

    if (watchedEquipment && days > 0) {
      watchedEquipment.forEach(item => {
        const qtyInput = item.quantity;
        const qty = (qtyInput && !isNaN(Number(qtyInput))) ? Number(qtyInput) : 0;

        if (item.equipmentId && qty > 0) {
          const equipmentDetails = inventoryList.find(invItem => invItem.id === item.equipmentId);
          if (equipmentDetails) {
            const standardRate = (typeof equipmentDetails.dailyRentalRate === 'number' && !isNaN(equipmentDetails.dailyRentalRate)) ? equipmentDetails.dailyRentalRate : 0;
            
            let customRateInput = item.customDailyRentalRate;
            let customRate: number;

            if (customRateInput === undefined || String(customRateInput).trim() === '') {
                customRate = standardRate; 
            } else if (typeof customRateInput === 'number' && !isNaN(customRateInput)) {
                customRate = customRateInput;
            } else {
                customRate = standardRate; 
            }
            
            subTotalBasedOnCustomRates += (qty * customRate * days);
            subTotalBasedOnStandardRates += (qty * standardRate * days);
          }
        }
      });
    }

    const freightInput = watchedFreightValue;
    const freight = (typeof freightInput === 'number' && !isNaN(freightInput)) ? freightInput : 0;
    
    let finalContractValue = subTotalBasedOnCustomRates;
    if (!watchedIsOpenEnded) {
        finalContractValue += freight;
    }
    
    let calculatedDiscount = 0;
    if (subTotalBasedOnCustomRates < subTotalBasedOnStandardRates) {
        calculatedDiscount = subTotalBasedOnStandardRates - subTotalBasedOnCustomRates;
    }

    form.setValue('value', isNaN(finalContractValue) ? 0 : Math.max(0, finalContractValue), { shouldValidate: true });
    form.setValue('discountValue', isNaN(calculatedDiscount) ? 0 : Math.max(0, calculatedDiscount), { shouldValidate: true });

  }, [JSON.stringify(watchedEquipment), watchedRentalDays, watchedFreightValue, inventoryList, form, watchedIsOpenEnded]);


  const getEquipmentStandardRate = (equipmentId: string): number | undefined => {
    const item = inventoryList.find(inv => inv.id === equipmentId);
    return item?.dailyRentalRate;
  };

  const handleNewCustomerCreated = async (data: Omit<Customer, 'id'>) => {
    try {
      const newCustomer = await createCustomer(data); 
      if (newCustomer) {
        const refreshedCustomers = await getCustomers(); 
        setCustomerList(refreshedCustomers.sort((a, b) => a.name.localeCompare(b.name)));
        
        requestAnimationFrame(() => {
          form.setValue('customerId', newCustomer.id, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
        });

        toast({
          title: "Cliente Adicionado",
          description: `Cliente "${newCustomer.name}" foi adicionado e selecionado.`,
          variant: 'success',
        });
        setIsCustomerFormOpen(false); 
      }
    } catch (error) {
      console.error("Erro ao processar novo cliente no RentalForm:", error);
      throw error; 
    }
  };

  const openAddItemForm = (index: number) => {
    setCurrentEquipmentIndexForAddItem(index);
    setIsInventoryItemFormOpen(true);
  };

  const handleNewInventoryItemCreated = async (data: Omit<InventoryEquipment, 'id'>) => {
    try {
      const newItem = await createInventoryItem(data);
      if (newItem) {
        const refreshedInventory = await getInventoryItems(); 
        
        if (currentEquipmentIndexForAddItem !== null) {
          form.setValue(`equipment.${currentEquipmentIndexForAddItem}.equipmentId`, newItem.id, { shouldValidate: true });
          const rateToSet = (typeof newItem.dailyRentalRate === 'number' && !isNaN(newItem.dailyRentalRate)) ? newItem.dailyRentalRate : undefined;
          form.setValue(`equipment.${currentEquipmentIndexForAddItem}.customDailyRentalRate`, rateToSet , { shouldValidate: true });
        }
        toast({
          title: "Item de Inventário Criado",
          description: `${newItem.name} foi adicionado e selecionado.`,
          variant: 'success',
        });
        setIsInventoryItemFormOpen(false);
        setCurrentEquipmentIndexForAddItem(null);
        
        const updatedFullInventory = await getInventoryItems();
        setInventoryList(updatedFullInventory.sort((a, b) => a.name.localeCompare(b.name)));
        
        const currentAllRentals = allRentals; 
        const rentedMap = new Map<string, number>();
        currentAllRentals.forEach(r => {
            if (!r.actualReturnDate && (!initialData || r.id !== initialData.id)) {
            r.equipment.forEach(eq => {
                rentedMap.set(eq.equipmentId, (rentedMap.get(eq.equipmentId) || 0) + eq.quantity);
            });
            }
        });
        const newInventoryWithAvailability = updatedFullInventory.map(invItem => {
            const totalRentedByOthers = rentedMap.get(invItem.id) || 0;
            const available = invItem.quantity - totalRentedByOthers;
            return { ...invItem, availableQuantity: Math.max(0, available) };
        }).sort((a, b) => a.name.localeCompare(b.name));
        setInventoryWithAvailability(newInventoryWithAvailability);
      }
    } catch (error) {
       toast({
        title: 'Erro ao Criar Item',
        description: `Não foi possível criar o novo item. ${(error as Error).message}`,
        variant: 'destructive',
      });
    }
  };

  const handleEquipmentTypesUpdateInRentalForm = (updatedTypes: EquipmentType[]) => {
    setEquipmentTypesList(updatedTypes.sort((a,b) => a.name.localeCompare(b.name)));
  };


  const onSubmit = async (data: RentalFormValues) => {
    setIsLoading(true);
    form.clearErrors(); 

    let validationPassed = true;
    const currentAvailabilityMap = new Map<string, InventoryEquipment & { availableQuantity: number }>();
    inventoryWithAvailability.forEach(item => currentAvailabilityMap.set(item.id, item));

    const equipmentIdsInForm = data.equipment.map(eq => eq.equipmentId);
    const duplicateEquipment = equipmentIdsInForm.filter((id, index) => equipmentIdsInForm.indexOf(id) !== index && id !== '');
    
    if (duplicateEquipment.length > 0) {
        data.equipment.forEach((eq, index) => {
            if (duplicateEquipment.includes(eq.equipmentId)) {
                form.setError(`equipment.${index}.equipmentId`, { message: "Item duplicado. Agrupe as quantidades." });
                validationPassed = false;
            }
        });
    }


    data.equipment.forEach((eqInForm, index) => {
        if (!eqInForm.equipmentId) return; 

        const inventoryItemDetails = currentAvailabilityMap.get(eqInForm.equipmentId);
        
        if (!inventoryItemDetails) { 
            form.setError(`equipment.${index}.equipmentId`, { message: "Item de inventário não encontrado." });
            validationPassed = false;
            return;
        }

        let currentlyAvailableForThisCheck = inventoryItemDetails.availableQuantity;

        if (initialData) { 
            const originalItemInThisRental = initialData.equipment.find(origEq => origEq.equipmentId === eqInForm.equipmentId);
            if (originalItemInThisRental) {
                currentlyAvailableForThisCheck += originalItemInThisRental.quantity;
            }
        }
        
        if (eqInForm.quantity > currentlyAvailableForThisCheck) {
            form.setError(`equipment.${index}.quantity`, { message: `Máx ${currentlyAvailableForThisCheck} unid. disponíveis.` });
            validationPassed = false;
        }
    });

    if (!validationPassed) {
        setIsLoading(false);
        toast({ title: "Erro de Validação", description: "Corrija os erros no formulário.", variant: "destructive" });
        return;
    }
    
    const equipmentProcessed = data.equipment.map(eq => {
      let rate: number | null | undefined = eq.customDailyRentalRate;
      const standardRate = getEquipmentStandardRate(eq.equipmentId);
      
      if (rate === undefined || String(rate).trim() === '' || isNaN(Number(rate))) {
        rate = (standardRate !== undefined && !isNaN(standardRate)) ? standardRate : null;
      } else if (typeof rate === 'string') { 
        const parsedRate = parseFloat(rate);
        rate = isNaN(parsedRate) ? null : parsedRate;
      }
      
      return {
        ...eq,
        quantity: Number(eq.quantity) || 0,
        customDailyRentalRate: rate === null ? null : Number(rate) 
      };
    });

    const actionData = {
      ...data,
      equipment: equipmentProcessed,
      rentalStartDate: format(data.rentalStartDate, 'yyyy-MM-dd'),
      paymentDate: data.paymentDate ? format(data.paymentDate, 'yyyy-MM-dd') : undefined,
      rentalDays: data.isOpenEnded ? 0 : data.rentalDays,
      freightValue: (typeof data.freightValue === 'number' && !isNaN(data.freightValue)) ? data.freightValue : 0,
      discountValue: (typeof data.discountValue === 'number' && !isNaN(data.discountValue)) ? data.discountValue : 0,
      value: (typeof data.value === 'number' && !isNaN(data.value)) ? data.value : 0,
      deliveryAddress: data.deliveryAddress && data.deliveryAddress.trim() !== '' ? data.deliveryAddress : 'A definir',
    } as any; 

    try {
      await onSubmitAction(actionData);
      toast({
        title: `Aluguel ${initialData ? 'Atualizado' : 'Criado'}`,
        description: `O contrato de aluguel foi ${initialData ? 'atualizado' : 'criado'} com sucesso.`,
        variant: 'success',
      });
      router.push('/dashboard/rentals');
      router.refresh();
    } catch (error) {
      console.error("Erro ao criar/atualizar aluguel (CLIENTE):", error);
      toast({
        title: 'Erro',
        description: `Falha ao ${initialData ? 'atualizar' : 'criar'} aluguel. Detalhes: ${(error as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const rentalStartDateFromForm = form.watch("rentalStartDate");
  const rentalDaysFromForm = form.watch("rentalDays");
  
  const rentalDaysAsNumberForDisplay = Number(rentalDaysFromForm); 
  
  const expectedReturnDateForDisplay = !watchedIsOpenEnded && rentalStartDateFromForm && 
                             !isNaN(rentalDaysAsNumberForDisplay) && 
                             rentalDaysAsNumberForDisplay >= 1 && 
                             Number.isInteger(rentalDaysAsNumberForDisplay) 
                             ? addDays(rentalStartDateFromForm, Math.max(0, rentalDaysAsNumberForDisplay - 1)) 
                             : null;


  return (
    <Card className="max-w-4xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">{formTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Cliente</FormLabel>
                  <div className="flex items-center gap-2">
                    <Popover open={openCustomerCombobox} onOpenChange={setOpenCustomerCombobox}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? customerList.find(
                                  (customer) => customer.id === field.value
                                )?.name
                              : "Selecione um cliente"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar por nome ou telefone..." />
                          <CommandList>
                            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                            <CommandGroup>
                              {customerList.map((customer) => (
                                <CommandItem
                                  value={`${customer.name} ${customer.phone}`}
                                  key={customer.id}
                                  onSelect={() => {
                                    form.setValue("customerId", customer.id, { shouldValidate: true });
                                    setOpenCustomerCombobox(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      customer.id === field.value
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  <div className="flex items-center gap-3">
                                      <Avatar className="h-6 w-6">
                                          <AvatarImage src={customer.imageUrl || undefined} alt={customer.name} />
                                          <AvatarFallback>{customer.name.charAt(0).toUpperCase()}</AvatarFallback>
                                      </Avatar>
                                      <span>{customer.name} - {customer.phone}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Dialog open={isCustomerFormOpen} onOpenChange={setIsCustomerFormOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="icon" title="Adicionar Novo Cliente">
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      {isCustomerFormOpen && (
                        <CustomerForm
                          onSubmitAction={handleNewCustomerCreated} 
                          onClose={() => setIsCustomerFormOpen(false)} 
                          isSubForm={true}
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
                name="isOpenEnded"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                        <FormLabel>Aluguel em Aberto</FormLabel>
                        <FormDescription>
                        Marque se o aluguel não tem data de término definida. O valor será cobrado por dia.
                        </FormDescription>
                    </div>
                    <FormControl>
                        <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        />
                    </FormControl>
                    </FormItem>
                )}
            />

            <div>
              <FormLabel className="text-base font-semibold">Equipamento(s)</FormLabel>
              {fields.map((item, index) => {
                const selectedEquipmentId = watchedEquipment[index]?.equipmentId;
                const selectedEquipmentDetails = inventoryList.find(inv => inv.id === selectedEquipmentId);
                
                return (
                  <div key={item.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-end mt-2 p-3 border rounded-md relative">
                    <FormField
                      control={form.control}
                      name={`equipment.${index}.equipmentId`}
                      render={({ field }) => (
                        <FormItem className="flex-grow min-w-[200px]">
                          {index === 0 && <FormLabel className="text-xs text-muted-foreground">Item</FormLabel>}
                          <Popover open={openEquipmentCombobox[index] || false} onOpenChange={(open) => setOpenEquipmentCombobox(prev => ({...prev, [index]: open}))}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                >
                                  {field.value
                                    ? inventoryList.find((eq) => eq.id === field.value)?.name
                                    : "Selecione..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                               <Command>
                                  <CommandInput placeholder="Buscar equipamento..." />
                                  <CommandList>
                                    <CommandEmpty>Nenhum equipamento encontrado.</CommandEmpty>
                                    <CommandGroup>
                                    {inventoryWithAvailability
                                        .filter(inv => inv.availableQuantity > 0 || inv.id === field.value)
                                        .map(invItem => (
                                          <CommandItem
                                            value={`${invItem.name} ${invItem.id}`}
                                            key={invItem.id}
                                            onSelect={() => {
                                              form.setValue(`equipment.${index}.equipmentId`, invItem.id, { shouldValidate: true });
                                              const rate = getEquipmentStandardRate(invItem.id);
                                              const currentCustomRate = form.getValues(`equipment.${index}.customDailyRentalRate`);
                                              if (rate !== undefined && (currentCustomRate === undefined || String(currentCustomRate).trim() === '' || currentCustomRate === getEquipmentStandardRate(field.value)) ) {
                                                form.setValue(`equipment.${index}.customDailyRentalRate`, rate, {shouldValidate: true});
                                              }
                                              setOpenEquipmentCombobox(prev => ({...prev, [index]: false}));
                                            }}
                                          >
                                            <Check
                                              className={cn("mr-2 h-4 w-4", invItem.id === field.value ? "opacity-100" : "opacity-0")}
                                            />
                                             <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={invItem.imageUrl || undefined} alt={invItem.name} />
                                                    <AvatarFallback><Package className="h-4 w-4" /></AvatarFallback>
                                                </Avatar>
                                                <span>{invItem.name} (Disp: {invItem.availableQuantity})</span>
                                            </div>
                                          </CommandItem>
                                    ))}
                                    </CommandGroup>
                                  </CommandList>
                               </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Dialog open={isInventoryItemFormOpen && currentEquipmentIndexForAddItem === index} onOpenChange={(open) => {if(!open) {setIsInventoryItemFormOpen(false); setCurrentEquipmentIndexForAddItem(null);}}}>
                        <DialogTrigger asChild>
                            <Button type="button" variant="outline" size="icon" title="Adicionar Novo Item ao Inventário" onClick={() => openAddItemForm(index)} className="self-end h-9 w-9">
                                <PackagePlus className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        {isInventoryItemFormOpen && currentEquipmentIndexForAddItem === index && (
                            <InventoryItemForm
                                equipmentTypes={equipmentTypesList}
                                inventory={inventoryList} 
                                onSubmitAction={handleNewInventoryItemCreated}
                                onClose={() => {setIsInventoryItemFormOpen(false); setCurrentEquipmentIndexForAddItem(null);}}
                                onEquipmentTypesUpdate={handleEquipmentTypesUpdateInRentalForm}
                            />
                        )}
                    </Dialog>
                     <FormField
                      control={form.control}
                      name={`equipment.${index}.customDailyRentalRate`}
                      render={({ field }) => (
                        <FormItem className="min-w-[150px]">
                           {index === 0 && <FormLabel className="text-xs text-muted-foreground">Taxa Diária (R$)</FormLabel>}
                           <div className="flex items-center gap-1">
                            <FormControl>
                                <Input
                                type="text"
                                placeholder="Padrão se vazio"
                                value={field.value === undefined ? '' : formatToBRL(field.value)}
                                onChange={(e) => {
                                  const parsedValue = parseFromBRL(e.target.value);
                                  field.onChange(e.target.value.trim() === '' || isNaN(parsedValue) ? undefined : parsedValue);
                                }}
                                className="w-full"
                                />
                            </FormControl>
                            {selectedEquipmentDetails && (
                                <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" type="button" className="h-8 w-8 p-0">
                                        <Info className="h-4 w-4 text-muted-foreground"/>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto text-xs p-2">
                                    Taxa Padrão: {formatToBRL(selectedEquipmentDetails.dailyRentalRate)}
                                </PopoverContent>
                                </Popover>
                            )}
                           </div>
                           <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`equipment.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem className="min-w-[80px]">
                          {index === 0 && <FormLabel className="text-xs text-muted-foreground">Qtd.</FormLabel>}
                          <Input type="number" placeholder="Qtd" {...field} className="w-full" min="1"/>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {fields.length > 1 && (
                      <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} title="Remover Equipamento" className="self-end h-9 w-9">
                          <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => append({ equipmentId: '', quantity: 1, customDailyRentalRate: undefined })}
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Equipamento
              </Button>
               {form.formState.errors.equipment && !form.formState.errors.equipment.root?.message && !Array.isArray(form.formState.errors.equipment) && (
                <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.equipment.message}</p>
               )}
               {typeof form.formState.errors.equipment?.root?.message === 'string' && (
                 <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.equipment.root.message}</p>
               )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="rentalStartDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Início do Aluguel</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                          >
                            {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!watchedIsOpenEnded && (
                <FormField
                  control={form.control}
                  name="rentalDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dias de Aluguel</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="ex: 7" {...field} min="1"/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            
            {expectedReturnDateForDisplay && !watchedIsOpenEnded && (
              <FormItem>
                <FormLabel>Data de Retorno Esperada</FormLabel>
                <Input type="text" value={format(expectedReturnDateForDisplay, "PPP", { locale: ptBR })} readOnly disabled className="bg-muted" />
              </FormItem>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="chargeSaturdays"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3">
                        <FormControl>
                            <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>
                            Cobrar Sábados?
                            </FormLabel>
                        </div>
                        </FormItem>
                    )}
                />
                    <FormField
                    control={form.control}
                    name="chargeSundays"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3">
                        <FormControl>
                            <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>
                            Cobrar Domingos?
                            </FormLabel>
                        </div>
                        </FormItem>
                    )}
                />
            </div>
            

            <FormField
                control={form.control}
                name="deliveryAddress"
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-muted-foreground"/>Endereço de Entrega (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Endereço do cliente (se houver) ou digite um específico" 
                        {...field}
                        onChange={(e) => field.onChange(e.target.value === 'A definir' ? '' : e.target.value)}
                        value={field.value === 'A definir' ? '' : field.value || ''}
                        rows={3}
                      />
                    </FormControl>
                    <FormDescription>Será preenchido com o endereço do cliente se disponível e este campo estiver vazio. Caso contrário, será "A definir" se não preenchido.</FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />

            <FormField
              control={form.control}
              name="freightValue"
              render={({ field }) => (
              <FormItem>
                  <FormLabel className="flex items-center"><Truck className="mr-2 h-4 w-4 text-muted-foreground"/>Valor do Frete (R$)</FormLabel>
                  <FormControl>
                  <Input
                      type="text"
                      placeholder="R$ 0,00"
                      value={field.value === undefined ? '' : formatToBRL(field.value)}
                      onChange={(e) => {
                          const parsedValue = parseFromBRL(e.target.value);
                          field.onChange(isNaN(parsedValue) ? undefined : parsedValue);
                      }}
                  />
                  </FormControl>
                  <FormMessage />
              </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField
                    control={form.control}
                    name="discountValue"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center"><Percent className="mr-2 h-4 w-4 text-muted-foreground"/>Desconto Aplicado (R$)</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            value={formatToBRL(field.value)}
                            readOnly
                            disabled
                            className="bg-muted/50 font-bold"
                          />
                        </FormControl>
                         <FormDescription>Desconto calculado (Taxas Padrão - Taxas Customizadas).</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                        {watchedIsOpenEnded ? "Valor da Diária (Total)" : "Valor Total do Aluguel"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        value={formatToBRL(field.value)}
                        readOnly
                        disabled
                        className="bg-muted/50 font-bold text-lg"
                      />
                    </FormControl>
                    <FormDescription>
                        {watchedIsOpenEnded 
                            ? "Calculado (Soma das diárias dos equipamentos)."
                            : "Calculado (Equip. Custom. + Frete)."
                        }
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="paymentStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status do Pagamento</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'pending'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status do pagamento" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="paid">Pago</SelectItem>
                          <SelectItem value="overdue">Atrasado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma de Pagamento</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'pix'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a forma de pagamento" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="nao_definido">Não Definido</SelectItem>
                          <SelectItem value="pix"><div className="flex items-center"><Landmark className="mr-2 h-4 w-4" />PIX</div></SelectItem>
                          <SelectItem value="dinheiro"><div className="flex items-center"><CircleDollarSign className="mr-2 h-4 w-4" />Dinheiro</div></SelectItem>
                          <SelectItem value="cartao_credito"><div className="flex items-center"><CreditCard className="mr-2 h-4 w-4" />Cartão de Crédito</div></SelectItem>
                          <SelectItem value="cartao_debito"><div className="flex items-center"><CreditCard className="mr-2 h-4 w-4" />Cartão de Débito</div></SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            {watchedPaymentStatus === 'paid' && (
                 <FormField
                    control={form.control}
                    name="paymentDate"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Data do Pagamento</FormLabel>
                        <Popover>
                        <PopoverTrigger asChild>
                            <FormControl>
                            <Button
                                variant={"outline"}
                                className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                            >
                                {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                            locale={ptBR}
                            />
                        </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            )}


            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Quaisquer observações adicionais sobre este aluguel..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <CardFooter className="px-0 pt-6">
              <Button type="submit" className="w-full md:w-auto" disabled={isLoading}>
                {isLoading ? 'Salvando...' : <><Save className="mr-2 h-4 w-4" /> {submitButtonText}</>}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()} className="ml-2" disabled={isLoading}>
                Cancelar
              </Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
