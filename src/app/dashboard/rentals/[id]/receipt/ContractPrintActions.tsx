'use client';

import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, FileDown, Loader2, Image as ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
  
  const getWorkerOptions = (customerFirstNamePart: string) => {
    const element = document.querySelector('.contract-container');
    if (!element) {
      return null;
    }

    const pdfFilename = `Contrato_DH_Alugueis_${rentalId}${customerFirstNamePart ? `_${customerFirstNamePart}` : ''}.pdf`;

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
  };

  const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

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
            const pdfBlob = await worker.outputPdf('blob');
            const blobUrl = URL.createObjectURL(pdfBlob);
            window.open(blobUrl, '_blank');
            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
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
        
        // Convert to Blob for iOS compatibility
        const blob = dataURLtoBlob(imgData);
        if (blob) {
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `Contrato_DH_Alugueis_${rentalId}${customerFirstNamePart ? `_${customerFirstNamePart}` : ''}.png`;
            link.href = blobUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        }

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