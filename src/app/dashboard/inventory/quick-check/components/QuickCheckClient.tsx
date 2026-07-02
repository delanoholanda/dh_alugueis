
'use client';

import { useState, useMemo } from 'react';
import type { Equipment } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Share2, Copy, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface QuickCheckClientProps {
  inventory: Equipment[];
  rentedQuantities: Record<string, number>;
}

export default function QuickCheckClient({ inventory, rentedQuantities }: QuickCheckClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const filteredItems = useMemo(() => {
    return inventory
      .filter(item => item.forRental)
      .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory, searchTerm]);

  const copyStockReport = () => {
    const date = new Date().toLocaleDateString('pt-BR');
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    let report = `*📦 ESTOQUE DH ALUGUEIS - ${date} às ${time}*\n\n`;
    
    filteredItems.forEach(item => {
      const rented = rentedQuantities[item.id] || 0;
      const free = Math.max(0, item.quantity - rented);
      report += `• *${item.name}*: ${free} livres (de ${item.quantity})\n`;
    });

    report += `\n_Relatório gerado via Sistema DH v2_`;

    navigator.clipboard.writeText(report);
    toast({
      title: "Relatório Copiado!",
      description: "O resumo do estoque foi copiado. Agora você pode colar no WhatsApp ou Telegram.",
      variant: "success"
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar item..."
            className="pl-10 h-12 text-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button 
          onClick={copyStockReport} 
          className="h-12 px-6 bg-green-600 hover:bg-green-700 text-white"
        >
          <Share2 className="mr-2 h-5 w-5" />
          Copiar p/ WhatsApp
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {filteredItems.map(item => {
          const rented = rentedQuantities[item.id] || 0;
          const free = Math.max(0, item.quantity - rented);
          const isLow = free <= 0;

          return (
            <Card key={item.id} className={cn(
              "shadow-sm active:scale-[0.98] transition-transform",
              isLow ? "border-destructive/30" : "border-border"
            )}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-lg font-bold leading-tight">{item.name}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Livre no Pátio / Total</span>
                </div>
                <div className="text-right">
                  <div className={cn(
                    "text-3xl font-black font-mono",
                    free > 0 ? "text-primary" : "text-destructive"
                  )}>
                    {free} <span className="text-muted-foreground text-xl">/ {item.quantity}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredItems.length === 0 && (
          <p className="text-center py-10 text-muted-foreground italic">Nenhum item encontrado.</p>
        )}
      </div>
      
      <div className="pt-6 pb-10 text-center">
        <p className="text-xs text-muted-foreground">
          Dica: Use esta tela para conferir o estoque físico no pátio. <br/>
          Os números de "Livre" consideram apenas contratos ativos.
        </p>
      </div>
    </div>
  );
}
