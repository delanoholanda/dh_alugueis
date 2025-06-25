
'use client';

import React, { useState, useEffect as useReactEffect, use } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import { getRentalById } from '@/actions/rentalActions';
import { getInventoryItemById } from '@/actions/inventoryActions';
import { getCustomerById } from '@/actions/customerActions';
import { getCompanySettings } from '@/actions/settingsActions';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatToBRL } from '@/lib/utils';
import type { Rental, Equipment as InventoryItem, PaymentMethod, CompanyDetails, Customer } from '@/types';
import ContractPrintActions from './ContractPrintActions';
import { Button } from '@/components/ui/button';
import { QRCodeCanvas } from 'qrcode.react';
import { generatePixPayload } from '@/lib/pix';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, AlertCircle } from 'lucide-react';

const DEFAULT_COMPANY_LOGO = '/dh-alugueis-logo.png';

const paymentMethodMap: Record<PaymentMethod, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  nao_definido: 'Não Definido',
};

interface DetailedEquipmentItem extends InventoryItem {
    name: string;
    quantity: number;
    equipmentId: string;
    dailyRentalRateUsed: number;
    lineTotal: number;
    customDailyRentalRate?: number;
}

function numberToWords(num: number): string {
  const a = ['','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','catorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
  const b = ['', '', 'vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
  const c = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];

  if (num === 0) return 'Zero reais';
  if (isNaN(num) || !isFinite(num)) return 'Valor inválido';

  let nStr = Math.floor(Math.abs(num)).toString();
  if (nStr.length > 9) return 'Valor muito alto para converter em extenso';

  nStr = ('000000000' + nStr).slice(-9);
  const nMatch = nStr.match(/^(\d{3})(\d{3})(\d{3})$/);
  let str = '';

  const processBlock = (block: string): string => {
    let blockStr = '';
    const numBlock = Number(block);
    if (numBlock === 0) return '';

    const centenas = Number(block[0]);
    const dezenasUnidadesStr = block.substring(1);
    const numDezenasUnidades = Number(dezenasUnidadesStr);

    if (centenas > 0) {
      blockStr += (numBlock === 100 ? 'cem' : c[centenas]);
      if (numDezenasUnidades > 0) blockStr += ' e ';
    }

    if (numDezenasUnidades > 0) {
      if (numDezenasUnidades < 20) {
        blockStr += a[numDezenasUnidades];
      } else {
        blockStr += b[Number(dezenasUnidadesStr[0])];
        if (Number(dezenasUnidadesStr[1]) > 0) {
          blockStr += ' e ' + a[Number(dezenasUnidadesStr[1])];
        }
      }
    }
    return blockStr;
  };

  const appendWithConnector = (currentStr: string, blockValue: number, blockText: string, nextBlockHasValue: boolean): string => {
    if (!blockText) return currentStr;
    if (currentStr.length === 0) return blockText;
    const endsWithQualifier = currentStr.endsWith('milhão') || currentStr.endsWith('milhões') || currentStr.endsWith('mil');
    if (nextBlockHasValue) {
        if (endsWithQualifier && (blockText.startsWith("e ") || !blockText.includes(" "))) {
             return currentStr + ' ' + blockText;
        }
        if (currentStr.endsWith(" e") && blockText.startsWith("e ")) {
           return currentStr.slice(0, -2) + blockText;
        }
        if (blockText.includes(" e ") || blockValue < 100 && !endsWithQualifier) {
            return currentStr + ', ' + blockText;
        }
        return currentStr + ' e ' + blockText;
    } else {
        if (endsWithQualifier && !blockText.startsWith("e ")) {
            return currentStr + ' ' + blockText;
        }
        return currentStr + ' e ' + blockText;
    }
  };

  if (nMatch) {
    const milhoesBlockStr = nMatch[1];
    const milharesBlockStr = nMatch[2];
    const unidadesBlockStr = nMatch[3];

    const numMilhoes = Number(milhoesBlockStr);
    const numMilhares = Number(milharesBlockStr);
    const numUnidades = Number(unidadesBlockStr);

    if (numMilhoes > 0) {
      let milhoesText = processBlock(milhoesBlockStr);
      milhoesText = (numMilhoes === 1 ? 'um milhão' : milhoesText + ' milhões');
      str = milhoesText;
    }

    if (numMilhares > 0) {
      let milharesText = processBlock(milharesBlockStr);
      if (milharesText) {
        milharesText = (numMilhares === 1 && !milharesText.startsWith("um") ? 'mil' : milharesText + ' mil');
        str = appendWithConnector(str, numMilhares, milharesText, numUnidades > 0);
      }
    }

    if (numUnidades > 0) {
      const unidadesText = processBlock(unidadesBlockStr);
      if (unidadesText) {
         str = appendWithConnector(str, numUnidades, unidadesText, false);
      }
    }
  }

  str = str.replace(/,\\s*$/, '').replace(/\\s+e\\s*$/, '').trim();
  if (str) str = str.charAt(0).toUpperCase() + str.slice(1);

  const centavos = Math.round((Math.abs(num) % 1) * 100);
  const numInteiro = Math.floor(Math.abs(num));

  if (str && (numInteiro !== 0 || (numInteiro === 0 && centavos === 0 && num === 0))) {
    str += (numInteiro === 1 && str === "Um" ? ' real' : ' reais');
  }

  if (centavos > 0) {
    let centavosText = processBlock(('000'+centavos).slice(-3));
    if (centavosText) {
       str += (str && numInteiro > 0 ? ' e ' : (numInteiro === 0 ? '' : ' e ')) + centavosText + (centavos === 1 ? ' centavo' : ' centavos');
    }
  } else if (!str && num === 0) {
    return 'Zero reais';
  }

  return str.trim() || 'Zero reais';
}


function extractCityFromAddress(address?: string): string {
  if (!address) return 'CIDADE';
  const parts = address.split(',');
  let cityCandidate = '';
  if (parts.length >= 2) {
    cityCandidate = parts.length > 2 ? parts[parts.length - 2] : parts[parts.length - 1];
  } else {
    cityCandidate = address;
  }
  return cityCandidate.trim().toUpperCase().substring(0,15);
}

const formatCpfForDisplay = (cpf: string | null | undefined): string => {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `CPF: ${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

export default function RentalContractPage() {
  const routeParams = useParams();
  const router = useRouter();
  const idStr = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;
  const rentalIdNum = parseInt(idStr || '', 10);

  const [rental, setRental] = useState<Rental | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [detailedEquipment, setDetailedEquipment] = useState<DetailedEquipmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentCompanyDetails, setCurrentCompanyDetails] = useState<CompanyDetails | null>(null);
  const [pixPayload, setPixPayload] = useState<string | null>(null);

  const formatPixKeyForDisplay = (pixKey: string): string => {
    if (!pixKey) return '';
    let digits = pixKey.replace(/\D/g, "");
    
    // If it starts with 55 (brazilian country code), remove it for formatting
    if (digits.startsWith('55') && digits.length === 13) {
      digits = digits.substring(2);
    }

    if (digits.length === 11) { // Standard mobile with 9
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    }
    
    if (digits.length === 10) { // Older mobile or landline
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
    }
    
    return pixKey; // Return original if not a recognized phone format
  };

  useReactEffect(() => {
    let isMounted = true;
    
    const loadReceiptData = async () => {
      if (!isMounted) return;
      if (isNaN(rentalIdNum)) {
        setError('ID do contrato inválido.');
        setIsLoading(false);
        notFound();
        return;
      }

      setIsLoading(true);
      setError(null);
      
      try {
        const [fetchedRental, companySettings] = await Promise.all([
          getRentalById(rentalIdNum),
          getCompanySettings()
        ]);
        
        if (!isMounted) return;
        setCurrentCompanyDetails(companySettings);

        if (!fetchedRental) {
          setError('Contrato não encontrado ou erro ao buscar.');
          setIsLoading(false);
          notFound();
          return;
        }
        setRental(fetchedRental);
        
        let fetchedCustomer: Customer | undefined | null = null;
        if (fetchedRental.customerId) {
          fetchedCustomer = await getCustomerById(fetchedRental.customerId);
          if (isMounted) setCustomer(fetchedCustomer || null);
        }

        const equipmentDetailsPromises = fetchedRental.equipment.map(async (eq) => {
          const inventoryItem = await getInventoryItemById(eq.equipmentId);
          const dailyRateToUse = eq.customDailyRentalRate ?? inventoryItem?.dailyRentalRate ?? 0;
          const itemSubtotal = dailyRateToUse * (fetchedRental.isOpenEnded ? 1 : (fetchedRental.rentalDays || 0)) * eq.quantity;
          return {
            ...inventoryItem,
            id: eq.equipmentId,
            name: eq.name || inventoryItem?.name || 'Equipamento Desconhecido',
            quantity: eq.quantity,
            equipmentId: eq.equipmentId,
            customDailyRentalRate: eq.customDailyRentalRate,
            dailyRentalRateUsed: dailyRateToUse,
            lineTotal: itemSubtotal,
          } as DetailedEquipmentItem;
        });

        const resolvedEquipmentDetails = await Promise.all(equipmentDetailsPromises);
        if (isMounted) setDetailedEquipment(resolvedEquipmentDetails);
        
        const pixAmount = fetchedRental.isOpenEnded ? 0 : fetchedRental.value;
        if (fetchedRental.paymentMethod === 'pix' && companySettings.pixKey && pixAmount > 0) {
          const city = extractCityFromAddress(companySettings.address);
          const txidForPix = `DHALUGUEIS${fetchedRental.id.toString().padStart(6, '0')}`;
          const descriptionForPix = `Aluguel ${companySettings.companyName || 'Empresa'} - ID ${fetchedRental.id}`;

          const payload = generatePixPayload({
            pixKey: companySettings.pixKey,
            merchantName: companySettings.companyName || 'Nome Empresa',
            merchantCity: city,
            amount: pixAmount,
            txid: txidForPix,
            description: descriptionForPix,
          });
          if (isMounted) setPixPayload(payload);
        } else {
          if(isMounted) setPixPayload(null);
        }

      } catch (err) {
        if (isMounted) {
          console.error("Error fetching rental data:", err);
          const errorMessage = (err instanceof Error) ? err.message : "Erro desconhecido.";
          setError(`Falha ao carregar dados do contrato: ${errorMessage}.`);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    loadReceiptData();

    return () => { isMounted = false; };
  }, [idStr, rentalIdNum, router]);

  if (isLoading || !currentCompanyDetails) {
    return (
      <div className="bg-gray-100 min-h-screen py-8 px-4 print:bg-white print:py-0 print:px-0">
        <div className="contract-container max-w-3xl mx-auto bg-white p-8 shadow-lg print:shadow-none print:border-none font-['Arial',_sans-serif] text-xs text-gray-800 print:p-0">
          <div className="flex justify-end mb-6 no-print">
            <Skeleton className="h-10 w-24 mr-2" />
            <Skeleton className="h-10 w-32 mr-2" />
            <Skeleton className="h-10 w-36" />
          </div>
          <header className="flex justify-between items-start mb-6 print:mb-4">
            <Skeleton className="w-40 h-20" />
            <div className="text-right w-1/2">
              <Skeleton className="h-6 w-3/4 mb-1 ml-auto" />
              <Skeleton className="h-4 w-full mb-0.5 ml-auto" />
              <Skeleton className="h-4 w-full mb-0.5 ml-auto" />
              <Skeleton className="h-4 w-full mb-0.5 ml-auto" />
              <Skeleton className="h-4 w-full ml-auto" />
            </div>
          </header>
          <hr className="print:border-gray-400" />
          <section className="my-6 print:my-4 flex justify-between items-start">
            <div className="w-1/2">
              <Skeleton className="h-5 w-1/4 mb-1" />
              <Skeleton className="h-4 w-3/4 mb-0.5" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="text-xs text-right w-1/2">
              <Skeleton className="h-4 w-3/5 mb-0.5 ml-auto" />
              <Skeleton className="h-4 w-1/2 mb-0.5 ml-auto" />
              <Skeleton className="h-4 w-3/4 mb-0.5 ml-auto" />
              <Skeleton className="h-4 w-2/3 mb-0.5 ml-auto" />
            </div>
          </section>
          <section className="mb-6 print:mb-4">
            <Skeleton className="h-5 w-1/3 mb-2" />
            <div className="space-y-2">
              {[1,2].map(i => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          </section>
          <div className="grid grid-cols-2 gap-8 mb-6 print:mb-4">
            <div>
              <Skeleton className="h-5 w-1/2 mb-2" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-5 w-3/4 mt-4 mb-2" />
              <Skeleton className="h-20 w-full" />
            </div>
            <div>
              <Skeleton className="h-8 w-full mb-2" />
              <Skeleton className="h-8 w-full mb-2" />
              <Skeleton className="h-10 w-full font-bold" />
            </div>
          </div>
           <footer className="text-center text-xs text-gray-500 mt-8 pt-4 border-t print:mt-4 print:pt-2 print:border-gray-400">
            <Skeleton className="h-4 w-3/4 mx-auto mb-1"/>
            <Skeleton className="h-4 w-1/2 mx-auto"/>
        </footer>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="flex flex-col items-center justify-center h-screen text-destructive p-4 text-center"><p className="text-lg mb-2">Erro ao Carregar Contrato</p><p>{error}</p><Button onClick={() => router.back()} className="mt-6">Voltar</Button></div>;
  }

  if (!rental) {
    return <div className="flex items-center justify-center h-screen text-foreground">Contrato não encontrado. Redirecionando...</div>;
  }

  const itemsSubtotal = detailedEquipment.reduce((sum, eq) => sum + eq.lineTotal, 0);
  const contractGeneratedAt = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const valorPorExtenso = numberToWords(rental.value);
  const displayContractLogo = currentCompanyDetails.contractLogoUrl || currentCompanyDetails.companyLogoUrl || DEFAULT_COMPANY_LOGO;
  const contractTitle = "Contrato de Aluguel";
  const rentalPeriod = rental.isOpenEnded
    ? `${format(parseISO(rental.rentalStartDate), "dd/MM/yyyy", { locale: ptBR })} - Em Aberto`
    : `${format(parseISO(rental.rentalStartDate), "dd/MM/yyyy", { locale: ptBR })} - ${format(parseISO(rental.expectedReturnDate), "dd/MM/yyyy", { locale: ptBR })}`;
  const formattedPixKey = formatPixKeyForDisplay(currentCompanyDetails.pixKey);


  return (
    <div className="bg-gray-100 min-h-screen py-8 px-4 print:bg-white print:py-0 print:px-0">
      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .contract-container {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 8mm 10mm !important; 
            max-width: 100% !important;
            width: calc(210mm - 20mm) !important; 
          }
          .contract-container p,
          .contract-container li,
          .contract-container div:not(.signature-area):not(.signature-container),
          .contract-container span,
          .contract-container h1,
          .contract-container h2,
          .contract-container h3,
          .contract-container th,
          .contract-container td {
            line-height: 0.8 !important; 
            font-size: 6pt !important;
            margin-top: 0.01mm !important;
            margin-bottom: 0.01mm !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
          }
           .contract-header .logo-container {
             width: 20mm !important;
             height: 8mm !important;
             margin-bottom: 0mm !important;
          }
          .contract-header .logo-container .logo {
            max-width: 100% !important;
            max-height: 100% !important;
            width: auto !important;
            height: auto !important;
            object-fit: contain !important;
          }
          .contract-header {
            margin-bottom: 0.01mm !important; 
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
          }
          .contract-header .company-info {
            font-size: 5.5pt !important;
            text-align: right !important;
            line-height: 0.8 !important; 
          }
          .contract-header .company-info h1 {
            font-size: 7.5pt !important;
            margin-bottom: 0.01mm !important; 
            line-height: 0.8 !important;
          }
          .contract-header .company-info p {
            font-size: 5.5pt !important;
            line-height: 0.8 !important;
            margin-bottom: 0mm !important;
          }
           .contract-section {
            margin-bottom: 0.01mm !important; 
          }
          .contract-section.flex.justify-between.items-start {
             margin-bottom: 0.01mm !important; 
          }
           .contract-section > h2.font-semibold, .contract-section > h3.font-semibold {
              font-size: 6.5pt !important;
              margin-bottom: 0.01mm !important; 
              margin-top: 0.01mm !important;
              line-height: 0.8 !important;
          }
          hr {
            margin: 0.01mm 0 !important; 
            border-top-width: 0.1px !important;
          }
          .contract-table {
            width: 100% !important;
            margin-bottom: 0.01mm !important; 
          }
          .contract-table th, .contract-table td {
            border: 0.1px solid #ccc !important;
            padding: 0.01mm 0.05mm !important; 
            font-size: 4.5pt !important;
            line-height: 0.8 !important; 
          }
          .contract-table th {
            background-color: #fdfdfd !important;
          }
          .contract-summary-grid {
            font-size: 5pt !important;
            gap: 0rem 0.01rem !important; 
            margin-bottom: 0.01mm !important; 
          }
          .total-line {
            font-size: 6pt !important;
            line-height: 0.8 !important;
          }
          .pix-section {
              margin-top: 0.01mm !important; 
              text-align: center !important;
          }
          .pix-section h3 {
              font-size: 5.5pt !important;
              margin-bottom: 0.01mm !important;
              line-height: 0.8 !important;
          }
          .pix-section canvas {
            width: 12mm !important;
            height: 12mm !important;
            margin: 0.01mm auto !important;
            border: 0.1px solid #ccc !important;
            padding: 0.05mm !important;
          }
          .pix-key-text {
            font-size: 5pt !important;
            word-break: break-all !important;
            line-height: 0.8 !important;
          }
          .terms-conditions {
            font-size: 3.5pt !important;
            line-height: 0.8 !important; 
            white-space: pre-wrap !important;
            margin-top: 0.1mm !important;
            margin-bottom: 0.1mm !important; 
          }
          .contract-section p.valor-extenso-class {
            font-size: 4.5pt !important;
            line-height: 0.8 !important;
            margin-top: 0.1mm !important; 
            margin-bottom: 0.2mm !important; 
          }
          
           .contract-section.signature-container {
            margin-top: 0.5mm !important;
            margin-bottom: 0.3mm !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
          }
          .signature-area {
            text-align: center;
            margin-top: 0.3mm !important;
            margin-bottom: 0.01mm !important;
          }
          .signature-area:first-child {
            margin-bottom: 0.5mm !important;
          }
          .signature-line {
             display: block;
             margin: 0 auto 0.01mm auto;
             width: 30mm !important;
             border-bottom: 0.1px solid #333 !important;
             padding-bottom: 0.8mm !important; 
          }
           .signature-area p.font-semibold.text-xs,
           .signature-area p.text-xs {
            font-size: 4.5pt !important;
            line-height: 0.8 !important;
            margin-bottom: 0mm !important;
          }
          footer.text-center.text-xs {
            font-size: 4.5pt !important;
            margin-top: 0.01mm !important; 
            padding-top: 0.01mm !important; 
            border-top: 0.1px solid #ccc !important;
            line-height: 0.8 !important;      
          }
        }
        .contract-container { max-width: 750px; margin: 0 auto; background-color: white; padding: 2rem; box-shadow: 0 0 10px rgba(0,0,0,0.1); font-family: Arial, sans-serif; font-size: 11px; color: #333; border: 1px solid #eee; overflow-x: auto; }
        .contract-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
        .contract-header .logo-container { width: 200px; height: 100px; display: flex; align-items: center; justify-content: flex-start;}
        .contract-header .logo { max-width: 100%; height: 100%; object-fit: contain; }
        .contract-header .company-info { text-align: right; font-size: 10px; }
        .contract-header .company-info h1 { font-size: 14px; margin-bottom: 2px;}
        .contract-section { margin-bottom: 1rem; } 
        .contract-table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
        .contract-table th, .contract-table td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
        .contract-table th { background-color: #f8f8f8; font-size: 10px; }
        .contract-table .text-right { text-align: right; }
        .contract-summary-grid { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem 1rem; }
        .total-line { font-weight: bold; font-size: 12px; }
        hr { border: 0; border-top: 1px solid #eee; margin: 1rem 0;}
        .pix-section { text-align: center; margin-top: 1rem; }
        .pix-section canvas { margin: 0.5rem auto; border: 1px solid #eee; padding: 5px; background: white; }
        .pix-key-text { font-size: 9px; word-break: break-all; }
        .terms-conditions { white-space: pre-wrap; font-size: 8px; line-height: 1.3; margin-bottom: 0.5rem; }
        .contract-section p.valor-extenso-class { margin-top: 0.5rem; margin-bottom: 1rem; }
        .contract-section.signature-container {
          margin-top: 2rem !important;     
          margin-bottom: 1.5rem !important;  
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
        }
        .signature-area {
          text-align: center;
          margin-top: 1.5rem !important;     
          margin-bottom: 0.5rem !important;
        }
        .signature-area:first-child {
           margin-bottom: 1.5rem !important; 
        }
        .signature-line {
          display: block;
          margin: 0 auto 0.25rem auto;
          width: 280px;
          border-bottom: 1px solid #333;
          padding-bottom: 25px !important; 
        }
        footer.text-center.text-xs {
            font-size: 10px !important;
            margin-top: 1.5rem !important;
            padding-top: 0.75rem !important;
        }
      `}</style>

      <div className="contract-container">
        <ContractPrintActions rentalId={rental.id.toString()} customerName={customer?.name} />

        <header className="contract-header">
          <div className="logo-container">
            {displayContractLogo && <Image src={displayContractLogo} alt={`${currentCompanyDetails.companyName} Logo`} width={200} height={100} className="logo" data-ai-hint="company logo" key={displayContractLogo}/>}
          </div>
          <div className="company-info">
            <h1 className="font-bold">{contractTitle}</h1>
            <p className="font-semibold">{currentCompanyDetails.companyName}</p>
            <p>Responsável: {currentCompanyDetails.responsibleName}</p>
            <p>Telefone: {currentCompanyDetails.phone}</p>
            <p>Endereço: {currentCompanyDetails.address}</p>
            <p>Email: {currentCompanyDetails.email}</p>
            {currentCompanyDetails.pixKey && <p>PIX: {currentCompanyDetails.pixKey}</p>}
          </div>
        </header>

        <hr />

        <section className="contract-section flex justify-between items-start">
          <div>
            <h2 className="font-semibold text-sm mb-1">Cliente:</h2>
            <p>{rental.customerName || 'Cliente não especificado'}</p>
            {customer && customer.phone && <p>Telefone: {customer.phone}</p>}
            {customer && customer.cpf && <p>{formatCpfForDisplay(customer.cpf)}</p>}
            {customer && customer.address && <p>Endereço (Cliente): {customer.address}</p>}
            {rental.deliveryAddress && (
              <p className="flex items-start">
                <MapPin className="h-3 w-3 mr-1 mt-0.5 text-muted-foreground flex-shrink-0" />
                <span className="font-semibold">Entrega em:</span>&nbsp;
                <span className="whitespace-pre-wrap">{rental.deliveryAddress}</span>
              </p>
            )}
          </div>
          <div className="text-xs text-right">
            <p><strong>Nº do documento:</strong> {rental.id.toString().padStart(4,'0')}</p>
            <p><strong>Período do Aluguel:</strong> {rentalPeriod}</p>
            <p>Data de Emissão: {contractGeneratedAt}</p>
            <p>Status: <span className="font-semibold">{paymentMethodMap[rental.paymentMethod || 'nao_definido']} - {rental.paymentStatus === 'paid' ? 'Pago' : rental.paymentStatus === 'pending' ? 'Pendente' : 'Atrasado'}</span></p>
          </div>
        </section>

        <section className="contract-section">
          <h3 className="font-semibold text-sm mb-2">Itens / Serviços:</h3>
          <table className="contract-table">
            <thead>
              <tr>
                <th>Item / Serviço</th>
                <th className="text-right">Qtd</th>
                <th className="text-right">Preço Unit. (Diária)</th>
                <th className="text-right">Qtd. Dias</th>
                <th className="text-right">Preço Diário (Total Item)</th>
                <th className="text-right">Valor Total (Item)</th>
              </tr>
            </thead>
            <tbody>
              {detailedEquipment.map((eq, index) => (
                <tr key={index}>
                  <td>{eq.name}</td>
                  <td className="text-right">{eq.quantity}</td>
                  <td className="text-right">{formatToBRL(eq.dailyRentalRateUsed)}</td>
                  <td className="text-right">{rental.isOpenEnded ? 'N/A' : rental.rentalDays}</td>
                  <td className="text-right">{formatToBRL(eq.quantity * eq.dailyRentalRateUsed)}</td>
                  <td className="text-right">{rental.isOpenEnded ? '-' : formatToBRL(eq.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="contract-summary-grid contract-section">
          <div> {/* Coluna da esquerda */}
            <h3 className="font-semibold text-sm mb-2">Observações:</h3>
            <p className="text-xs whitespace-pre-wrap">{rental.notes || 'Nenhuma observação.'}</p>
            
            <div className="mt-4">
                <h3 className="font-semibold text-sm mb-1">Regras de Cobrança:</h3>
                <ul className="text-xs list-disc list-inside">
                    {rental.isOpenEnded && (
                        <li>Será cobrado {formatToBRL(rental.value)} por dia de aluguel.</li>
                    )}
                    <li>Cobrança para Sábados: <span className="font-semibold">{rental.chargeSaturdays ? 'SIM' : 'NÃO'}</span></li>
                    <li>Cobrança para Domingos: <span className="font-semibold">{rental.chargeSundays ? 'SIM' : 'NÃO'}</span></li>
                </ul>
            </div>

            <h3 className="font-semibold text-sm mb-2 mt-4">Termos e Condições:</h3>
            <p className="terms-conditions">
              {currentCompanyDetails.contractTermsAndConditions || ''}
            </p>
             <p className="text-xs mt-4 valor-extenso-class">
              Valor por extenso: {valorPorExtenso || 'Não especificado'}. {rental.isOpenEnded && <span className="font-semibold">(Valor referente à diária)</span>}
            </p>
            <section className="contract-section signature-container">
                <div className="signature-area">
                    <p className="signature-line"></p>
                    <p className="font-semibold text-xs">{currentCompanyDetails.responsibleName}</p>
                    <p className="text-xs">{currentCompanyDetails.companyName} (Locador)</p>
                </div>
                <div className="signature-area">
                    <p className="signature-line"></p>
                    <p className="font-semibold text-xs">{customer?.name || rental.customerName || 'Cliente'}</p>
                    <p className="text-xs">(Locatário)</p>
                </div>
            </section>
          </div>

          <div> {/* Coluna da direita */}
            <table className="contract-table w-auto ml-auto"><tbody>
                  <tr>
                    <td>{rental.isOpenEnded ? 'Soma das Diárias:' : 'Soma dos itens/serviços:'}</td>
                    <td className="text-right">{formatToBRL(rental.isOpenEnded ? rental.value : itemsSubtotal)}</td>
                  </tr>
                  {!rental.isOpenEnded && rental.freightValue !== undefined && rental.freightValue > 0 ? (
                    <tr>
                      <td>Frete:</td>
                      <td className="text-right">{formatToBRL(rental.freightValue)}</td>
                    </tr>
                  ) : null}
                   {!rental.isOpenEnded && rental.discountValue !== undefined && rental.discountValue > 0 ? (
                    <tr>
                      <td>Desconto:</td>
                      <td className="text-right text-red-600">-{formatToBRL(rental.discountValue)}</td>
                    </tr>
                  ) : null}
                  <tr className="total-line">
                    <td>{rental.isOpenEnded ? 'Valor Diária (Total):' : 'Total Geral:'}</td>
                    <td className="text-right">{formatToBRL(rental.value)}</td>
                  </tr>
                </tbody></table>

            <div className="mt-2">
                <h3 className="font-semibold text-sm mb-1">Forma de Pagamento:</h3>
                <p className="text-xs">{paymentMethodMap[rental.paymentMethod || 'nao_definido']}</p>
                {rental.paymentStatus === 'paid' && rental.paymentDate && (
                    <p className="text-xs">Pago em: {format(parseISO(rental.paymentDate), "dd/MM/yyyy", { locale: ptBR })}</p>
                )}
                {rental.paymentStatus === 'paid' && (
                  <p className="text-sm font-semibold text-green-600 mt-2">{rental.isOpenEnded ? 'PAGAMENTO INICIAL OK' : 'CONTRATO QUITADO'}</p>
                )}
            </div>
            
            {rental.isOpenEnded && !rental.paymentDate && (
                <div className="mt-4 p-2 border border-orange-400 bg-orange-50 text-orange-800 rounded-md text-xs">
                   <AlertCircle className="inline-block h-4 w-4 mr-1"/>
                    Este é um contrato em aberto. O valor total será calculado no momento da devolução do equipamento.
                </div>
            )}

            {rental.paymentMethod === 'pix' && pixPayload && (
              <div className="pix-section">
                <h3 className="font-semibold text-sm mb-1">Pagar com PIX:</h3>
                <QRCodeCanvas value={pixPayload} size={128} level="M" includeMargin={true} />
                <div className="mt-2 text-center">
                    <p className="font-semibold text-sm">Chave PIX:</p>
                    <p className="font-mono font-bold text-base tracking-wider">{formattedPixKey}</p>
                </div>
              </div>
            )}
             {rental.paymentMethod === 'pix' && !pixPayload && currentCompanyDetails.pixKey && rental.value > 0 && !rental.isOpenEnded && (
                <div className="pix-section">
                    <p className="text-xs text-muted-foreground">Gerando QR Code PIX...</p>
                    <div className="mt-2 text-center">
                        <p className="font-semibold text-sm">Chave PIX:</p>
                        <p className="font-mono font-bold text-base tracking-wider">{formattedPixKey}</p>
                    </div>
                </div>
             )}
              {rental.paymentMethod === 'pix' && !currentCompanyDetails.pixKey && (
                <div className="pix-section">
                    <p className="text-xs text-destructive">Chave PIX não configurada nas informações da empresa.</p>
                </div>
              )}
          </div>
        </div>

        <footer className="text-center text-xs text-gray-500 mt-8 pt-4 border-t">
            <p>{currentCompanyDetails.contractFooterText || ''}</p>
            <p>Em caso de dúvidas, entre em contato: {currentCompanyDetails.phone}</p>
        </footer>

      </div>
    </div>
  );
}
