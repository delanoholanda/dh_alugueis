
'use client';

import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, FileDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import html2pdf from 'html2pdf.js';

interface ContractPrintActionsProps {
  rentalId: string;
  customerName?: string;
}

export default function ContractPrintActions({ rentalId, customerName }: ContractPrintActionsProps) {
  const router = useRouter();

  const handlePrint = () => {
    console.log('Botão Imprimir Contrato clicado. Tentando chamar window.print()...');
    try {
      window.print();
      console.log('window.print() chamado com sucesso.');
    } catch (error) {
      console.error('Erro ao chamar window.print():', error);
    }
  };

  const sanitizeFilenamePart = (name: string | undefined): string => {
    if (!name) return '';
    const firstName = name.split(' ')[0];
    return firstName
      .normalize("NFD") 
      .replace(/[\u0300-\u036f]/g, "") 
      .replace(/[^a-zA-Z0-9]/g, "") 
      .substring(0, 15); 
  };

  const handleExportToPDF = () => {
    console.log('Botão Exportar para PDF clicado.');
    const element = document.querySelector('.contract-container');
    if (element) {
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
      
      const actionsElement = element.querySelector('.no-print');
      if (actionsElement) (actionsElement as HTMLElement).style.display = 'none';

      html2pdf()
        .from(element)
        .set(opt)
        .save()
        .then(() => {
          console.log('PDF exportado e salvo com sucesso.');
          if (actionsElement) (actionsElement as HTMLElement).style.display = 'flex'; 
        })
        .catch((err: any) => {
          console.error("Erro ao gerar PDF:", err);
          if (actionsElement) (actionsElement as HTMLElement).style.display = 'flex';
        });
    } else {
      console.error("Elemento .contract-container não encontrado para exportar para PDF.");
    }
  };

  return (
    <div className="mb-6 flex flex-wrap justify-end gap-2 no-print">
      <Button variant="outline" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>
      <Button onClick={handleExportToPDF}>
        <FileDown className="mr-2 h-4 w-4" /> Exportar para PDF
      </Button>
      <Button onClick={handlePrint}>
        <Printer className="mr-2 h-4 w-4" /> Imprimir Contrato
      </Button>
    </div>
  );
}
