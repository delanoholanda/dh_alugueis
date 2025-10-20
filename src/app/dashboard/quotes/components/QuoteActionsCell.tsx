
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Edit, Eye, FileText, Trash2, ArrowRightLeft, Loader2, AlertCircle } from 'lucide-react';
import type { Quote } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { deleteQuote, convertQuoteToRental } from '@/actions/quoteActions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatToBRL } from '@/lib/utils';

interface QuoteActionsCellProps {
  quote: Quote;
  onActionSuccess: () => Promise<void>;
}

export function QuoteActionsCell({ quote, onActionSuccess }: QuoteActionsCellProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteQuote(quote.id);
      toast({ title: 'Orçamento Excluído', description: `O orçamento ID ${quote.id} foi excluído.`, variant: 'success' });
      await onActionSuccess();
    } catch (error) {
      toast({ title: 'Erro ao Excluir', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConvert = async () => {
    setIsConverting(true);
    try {
      const newRental = await convertQuoteToRental(quote.id);
      toast({
        title: 'Orçamento Convertido!',
        description: `O aluguel ID ${newRental.id} foi criado com sucesso.`,
        variant: 'success'
      });
      await onActionSuccess();
    } catch (error) {
      toast({ title: 'Erro ao Converter', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsConverting(false);
    }
  };

  const isConverted = quote.status === 'converted';

  return (
    <div className="flex flex-wrap items-center justify-end gap-1 w-full">
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" title="Ver Detalhes do Orçamento">
            <Eye className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Orçamento ID: {String(quote.id).padStart(4, '0')}</DialogTitle>
            <DialogDescription>
              Orçamento para {quote.customerName} criado em {format(parseISO(quote.quoteDate), 'P', { locale: ptBR })}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Details content */}
            <div className="space-y-2">
                <p className="font-semibold">Período: <span className="font-normal">{format(parseISO(quote.rentalStartDate), 'P', { locale: ptBR })} por {quote.rentalDays} dias</span></p>
                <p className="font-semibold">Valor Total: <span className="font-normal">{formatToBRL(quote.value)}</span></p>
                {(quote.freightValue ?? 0) > 0 && <p className="font-semibold">Frete: <span className="font-normal">{formatToBRL(quote.freightValue)}</span></p>}
                <h4 className="font-semibold mt-2">Equipamentos:</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground pl-2">
                    {quote.equipment.map((eq, index) => <li key={index}>{eq.quantity}x {eq.name}</li>)}
                </ul>
                {quote.notes && <p className="font-semibold mt-2">Notas: <span className="font-normal whitespace-pre-wrap">{quote.notes}</span></p>}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button variant="ghost" size="icon" asChild title="Editar Orçamento" disabled={isConverted}>
        <Link href={`/dashboard/quotes/${quote.id}/edit`}>
          <Edit className="h-4 w-4" />
        </Link>
      </Button>

      <Button variant="ghost" size="icon" asChild title="Gerar Documento do Orçamento">
        <Link href={`/dashboard/quotes/${quote.id}/receipt`}>
          <FileText className="h-4 w-4 text-blue-500" />
        </Link>
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" title="Promover para Aluguel" disabled={isConverted || isConverting}>
            {isConverting ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <ArrowRightLeft className="h-4 w-4 text-primary" />}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promover Orçamento para Aluguel?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação criará um novo contrato de aluguel com os mesmos dados deste orçamento e marcará o orçamento como 'convertido'. A disponibilidade dos itens será verificada. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvert} className="bg-primary hover:bg-primary/90">Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" title="Excluir Orçamento" disabled={isDeleting}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O orçamento ID {quote.id} será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
