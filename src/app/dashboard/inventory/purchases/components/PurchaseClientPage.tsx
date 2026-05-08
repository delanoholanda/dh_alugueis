'use client';

import { useState, useMemo } from 'react';
import type { Purchase, Equipment } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { PurchaseForm } from './PurchaseForm';
import { createBulkPurchase, deleteBatchPurchase, getPurchases } from '@/actions/purchaseActions';
import { PlusCircle, Trash2, ShoppingCart, Package, Eye, FileText, Loader2, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatToBRL } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

interface GroupedPurchase {
    batchId: string;
    purchaseDate: string;
    notes?: string;
    affectsStock: boolean;
    totalAmount: number;
    totalFreight: number;
    itemCount: number;
    items: Purchase[];
}

interface PurchaseClientPageProps {
  initialPurchases: Purchase[];
  inventory: Equipment[];
}

export default function PurchaseClientPage({ initialPurchases, inventory }: PurchaseClientPageProps) {
  const [purchases, setPurchases] = useState<Purchase[]>(initialPurchases);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<GroupedPurchase | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const groupedPurchases = useMemo(() => {
      const groups: Record<string, GroupedPurchase> = {};

      purchases.forEach(p => {
          const bId = p.batchId || p.id;
          if (!groups[bId]) {
              groups[bId] = {
                  batchId: bId,
                  purchaseDate: p.purchaseDate,
                  notes: p.notes,
                  affectsStock: p.affectsStock === true,
                  totalAmount: 0,
                  totalFreight: 0,
                  itemCount: 0,
                  items: []
              };
          }
          groups[bId].totalAmount += p.totalAmount;
          groups[bId].totalFreight += p.freightValue || 0;
          groups[bId].itemCount += 1;
          groups[bId].items.push(p);
      });

      return Object.values(groups).sort((a, b) => parseISO(b.purchaseDate).getTime() - parseISO(a.purchaseDate).getTime());
  }, [purchases]);

  const handleFormSubmit = async (data: any) => {
    try {
      const submitData = {
          ...data,
          purchaseDate: format(data.purchaseDate, 'yyyy-MM-dd')
      };
      
      const result = await createBulkPurchase(submitData);
      
      if (result.success) {
          toast({ 
            title: 'Entrada Registrada', 
            description: `${result.count} item(ns) foram processados com sucesso.`, 
            variant: 'success' 
          });
          const updatedPurchases = await getPurchases();
          setPurchases(updatedPurchases);
          setIsFormOpen(false);
      }
    } catch (error) {
      toast({ title: 'Erro', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    setIsDeleting(true);
    try {
      const result = await deleteBatchPurchase(batchId);
      if (result.success) {
        toast({ title: 'Compra Excluída', description: 'O lote de compra foi removido e o sistema realizou o estorno do estoque e preço.', variant: 'success' });
        // Re-fetch everything to be safe
        const updatedPurchases = await getPurchases();
        setPurchases(updatedPurchases);
      }
    } catch (error) {
      toast({ title: 'Erro', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex justify-end mb-6">
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Registrar Nova Compra
            </Button>
          </DialogTrigger>
          {isFormOpen && (
            <PurchaseForm
              inventory={inventory}
              onSubmitAction={handleFormSubmit}
              onClose={() => setIsFormOpen(false)}
            />
          )}
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><ShoppingCart className="mr-2 h-5 w-5 text-primary" /> Histórico de Compras Agrupadas</CardTitle>
          <CardDescription>Visualize suas notas fiscais de entrada. O sistema gerencia automaticamente o rollback de estoque e preços em caso de exclusão.</CardDescription>
        </CardHeader>
        <CardContent>
          {groupedPurchases.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição / Notas</TableHead>
                    <TableHead className="text-center">Itens</TableHead>
                    <TableHead className="text-right">Frete Total</TableHead>
                    <TableHead className="text-right">Total da Nota</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedPurchases.map((group) => (
                    <TableRow key={group.batchId} className="hover:bg-muted/50 cursor-default">
                      <TableCell className="whitespace-nowrap font-medium">{format(parseISO(group.purchaseDate), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell className="max-w-[250px] truncate">
                        {group.notes || <span className="text-muted-foreground italic">Sem observações</span>}
                      </TableCell>
                      <TableCell className="text-center">
                          <Badge variant="secondary">{group.itemCount} un.</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{formatToBRL(group.totalFreight)}</TableCell>
                      <TableCell className="text-right font-bold text-primary font-mono">{formatToBRL(group.totalAmount)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setSelectedBatch(group)} title="Ver Detalhes">
                                <Eye className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" title="Excluir Lote" disabled={isDeleting}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir esta compra inteira?</AlertDialogTitle>
                                        <AlertDialogDescription asChild>
                                            <div className="space-y-2">
                                                <p>Esta ação realizará um rollback completo no sistema:</p>
                                                <ul className="list-disc list-inside text-xs space-y-1 ml-2">
                                                    <li>As quantidades serão removidas do estoque atual.</li>
                                                    <li>O preço de aquisição dos itens será restaurado para o valor anterior à esta compra.</li>
                                                    <li>O patrimônio da empresa será recalculado.</li>
                                                </ul>
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteBatch(group.batchId)} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirmar Estorno'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <ShoppingCart className="mx-auto h-12 w-12 opacity-20 mb-4" />
              <p>Nenhuma compra registrada ainda.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedBatch} onOpenChange={(open) => !open && setSelectedBatch(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" /> Detalhes da Compra - {selectedBatch ? format(parseISO(selectedBatch.purchaseDate), 'dd/MM/yyyy') : ''}
                  </DialogTitle>
              </DialogHeader>
              
              {selectedBatch && (
                  <div className="space-y-6 py-4">
                      <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border">
                          <div>
                              <p className="text-xs text-muted-foreground uppercase font-bold">Observações</p>
                              <p className="text-sm">{selectedBatch.notes || 'N/A'}</p>
                          </div>
                          <div className="text-right">
                              <p className="text-xs text-muted-foreground uppercase font-bold">Tipo de Registro</p>
                              <Badge variant={selectedBatch.affectsStock ? "default" : "secondary"}>
                                  {selectedBatch.affectsStock ? 'Atualizou Estoque' : 'Apenas Histórico'}
                              </Badge>
                          </div>
                      </div>

                      <div>
                          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                              <Package className="h-4 w-4" /> Itens na Nota
                          </h4>
                          <div className="border rounded-md">
                              <Table>
                                  <TableHeader>
                                      <TableRow className="bg-muted/50">
                                          <TableHead>Equipamento</TableHead>
                                          <TableHead className="text-center">Qtd</TableHead>
                                          <TableHead className="text-right">Unitário</TableHead>
                                          <TableHead className="text-right">Frete Prop.</TableHead>
                                          <TableHead className="text-right">Total Linha</TableHead>
                                      </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                      {selectedBatch.items.map((item) => (
                                          <TableRow key={item.id}>
                                              <TableCell className="font-medium text-xs">{item.inventoryName}</TableCell>
                                              <TableCell className="text-center text-xs">{item.quantity}</TableCell>
                                              <TableCell className="text-right text-xs">{formatToBRL(item.unitPrice)}</TableCell>
                                              <TableCell className="text-right text-xs text-muted-foreground">{formatToBRL(item.freightValue)}</TableCell>
                                              <TableCell className="text-right text-xs font-bold">{formatToBRL(item.totalAmount)}</TableCell>
                                          </TableRow>
                                      ))}
                                  </TableBody>
                              </Table>
                          </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 pt-2 border-t">
                          <div className="flex justify-between w-full max-w-[250px] text-xs">
                              <span className="text-muted-foreground">Soma dos Itens:</span>
                              <span>{formatToBRL(selectedBatch.totalAmount - selectedBatch.totalFreight)}</span>
                          </div>
                          <div className="flex justify-between w-full max-w-[250px] text-xs">
                              <span className="text-muted-foreground flex items-center"><Truck className="h-3 w-3 mr-1" /> Frete Total:</span>
                              <span>{formatToBRL(selectedBatch.totalFreight)}</span>
                          </div>
                          <div className="flex justify-between w-full max-w-[250px] text-lg font-bold border-t mt-1 pt-1">
                              <span>Total Geral:</span>
                              <span className="text-primary">{formatToBRL(selectedBatch.totalAmount)}</span>
                          </div>
                      </div>
                  </div>
              )}
              
              <DialogFooter>
                  <DialogClose asChild>
                      <Button variant="outline">Fechar</Button>
                  </DialogClose>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
}