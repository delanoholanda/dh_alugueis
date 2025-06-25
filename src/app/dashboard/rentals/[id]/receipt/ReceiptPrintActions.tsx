
'use client';

import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ContractPrintActions() {
  const router = useRouter();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="mb-6 flex justify-end gap-2 no-print">
      <Button variant="outline" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>
      <Button onClick={handlePrint}>
        <Printer className="mr-2 h-4 w-4" /> Imprimir Contrato
      </Button>
    </div>
  );
}
