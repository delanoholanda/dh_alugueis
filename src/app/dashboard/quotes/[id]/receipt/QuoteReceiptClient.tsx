'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatToBRL } from '@/lib/utils';
import type { Quote, Equipment as InventoryItem, CompanyDetails, Customer } from '@/types';
import ContractPrintActions from '@/app/dashboard/rentals/[id]/receipt/ContractPrintActions';
import { MapPin } from 'lucide-react';

const DEFAULT_COMPANY_LOGO = '/dh-alugueis-logo.png';

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

const formatDocumentForDisplay = (docType?: 'cpf' | 'cnpj', docNumber?: string | null): string => {
  if (!docNumber) return '';
  const digits = docNumber.replace(/\D/g, "");
  if (docType === 'cpf' && digits.length === 11) {
    return `CPF: ${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }
  if (docType === 'cnpj' && digits.length === 14) {
    return `CNPJ: ${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  }
  return docNumber;
};

interface QuoteReceiptClientProps {
    quote: Quote;
    customer: Customer | null | undefined;
    companySettings: CompanyDetails;
    inventory: InventoryItem[];
}

export default function QuoteReceiptClient({ quote, customer, companySettings, inventory }: QuoteReceiptClientProps) {

  const detailedEquipment = useMemo(() => {
    const inventoryMap = new Map(inventory.map(item => [item.id, item]));
    return quote.equipment.map((eq) => {
      const inventoryItem = inventoryMap.get(eq.equipmentId);
      const dailyRateToUse = eq.customDailyRentalRate ?? inventoryItem?.dailyRentalRate ?? 0;
      const itemSubtotal = dailyRateToUse * (quote.rentalDays || 0) * eq.quantity;
      return { ...inventoryItem, id: eq.equipmentId, name: eq.name || inventoryItem?.name || 'Item Desconhecido', quantity: eq.quantity, equipmentId: eq.equipmentId, customDailyRentalRate: eq.customDailyRentalRate, dailyRentalRateUsed: dailyRateToUse, lineTotal: itemSubtotal } as DetailedEquipmentItem;
    });
  }, [quote, inventory]);
  
  const itemsSubtotal = detailedEquipment.reduce((sum, eq) => sum + eq.lineTotal, 0);
  const valorPorExtenso = numberToWords(quote.value);
  const displayContractLogo = companySettings.contractLogoUrl || companySettings.companyLogoUrl || DEFAULT_COMPANY_LOGO;
  const contractTitle = "Orçamento de Aluguel";
  const quotePeriod = `${format(parseISO(quote.rentalStartDate), "dd/MM/yyyy", { locale: ptBR })} - ${format(parseISO(quote.expectedReturnDate), "dd/MM/yyyy", { locale: ptBR })}`;

  return (
    <div className="bg-gray-100 min-h-screen py-8 px-4 print:bg-white print:py-0 print:px-0">
      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        .contract-container { max-width: 750px; margin: 0 auto; background-color: white; padding: 2rem; box-shadow: 0 0 10px rgba(0,0,0,0.1); font-family: Arial, sans-serif; font-size: 11px; color: #333; border: 1px solid #eee; overflow-x: auto; }
        .contract-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
        .contract-header .logo-container { position: relative; width: 150px; height: 75px; flex-shrink: 0; }
        .contract-header .logo-container img { width: 100%; height: 100%; object-fit: contain !important; }
        .contract-header .company-info { text-align: right; font-size: 10px; line-height: 1.1; }
        .contract-header .company-info h1 { font-size: 14px; margin-bottom: 2px;}
        .contract-header .company-info p, .contract-section p { margin-top: 0; margin-bottom: 0; }
        .contract-section { margin-bottom: 0.5rem; line-height: 1.1; } 
        .contract-table { width: 100%; border-collapse: collapse; margin-bottom: 0.5rem; }
        .contract-table th, .contract-table td { border: 1px solid #ddd; padding: 0.25rem 0.4rem 0.5rem 0.4rem; text-align: left; vertical-align: middle; }
        .contract-table th { background-color: #f8f8f8; font-size: 10px; }
        .contract-table .text-right { text-align: right; }
        .contract-summary-grid { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem 1rem; }
        .total-line { font-weight: bold; font-size: 12px; }
        hr { border: 0; border-top: 1px solid #eee; margin: 0.5rem 0;}
        .terms-conditions { white-space: pre-wrap; font-size: 9px; line-height: 1.2; margin-bottom: 0.25rem; }
        .valor-extenso-class { margin-top: 0.25rem; margin-bottom: 0.5rem; }
        footer.text-center.text-xs { font-size: 10px !important; margin-top: 1rem !important; padding-top: 0.5rem !important; }
      `}</style>

      <div className="contract-container">
        <ContractPrintActions rentalId={quote.id.toString()} customerName={customer?.name} />

        <header className="contract-header">
          <div className="logo-container"><Image src={displayContractLogo} alt={`${companySettings.companyName} Logo`} fill style={{ objectFit: 'contain' }} priority key={displayContractLogo} data-ai-hint="company logo"/></div>
          <div className="company-info">
            <h1 className="font-bold">{contractTitle}</h1>
            <p className="font-semibold">{companySettings.companyName}</p>
            <p>Responsável: {companySettings.responsibleName}</p>
            <p>Telefone: {companySettings.phone}</p>
            <p>Endereço: {companySettings.address}</p>
            <p>Email: {companySettings.email}</p>
          </div>
        </header>

        <hr />

        <section className="contract-section flex justify-between items-start">
          <div>
            <h2 className="font-semibold text-sm mb-1">Cliente:</h2>
            <p>{quote.customerName || 'Cliente não especificado'}</p>
            {customer?.phone && <p>Telefone: {customer.phone}</p>}
            {customer?.documentNumber && <p>{formatDocumentForDisplay(customer.documentType, customer.documentNumber)}</p>}
            {customer?.address && <p>Endereço (Cliente): {customer.address}</p>}
            {quote.deliveryAddress && (<p className="flex items-start"><MapPin className="h-3 w-3 mr-1 mt-0.5 text-muted-foreground flex-shrink-0" /><span className="font-semibold">Entrega em:</span>&nbsp;<span className="whitespace-pre-wrap">{quote.deliveryAddress}</span></p>)}
          </div>
          <div className="text-xs text-right">
            <p><strong>Nº do Orçamento:</strong> {quote.id.toString().padStart(4,'0')}</p>
            <p><strong>Período Previsto:</strong> {quotePeriod}</p>
            <p>Data de Emissão: {format(parseISO(quote.quoteDate), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
          </div>
        </section>

        <section className="contract-section">
          <h3 className="font-semibold text-sm mb-1">Itens / Serviços:</h3>
          <table className="contract-table">
            <thead><tr><th>Item / Serviço</th><th className="text-right">Qtd</th><th className="text-right">Preço Unit. (Diária)</th><th className="text-right">Qtd. Dias</th><th className="text-right">Valor Total (Item)</th></tr></thead>
            <tbody>
              {detailedEquipment.map((eq, index) => (<tr key={index}><td>{eq.name}</td><td className="text-right">{eq.quantity}</td><td className="text-right">{formatToBRL(eq.dailyRentalRateUsed)}</td><td className="text-right">{quote.rentalDays}</td><td className="text-right">{formatToBRL(eq.lineTotal)}</td></tr>))}
            </tbody>
          </table>
        </section>

        <div className="contract-summary-grid contract-section">
          <div> {/* Coluna da esquerda */}
            <h3 className="font-semibold text-sm mb-1">Observações:</h3>
            <p className="text-xs whitespace-pre-wrap">{quote.notes || 'Nenhuma observação.'}</p>
            <p className="text-xs mt-2 valor-extenso-class">Valor por extenso: {valorPorExtenso || 'Não especificado'}.</p>
          </div>

          <div> {/* Coluna da direita */}
            <table className="contract-table w-auto ml-auto"><tbody>
              <tr><td>Soma dos itens/serviços:</td><td className="text-right">{formatToBRL(itemsSubtotal)}</td></tr>
              {typeof quote.freightValue === 'number' && quote.freightValue > 0 && (<tr><td>Frete:</td><td className="text-right">{formatToBRL(quote.freightValue)}</td></tr>)}
              <tr className="total-line"><td>Total Geral do Orçamento:</td><td className="text-right">{formatToBRL(quote.value)}</td></tr>
            </tbody></table>
          </div>
        </div>

        <footer className="text-center text-xs text-gray-500 mt-4 pt-2 border-t">
            <p>{companySettings.contractFooterText || ''}</p>
            <p>Em caso de dúvidas, entre em contato: {companySettings.phone}</p>
        </footer>
      </div>
    </div>
  );
}
