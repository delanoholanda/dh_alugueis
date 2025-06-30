
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { extendRental as extendRentalAction } from '@/actions/rentalActions';
import type { Rental, Equipment as InventoryEquipment } from '@/types';
import { Loader2, CalendarPlus, AlertCircle, InfinityIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatToBRL } from '@/lib/utils';

interface ExtendRentalDialogProps {
  rental: Rental;
  inventory: InventoryEquipment[]; 
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onExtensionSuccess: () => Promise<void>; 
}

export function ExtendRentalDialog({ rental, inventory, isOpen, onOpenChange, onExtensionSuccess }: ExtendRentalDialogProps) {
  const [extensionType, setExtensionType] = useState<'fixed' | 'open_ended'>('fixed');
  const [additionalDays, setAdditionalDays] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [costPreview, setCostPreview] = useState<number>(0);
  const { toast } = useToast();
  
  const [chargeSaturday, setChargeSaturday] = useState(rental.chargeSaturdays ?? true);
  const [chargeSunday, setChargeSunday] = useState(rental.chargeSundays ?? true);
  const [dailyRate, setDailyRate] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
        setChargeSaturday(rental.chargeSaturdays ?? true);
        setChargeSunday(rental.chargeSundays ?? true);
        setExtensionType('fixed');
        setAdditionalDays(1);

        let calculatedDailyRate = 0;
        if (inventory.length > 0 && !rental.isOpenEnded) {
            for (const rentedEq of rental.equipment) {
                const inventoryItem = inventory.find(inv => inv.id === rentedEq.equipmentId);
                let rateToUse = rentedEq.customDailyRentalRate;
                if (rateToUse === undefined || rateToUse === null) {
                    rateToUse = inventoryItem?.dailyRentalRate ?? 0;
                }
                if (inventoryItem && typeof rateToUse === 'number') {
                    calculatedDailyRate += rentedEq.quantity * rateToUse;
                }
            }
        }
        setDailyRate(calculatedDailyRate);
    }
  }, [isOpen, rental, inventory]);
  
  useEffect(() => {
    if (extensionType === 'fixed') {
        setCostPreview(dailyRate * additionalDays);
    } else { // open_ended
        setCostPreview(dailyRate);
    }
  }, [extensionType, additionalDays, dailyRate]);


  const handleExtensionSubmit = async () => {
    if (extensionType === 'fixed' && additionalDays <= 0) {
      toast({ title: 'Erro', description: 'Número de dias adicionais deve ser positivo.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);

    const options = {
        type: extensionType,
        additionalDays: extensionType === 'fixed' ? additionalDays : undefined,
        chargeSaturdays: chargeSaturday,
        chargeSundays: chargeSunday
    };

    try {
      const updatedRental = await extendRentalAction(rental.id, options);
      if (updatedRental) {
        toast({ 
          title: 'Aluguel Prorrogado', 
          description: `Novo contrato de extensão criado com sucesso.`,
          variant: 'success',
        });
        onOpenChange(false); 
        await onExtensionSuccess(); 
      } else {
        toast({ title: 'Erro', description: 'Falha ao prorrogar aluguel. O aluguel pode não ter sido encontrado.', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erro', description: `Ocorreu um erro: ${(error as Error).message}`, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const displayDate = (dateString: string) => {
    return format(parseISO(dateString), 'P', { locale: ptBR });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <CalendarPlus className="mr-2 h-5 w-5 text-primary" /> Prorrogar Aluguel (ID: {rental.id})
          </DialogTitle>
        </DialogHeader>
        {rental.isOpenEnded ? (
             <div className="p-4 border border-orange-400 bg-orange-50 text-orange-800 rounded-md text-sm">
                <AlertCircle className="inline-block h-5 w-5 mr-2" />
                Não é possível prorrogar um aluguel que já está "em aberto". Finalize o aluguel primeiro para calcular o valor devido.
            </div>
        ) : (
            <>
            <div className="space-y-4 py-4">
              <div>
                  <p>Cliente: <span className="font-semibold">{rental.customerName}</span></p>
                  <p>Retorno Atual: <span className="font-semibold">{displayDate(rental.expectedReturnDate)}</span></p>
                  <p>Valor Atual: <span className="font-semibold">{formatToBRL(rental.value)}</span></p>
              </div>

              <RadioGroup value={extensionType} onValueChange={(value: 'fixed' | 'open_ended') => setExtensionType(value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fixed" id="r-fixed" />
                    <Label htmlFor="r-fixed">Prorrogar por período fixo</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="open_ended" id="r-open" />
                    <Label htmlFor="r-open">Prorrogar como contrato em aberto</Label>
                  </div>
              </RadioGroup>
              
              {extensionType === 'fixed' && (
                <div className="pl-6 pt-2 space-y-4">
                  <div>
                      <Label htmlFor="additionalDays" className="text-sm font-medium">Dias Adicionais de Aluguel</Label>
                      <Input
                      id="additionalDays"
                      type="number"
                      min="1"
                      value={additionalDays}
                      onChange={(e) => setAdditionalDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="mt-1"
                      />
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                      <Checkbox id="chargeSaturday" checked={chargeSaturday} onCheckedChange={(checked) => setChargeSaturday(!!checked)} />
                      <Label htmlFor="chargeSaturday">Cobrar Sábados?</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                      <Checkbox id="chargeSunday" checked={chargeSunday} onCheckedChange={(checked) => setChargeSunday(!!checked)} />
                      <Label htmlFor="chargeSunday">Cobrar Domingos?</Label>
                  </div>
              </div>
              
              <div className="mt-2 mb-4 p-3 border rounded-md bg-muted/50">
                <p className="text-sm text-foreground">
                    {extensionType === 'fixed' 
                        ? <>Custo adicional da prorrogação: <span className="font-bold">{formatToBRL(costPreview)}</span></>
                        : <><InfinityIcon className="inline h-4 w-4 mr-1"/>Nova diária do contrato: <span className="font-bold">{formatToBRL(costPreview)}</span></>
                    }
                </p>
                <p className="text-xs text-muted-foreground">
                    Um novo contrato será criado para esta extensão.
                </p>
              </div>

            </div>
            <DialogFooter>
            <DialogClose asChild>
                <Button variant="outline" disabled={isLoading}>Cancelar</Button>
            </DialogClose>
            <Button onClick={handleExtensionSubmit} disabled={isLoading || (extensionType === 'fixed' && additionalDays <= 0)} className="bg-primary hover:bg-primary/90">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarPlus className="mr-2 h-4 w-4" />}
                Confirmar Prorrogação
            </Button>
            </DialogFooter>
            </>
        )}
      </DialogContent>
    </Dialog>
  );
}
