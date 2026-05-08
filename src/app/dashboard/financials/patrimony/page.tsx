
import { PageHeader } from '@/components/layout/PageHeader';
import { getInventoryItems } from '@/actions/inventoryActions';
import { getPatrimonySummary } from '@/actions/purchaseActions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Building2, Package, TrendingUp, DollarSign, Wallet, Briefcase, ScrollText } from 'lucide-react';
import { formatToBRL } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

export default async function PatrimonyPage() {
  const [inventory, summary] = await Promise.all([
    getInventoryItems(),
    getPatrimonySummary(),
  ]);

  // Sort inventory by total invested value (quantity * acquisitionPrice)
  const sortedInventory = [...inventory]
    .map(item => ({
        ...item,
        totalValue: item.quantity * (item.unitAcquisitionPrice || 0)
    }))
    .sort((a, b) => b.totalValue - a.totalValue);

  return (
    <div className="container mx-auto py-2">
      <PageHeader 
        title="Patrimônio da Empresa" 
        icon={Building2}
        description="Analise o valor total investido em equipamentos de aluguel e ativos fixos da empresa."
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card className="shadow-lg bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center opacity-80"><Wallet className="mr-2 h-4 w-4"/> Valor Total do Patrimônio (Ativos)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatToBRL(summary.totalInvested)}</div>
            <p className="text-xs opacity-70 mt-1">Soma de todos os itens do inventário e ativos fixos.</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg">
          <CardHeader className="pb-2 text-muted-foreground">
            <CardTitle className="text-sm font-medium flex items-center"><Package className="mr-2 h-4 w-4 text-primary"/> Unidades em Estoque/Uso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.itemCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Total de peças, equipamentos e veículos registrados.</p>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="pb-2 text-muted-foreground">
            <CardTitle className="text-sm font-medium flex items-center"><TrendingUp className="mr-2 h-4 w-4 text-green-500"/> Maior Investimento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold truncate">{sortedInventory[0]?.name || 'N/A'}</div>
            <p className="text-sm font-semibold text-primary">{formatToBRL(sortedInventory[0]?.totalValue || 0)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Composição do Patrimônio</CardTitle>
          <CardDescription>Detalhamento por item. Ativos fixos (carros, etc) aparecem aqui mas não na locação.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipamento / Ativo</TableHead>
                  <TableHead>Tipo de Uso</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-right">Custo Unit.</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right w-[15%]">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedInventory.length > 0 ? (
                  sortedInventory.map((item) => {
                    const percentage = summary.totalInvested > 0 ? (item.totalValue / summary.totalInvested) * 100 : 0;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                            {item.forRental ? (
                                <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                                    <ScrollText className="h-3 w-3 mr-1" /> Locação
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                    <Briefcase className="h-3 w-3 mr-1" /> Ativo Fixo
                                </Badge>
                            )}
                        </TableCell>
                        <TableCell className="text-center">{item.quantity} un.</TableCell>
                        <TableCell className="text-right">{formatToBRL(item.unitAcquisitionPrice)}</TableCell>
                        <TableCell className="text-right font-bold">{formatToBRL(item.totalValue)}</TableCell>
                        <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                                <Progress value={percentage} className="h-2 w-12" />
                                <span className="text-[10px] font-mono">{percentage.toFixed(1)}%</span>
                            </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Nenhum equipamento no inventário.</TableCell></TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={4}>VALOR TOTAL DO ATIVO (EQUITY)</TableCell>
                    <TableCell className="text-right text-lg text-primary">{formatToBRL(summary.totalInvested)}</TableCell>
                    <TableCell className="text-right">100%</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
