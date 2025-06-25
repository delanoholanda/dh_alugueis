
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { extendRental as extendRentalAction } from '@/actions/rentalActions';
import type { Rental, Equipment as InventoryEquipment } from '@/types';
import { Loader2, CalendarPlus, AlertCircle } from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatToBRL, countBillableDays } from '@/lib/utils';

interface ExtendRentalDialogProps {
  rental: Rental;
  inventory: InventoryEquipment[]; 
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onExtensionSuccess: () => Promise<void>; 
}

export function ExtendRentalDialog({ rental, inventory, isOpen, onOpenChange, onExtensionSuccess }: ExtendRentalDialogProps) {
  const [additionalDays, setAdditionalDays] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [extensionCostPreview, setExtensionCostPreview] = useState<number>(0);
  const { toast } = useToast();
  
  const [chargeSaturday, setChargeSaturday] = useState(rental.chargeSaturdays ?? true);
  const [chargeSunday, setChargeSunday] = useState(rental.chargeSundays ?? true);

  useEffect(() => {
    if (isOpen) {
        setChargeSaturday(rental.chargeSaturdays ?? true);
        setChargeSunday(rental.chargeSundays ?? true);
    }
  }, [isOpen, rental.chargeSaturdays, rental.chargeSundays]);


  useEffect(() => {
    if (additionalDays > 0 && rental && inventory.length > 0 && !rental.isOpenEnded) {
      const originalReturnDate = parseISO(rental.expectedReturnDate);
      const extensionStartDate = addDays(originalReturnDate, 1);
      const extensionEndDate = addDays(extensionStartDate, additionalDays - 1);
      
      const billableDays = countBillableDays(
        format(extensionStartDate, 'yyyy-MM-dd'),
        format(extensionEndDate, 'yyyy-MM-dd'),
        chargeSaturday,
        chargeSunday
      );

      let dailyRate = 0;
      for (const rentedEq of rental.equipment) {
        const inventoryItem = inventory.find(inv => inv.id === rentedEq.equipmentId);
        let rateToUse = rentedEq.customDailyRentalRate;
        if (rateToUse === undefined || rateToUse === null) {
            rateToUse = inventoryItem?.dailyRentalRate ?? 0;
        }
        if (inventoryItem && typeof rateToUse === 'number') {
          dailyRate += rentedEq.quantity * rateToUse;
        }
      }
      setExtensionCostPreview(dailyRate * billableDays);
    } else {
      setExtensionCostPreview(0);
    }
  }, [additionalDays, rental, inventory, chargeSaturday, chargeSunday]);

  const handleExtensionSubmit = async () => {
    if (additionalDays <= 0) {
      toast({ title: 'Erro', description: 'Número de dias adicionais deve ser positivo.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const updatedRental = await extendRentalAction(rental.id, additionalDays, chargeSaturday, chargeSunday);
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
      setAdditionalDays(1); 
      setExtensionCostPreview(0);
    }
  };
  
  const displayDate = (dateString: string) => {
    return format(parseISO(dateString), 'P', { locale: ptBR });
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); if (!open) { setAdditionalDays(1); setExtensionCostPreview(0); }}}>
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
              
              {extensionCostPreview > 0 && (
                  <div className="mt-2 mb-4 p-3 border rounded-md bg-muted/50">
                  <p className="text-sm text-foreground">
                      Custo adicional da prorrogação: <span className="font-bold">{formatToBRL(extensionCostPreview)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                      Um novo contrato será criado para esta extensão.
                  </p>
                  </div>
              )}

            </div>
            <DialogFooter>
            <DialogClose asChild>
                <Button variant="outline" disabled={isLoading}>Cancelar</Button>
            </DialogClose>
            <Button onClick={handleExtensionSubmit} disabled={isLoading || additionalDays <=0} className="bg-primary hover:bg-primary/90">
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
