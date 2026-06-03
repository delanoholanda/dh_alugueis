
'use client';

import type { Quote, Customer, Equipment as InventoryEquipment, EquipmentType, Rental } from '@/types';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { CalendarIcon, PlusCircle, Trash2, Save, Truck, Percent, UserPlus, PackagePlus, MapPin, Info, ChevronsUpDown, Check, Package, ArrowLeft } from 'lucide-react';
import { format, parseISO, isSameDay, isWithinInterval, startOfDay, endOfDay, addDays, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
import { formatToBRL, parseFromBRL, cn, findNthBillableDay } from '@/lib/utils';
import { CustomerForm } from '@/app/dashboard/customers/components/CustomerForm';
import { createCustomer, getCustomers } from '@/actions/customerActions';
import { InventoryItemForm } from '@/app/dashboard/inventory/components/InventoryItemForm';
import { createInventoryItem, getInventoryItems } from '@/actions/inventoryActions';
import { getEquipmentTypes as fetchEquipmentTypesAction } from '@/actions/equipmentTypeActions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const quoteFormSchema = z.object({
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
  expectedReturnDate: z.date({ required_error: "Data de retorno é obrigatória." }),
  chargeSaturdays: z.boolean().default(true),
  chargeSundays: z.boolean().default(true),
  rentalDays: z.coerce.number({invalid_type_error: "Dias de aluguel deve ser um número."})
      .min(0.5, "Deve ser pelo menos 0.5 dia."),
  freightValue: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? 0 : val), 
      z.coerce.number({invalid_type_error: "Valor do frete deve ser um número."})
        .min(0, "Valor do frete não pode ser negativo")
        .optional()
    ),
  discountValue: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? 0 : val),
      z.coerce.number({invalid_type_error: "Valor do desconto deve ser um número."})
      .min(0, "Valor do desconto não pode ser negativo")
      .optional()
    ),
  value: z.coerce.number({invalid_type_error: "Valor deve ser um número.", required_error: "Valor é obrigatório."})
    .min(0, "Valor não pode ser negativo"),
  notes: z.string().optional(),
  deliveryAddress: z.string().optional(),
});


type QuoteFormValues = z.infer<typeof quoteFormSchema>;

interface QuoteFormProps {
  initialData?: Quote;
  customers: Customer[];
  inventory: InventoryEquipment[];
  equipmentTypes: EquipmentType[];
  allRentals: Rental[];
  onSubmitAction: (data: QuoteFormValues) => Promise<Quote | null | void>;
  formTitle: string;
  submitButtonText: string;
}

export function QuoteForm({ 
  initialData, 
  customers: initialCustomers, 
  inventory: initialInventory, 
  equipmentTypes: initialEquipmentTypes,
  allRentals, 
  onSubmitAction, 
  formTitle, 
  submitButtonText 
}: QuoteFormProps) {
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
  const [equipmentTypesList, setEquipmentTypesList] = useState<EquipmentType[]>(() =>
    initialEquipmentTypes.sort((a, b) => a.name.localeCompare(b.name))
  );
  const [currentEquipmentIndexForAddItem, setCurrentEquipmentIndexForAddItem] = useState<number | null>(null);

  const [focusedCurrencyField, setFocusedCurrencyField] = useState<string | null>(null);

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: initialData ? {
      ...initialData,
      rentalStartDate: initialData.rentalStartDate ? parseISO(initialData.rentalStartDate) : new Date(),
      expectedReturnDate: initialData.expectedReturnDate ? parseISO(initialData.expectedReturnDate) : new Date(),
      equipment: initialData.equipment.map(eq => ({
        equipmentId: eq.equipmentId,
        quantity: eq.quantity,
        customDailyRentalRate: eq.customDailyRentalRate === null ? undefined : eq.customDailyRentalRate 
      })),
      chargeSaturdays: initialData.chargeSaturdays ?? true,
      chargeSundays: initialData.chargeSundays ?? true,
      freightValue: initialData.freightValue || 0,
      discountValue: initialData.discountValue || 0,
      notes: initialData.notes ?? '', 
      deliveryAddress: initialData.deliveryAddress || 'A definir',
    } : {
      customerId: '',
      equipment: [{ equipmentId: '', quantity: 1, customDailyRentalRate: undefined }],
      rentalStartDate: new Date(),
      rentalDays: 1,
      chargeSaturdays: true,
      chargeSundays: true,
      freightValue: 0,
      discountValue: 0,
      value: 0,
      notes: '',
      deliveryAddress: 'A definir',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "equipment"
  });

  const watchedEquipment = form.watch("equipment");
  const watchedRentalDays = form.watch("rentalDays");
  const watchedFreightValue = form.watch("freightValue");
  const watchedDiscountValue = form.watch("discountValue");
  const watchedRentalStartDate = form.watch("rentalStartDate");
  const watchedChargeSaturdays = form.watch("chargeSaturdays");
  const watchedChargeSundays = form.watch("chargeSundays");
  const watchedExpectedReturnDate = form.watch("expectedReturnDate");

  const inventoryWithAvailability = useMemo(() => {
    const newStartDate = form.getValues('rentalStartDate');
    const newEndDate = form.getValues('expectedReturnDate');

    if (!newStartDate || !newEndDate) {
      return inventoryList.map(item => ({ 
        ...item, 
        availableQuantity: item.status === 'rented' ? 0 : item.quantity 
      }));
    }

    const requestedInterval = { start: startOfDay(newStartDate), end: endOfDay(newEndDate) };
    const daysToCheck = eachDayOfInterval(requestedInterval);
    const usageOnEachDay = new Map<string, Map<string, number>>();
    
    for (const day of daysToCheck) {
        usageOnEachDay.set(format(day, 'yyyy-MM-dd'), new Map<string, number>());
    }

    for (const rental of allRentals) {
        if (rental.actualReturnDate) {
             const rStart = startOfDay(parseISO(rental.rentalStartDate));
             const rEnd = endOfDay(parseISO(rental.actualReturnDate));
             const rInterval = { start: rStart, end: rEnd };
             for (const day of daysToCheck) {
                 if (isWithinInterval(day, rInterval)) {
                     const dayKey = format(day, 'yyyy-MM-dd');
                     const dayMap = usageOnEachDay.get(dayKey)!;
                     for (const eq of rental.equipment) {
                         dayMap.set(eq.equipmentId, (dayMap.get(eq.equipmentId) || 0) + eq.quantity);
                     }
                 }
             }
        } else {
             const rStart = startOfDay(parseISO(rental.rentalStartDate));
             const rEnd = rental.isOpenEnded ? addDays(new Date(), 730) : endOfDay(parseISO(rental.expectedReturnDate));
             const rInterval = { start: rStart, end: rEnd };
             for (const day of daysToCheck) {
                 if (isWithinInterval(day, rInterval)) {
                     const dayKey = format(day, 'yyyy-MM-dd');
                     const dayMap = usageOnEachDay.get(dayKey)!;
                     for (const eq of rental.equipment) {
                         dayMap.set(eq.equipmentId, (dayMap.get(eq.equipmentId) || 0) + eq.quantity);
                     }
                 }
             }
        }
    }

    const maxRentedAcrossPeriod = new Map<string, number>();
    for (const [dayKey, dayMap] of usageOnEachDay) {
        for (const [eqId, qty] of dayMap) {
            const currentMax = maxRentedAcrossPeriod.get(eqId) || 0;
            if (qty > currentMax) maxRentedAcrossPeriod.set(eqId, qty);
        }
    }

    return inventoryList
        .filter(item => item.forRental)
        .map(item => {
            const maxRented = maxRentedAcrossPeriod.get(item.id) || 0;
            const baseAvailable = item.status === 'rented' ? 0 : item.quantity;
            return { ...item, availableQuantity: Math.max(0, baseAvailable - maxRented) };
        });

  }, [inventoryList, allRentals, initialData, watchedRentalStartDate, watchedExpectedReturnDate]);


  useEffect(() => {
    const startDate = watchedRentalStartDate ? new Date(watchedRentalStartDate) : null;
    const days = watchedRentalDays;
    
    if (startDate && !isNaN(startDate.getTime()) && !isNaN(days) && days > 0) {
      const newEndDate = findNthBillableDay(startDate, days, watchedChargeSaturdays, watchedChargeSundays);
      const currentEndDate = form.getValues('expectedReturnDate');
      if (!currentEndDate || !isSameDay(currentEndDate, newEndDate)) {
        form.setValue('expectedReturnDate', newEndDate, { shouldValidate: true });
      }
    }
  }, [watchedRentalDays, watchedRentalStartDate, watchedChargeSaturdays, watchedChargeSundays, form]);
  
  useEffect(() => {
    let itemsTotalValue = 0;
    const days = watchedRentalDays || 0;

    if (watchedEquipment && days > 0) {
      watchedEquipment.forEach(item => {
        const qty = item.quantity || 0;
        if (item.equipmentId && qty > 0) {
          const equipmentDetails = inventoryList.find(invItem => invItem.id === item.equipmentId);
          if (equipmentDetails) {
            const customRate = item.customDailyRentalRate ?? equipmentDetails.dailyRentalRate ?? 0;
            itemsTotalValue += (qty * customRate * days);
          }
        }
      });
    }

    const freight = watchedFreightValue || 0;
    const discount = watchedDiscountValue || 0;
    const finalContractValue = itemsTotalValue + freight - discount;
    
    if (form.getValues('value') !== finalContractValue) {
        form.setValue('value', finalContractValue < 0 ? 0 : finalContractValue, { shouldValidate: true });
    }

  }, [
    JSON.stringify(watchedEquipment), 
    watchedRentalDays, 
    watchedFreightValue, 
    watchedDiscountValue, 
    inventoryList, 
    form
  ]);

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
        form.setValue('customerId', newCustomer.id, { shouldValidate: true });
        toast({ title: "Cliente Adicionado", description: `"${newCustomer.name}" adicionado e selecionado.`, variant: 'success' });
        setIsCustomerFormOpen(false); 
      }
    } catch (error) {
      throw error; 
    }
  };

  const onSubmit = async (data: QuoteFormValues) => {
    setIsLoading(true);
    const actionData = {
      ...data,
      rentalStartDate: format(data.rentalStartDate, 'yyyy-MM-dd'),
      expectedReturnDate: format(data.expectedReturnDate, 'yyyy-MM-dd'),
      deliveryAddress: data.deliveryAddress && data.deliveryAddress.trim() !== '' ? data.deliveryAddress : 'A definir',
    } as any;
    try {
      await onSubmitAction(actionData);
      toast({ title: `Orçamento ${initialData ? 'Atualizado' : 'Criado'}`, variant: 'success' });
      router.back();
      router.refresh();
    } catch (error) {
      toast({ title: 'Erro', description: `Falha ao salvar orçamento. Detalhes: ${(error as Error).message}`, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

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
                          <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                            {field.value ? customerList.find(c => c.id === field.value)?.name : "Selecione um cliente"}
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
                                <CommandItem value={`${customer.name} ${customer.phone}`} key={customer.id} onSelect={() => { form.setValue("customerId", customer.id, { shouldValidate: true }); setOpenCustomerCombobox(false); }}>
                                  <Check className={cn("mr-2 h-4 w-4", customer.id === field.value ? "opacity-100" : "opacity-0")} />
                                  <div className="flex items-center gap-3">
                                      <Avatar className="h-6 w-6"><AvatarImage src={customer.imageUrl || undefined} alt={customer.name} /><AvatarFallback>{customer.name.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
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
                      <DialogTrigger asChild><Button type="button" variant="outline" size="icon" title="Adicionar Novo Cliente"><UserPlus className="h-4 w-4" /></Button></DialogTrigger>
                      {isCustomerFormOpen && <CustomerForm onSubmitAction={handleNewCustomerCreated} onClose={() => setIsCustomerFormOpen(false)} isSubForm={true} />}
                    </Dialog>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div>
              <FormLabel className="text-base font-semibold">Equipamento(s)</FormLabel>
              {fields.map((item, index) => {
                 const selectedEquipmentId = watchedEquipment[index]?.equipmentId;
                 const selectedEquipmentDetails = inventoryList.find(inv => inv.id === selectedEquipmentId);
                return (
                  <div key={item.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end mt-2 p-3 border rounded-md relative">
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
                                  type="button"
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
                    <FormField
                      control={form.control}
                      name={`equipment.${index}.customDailyRentalRate`}
                      render={({ field }) => (
                        <FormItem className="min-w-[150px]">
                           {index === 0 && <FormLabel className="text-xs text-muted-foreground">Taxa Diária (R$)</FormLabel>}
                           <div className="flex items-center gap-1">
                            <FormControl>
                                <Input
                                type={focusedCurrencyField === `customRate-${index}` ? 'number' : 'text'}
                                placeholder="Padrão se vazio"
                                value={focusedCurrencyField === `customRate-${index}` ? (field.value ?? '') : formatToBRL(field.value)}
                                onFocus={() => setFocusedCurrencyField(`customRate-${index}`)}
                                onBlur={() => setFocusedCurrencyField(null)}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    field.onChange(value === '' ? undefined : parseFloat(value));
                                }}
                                step="0.01"
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
                    <FormField control={form.control} name={`equipment.${index}.quantity`} render={({ field }) => (
                      <FormItem className="min-w-[80px]">
                        {index === 0 && <FormLabel className="text-xs text-muted-foreground">Qtd.</FormLabel>}
                        <Input type="number" placeholder="Qtd" {...field} min="1"/>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} title="Remover" className="self-end h-9 w-9"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )
              })}
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append({ equipmentId: '', quantity: 1, customDailyRentalRate: undefined })}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField control={form.control} name="rentalStartDate" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Data de Início</FormLabel>
                  <Popover modal={true}><PopoverTrigger asChild><FormControl>
                    <Button type="button" variant={"outline"} className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}>
                      {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl></PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={ptBR} /></PopoverContent></Popover>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="rentalDays" render={({ field }) => (
                <FormItem><FormLabel>Dias de Aluguel</FormLabel><FormControl><Input type="number" {...field} min="0.5" step="0.5"/></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="expectedReturnDate" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Data de Retorno (Calculada)</FormLabel>
                  <Popover modal={true}><PopoverTrigger asChild disabled>
                    <FormControl><Button type="button" variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground", "bg-muted/50 disabled:opacity-100 disabled:cursor-default")} disabled>
                      {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>-</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button></FormControl>
                  </PopoverTrigger></Popover>
                  <FormDescription>Calculado automaticamente.</FormDescription><FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="chargeSaturdays" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Cobrar Sábados?</FormLabel></div></FormItem>)} />
              <FormField control={form.control} name="chargeSundays" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Cobrar Domingos?</FormLabel></div></FormItem>)} />
            </div>

            <FormField control={form.control} name="freightValue" render={({ field }) => (
              <FormItem><FormLabel className="flex items-center"><Truck className="mr-2 h-4 w-4 text-muted-foreground"/>Valor do Frete (R$)</FormLabel>
                <FormControl><Input 
                    type={focusedCurrencyField === 'freight' ? 'number' : 'text'}
                    placeholder="R$ 0,00"
                    value={focusedCurrencyField === 'freight' ? (field.value ?? '') : formatToBRL(field.value)}
                    onFocus={() => setFocusedCurrencyField('freight')}
                    onBlur={() => setFocusedCurrencyField(null)}
                    onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === '' ? 0 : parseFloat(value));
                    }}
                    step="0.01"
                /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

             <FormField
              control={form.control}
              name="discountValue"
              render={({ field }) => (
              <FormItem>
                  <FormLabel className="flex items-center"><Percent className="mr-2 h-4 w-4 text-muted-foreground"/>Aplicar Desconto (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type={focusedCurrencyField === 'discount' ? 'number' : 'text'}
                      placeholder="R$ 0,00"
                      value={focusedCurrencyField === 'discount' ? (field.value ?? '') : formatToBRL(field.value)}
                      onFocus={() => setFocusedCurrencyField('discount')}
                      onBlur={() => setFocusedCurrencyField(null)}
                      onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(value === '' ? 0 : parseFloat(value));
                      }}
                      step="0.01"
                    />
                  </FormControl>
                  <FormMessage />
              </FormItem>
              )}
            />

            <FormField control={form.control} name="value" render={({ field }) => (
              <FormItem><FormLabel>Valor Total do Orçamento</FormLabel>
                <FormControl><Input type="text" value={formatToBRL(field.value)} readOnly disabled className="bg-muted/50 font-bold text-lg" /></FormControl>
                <FormDescription>Calculado (Equipamentos + Frete - Desconto).</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Observações (Opcional)</FormLabel><FormControl><Textarea placeholder="Quaisquer observações adicionais..." {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <CardFooter className="px-0 pt-6">
              <Button type="submit" className="w-full md:w-auto" disabled={isLoading}>{isLoading ? 'Salvando...' : <><Save className="mr-2 h-4 w-4" /> {submitButtonText}</>}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()} className="ml-2" disabled={isLoading}><ArrowLeft className="mr-2 h-4 w-4" />Cancelar</Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
