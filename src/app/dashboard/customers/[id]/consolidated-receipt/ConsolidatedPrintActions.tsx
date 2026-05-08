'use client';

import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, FileDown, Loader2, Image as ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface ConsolidatedPrintActionsProps {
  customerId: string;
  customerName?: string;
}

export default function ConsolidatedPrintActions({ customerId, customerName }: ConsolidatedPrintActionsProps) {
  const router = useRouter();
  const [processingType, setProcessingType] = useState<'pdf' | 'image' | null>(null);

  const sanitizeFilenamePart = (name: string | undefined): string => {
    if (!name) return '';
    const firstName = name.split(' ')[0];
    return firstName
      .normalize("NFD") 
      .replace(/[\u0300-\u036f]/g, "") 
      .replace(/[^a-zA-Z0-9]/g, "") 
      .substring(0, 15); 
  };

  const getWorkerOptions = (customerFirstNamePart: string) => {
    const element = document.querySelector('.contract-container');
    if (!element) {
      return null;
    }

    const pdfFilename = `Contrato_Consolidado_DH_Alugueis_${customerFirstNamePart || customerId}.pdf`;

    return {
      element,
      options: {
        margin: [10, 12, 10, 12], 
        filename: pdfFilename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, dpi: 192, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      }
    };
  }
  
  const generatePdf = async (outputType: 'save' | 'open') => {
    if (processingType) return;
    
    const customerFirstNamePart = sanitizeFilenamePart(customerName);
    const setup = getWorkerOptions(customerFirstNamePart);
    if (!setup) return;

    setProcessingType('pdf');
    
    try {
        const html2pdf = (await import('html2pdf.js')).default;
        
        const actionsElement = setup.element.querySelector('.no-print');
        if (actionsElement) (actionsElement as HTMLElement).style.display = 'none';

        const worker = html2pdf().from(setup.element).set(setup.options);

        if (outputType === 'save') {
            await worker.save();
        } else {
            await worker.outputPdf('dataurlnewwindow');
        }

        if (actionsElement) (actionsElement as HTMLElement).style.display = 'flex';
    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
    } finally {
        setProcessingType(null);
    }
  };

  const generateImage = async () => {
    if (processingType) return;

    const customerFirstNamePart = sanitizeFilenamePart(customerName);
    const setup = getWorkerOptions(customerFirstNamePart);
    if (!setup) return;

    setProcessingType('image');

    try {
        const html2pdf = (await import('html2pdf.js')).default;
        
        const actionsElement = setup.element.querySelector('.no-print');
        if (actionsElement) (actionsElement as HTMLElement).style.display = 'none';

        const imgData = await html2pdf().from(setup.element).set(setup.options).outputImg('datauristring');
        
        const link = document.createElement('a');
        link.download = `Contrato_Consolidado_DH_Alugueis_${customerFirstNamePart || customerId}.png`;
        link.href = imgData;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (actionsElement) (actionsElement as HTMLElement).style.display = 'flex';
    } catch (error) {
        console.error("Erro ao gerar imagem:", error);
    } finally {
        setProcessingType(null);
    }
  };

  const isProcessing = !!processingType;

  return (
    <div className="mb-6 flex flex-wrap justify-end gap-2 no-print">
      <Button variant="outline" onClick={() => router.back()} disabled={isProcessing}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>
      <Button onClick={generateImage} disabled={isProcessing}>
        {processingType === 'image' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />} 
        Gerar Imagem
      </Button>
      <Button onClick={() => generatePdf('save')} disabled={isProcessing}>
        {processingType === 'pdf' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />} 
        Exportar PDF
      </Button>
      <Button onClick={() => generatePdf('open')} disabled={isProcessing}>
        {processingType === 'pdf' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />} 
        Imprimir
      </Button>
    </div>
  );
}