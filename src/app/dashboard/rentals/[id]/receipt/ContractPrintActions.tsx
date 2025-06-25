
'use client';

import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, FileDown, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import html2pdf from 'html2pdf.js';
import { useState } from 'react';

interface ContractPrintActionsProps {
  rentalId: string;
  customerName?: string;
}

export default function ContractPrintActions({ rentalId, customerName }: ContractPrintActionsProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const sanitizeFilenamePart = (name: string | undefined): string => {
    if (!name) return '';
    const firstName = name.split(' ')[0];
    return firstName
      .normalize("NFD") 
      .replace(/[\u0300-\u036f]/g, "") 
      .replace(/[^a-zA-Z0-9]/g, "") 
      .substring(0, 15); 
  };
  
  const generatePdf = async (outputType: 'save' | 'open') => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    const element = document.querySelector('.contract-container');
    if (!element) {
      console.error("Elemento .contract-container não encontrado.");
      setIsProcessing(false);
      return;
    }

    const actionsElement = element.querySelector('.no-print');
    if (actionsElement) (actionsElement as HTMLElement).style.display = 'none';

    const customerFirstNamePart = sanitizeFilenamePart(customerName);
    const pdfFilename = `Contrato_DH_Alugueis_${rentalId}${customerFirstNamePart ? `_${customerFirstNamePart}` : ''}.pdf`;

    const opt = {
      margin: [10, 12, 10, 12], 
      filename: pdfFilename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, dpi: 192, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };
    
    const worker = html2pdf().from(element).set(opt);

    try {
        if (outputType === 'save') {
            await worker.save();
        } else {
            await worker.outputPdf('dataurlnewwindow');
        }
    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
    } finally {
        if (actionsElement) (actionsElement as HTMLElement).style.display = 'flex';
        setIsProcessing(false);
    }
  };

  return (
    <div className="mb-6 flex flex-wrap justify-end gap-2 no-print">
      <Button variant="outline" onClick={() => router.back()} disabled={isProcessing}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>
      <Button onClick={() => generatePdf('save')} disabled={isProcessing}>
        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />} 
        Exportar para PDF
      </Button>
      <Button onClick={() => generatePdf('open')} disabled={isProcessing}>
        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />} 
        Imprimir Contrato
      </Button>
    </div>
  );
}
