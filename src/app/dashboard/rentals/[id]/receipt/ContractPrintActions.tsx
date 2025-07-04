
'use client';

import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, FileDown, Loader2, Image as ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import html2pdf from 'html2pdf.js';
import { useState } from 'react';

interface ContractPrintActionsProps {
  rentalId: string;
  customerName?: string;
}

export default function ContractPrintActions({ rentalId, customerName }: ContractPrintActionsProps) {
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
  
  const getWorkerAndOptions = () => {
    const element = document.querySelector('.contract-container');
    if (!element) {
      console.error("Elemento .contract-container não encontrado.");
      return { worker: null, actionsElement: null, customerFirstNamePart: null };
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
    return { worker, actionsElement, customerFirstNamePart };
  };

  const generatePdf = async (outputType: 'save' | 'open') => {
    if (processingType) return;
    setProcessingType('pdf');

    const { worker, actionsElement } = getWorkerAndOptions();

    if (!worker) {
        setProcessingType(null);
        return;
    }
    
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
        setProcessingType(null);
    }
  };

  const generateImage = async () => {
    if (processingType) return;
    setProcessingType('image');

    const { worker, actionsElement, customerFirstNamePart } = getWorkerAndOptions();
    
    if (!worker) {
        setProcessingType(null);
        return;
    }

    try {
        const imgData = await worker.outputImg('datauristring');
        const link = document.createElement('a');
        const filename = `Contrato_DH_Alugueis_${rentalId}${customerFirstNamePart ? `_${customerFirstNamePart}` : ''}.png`;
        link.download = filename;
        link.href = imgData;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error("Erro ao gerar imagem:", error);
    } finally {
        if (actionsElement) (actionsElement as HTMLElement).style.display = 'flex';
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
