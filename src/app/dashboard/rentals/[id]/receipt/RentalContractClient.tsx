
'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatToBRL } from '@/lib/utils';
import type { Rental, Equipment as InventoryItem, PaymentMethod, CompanyDetails, Customer } from '@/types';
import ContractPrintActions from './ContractPrintActions';
import { QRCodeCanvas } from 'qrcode.react';
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

const formatCpfForDisplay = (cpf: string | null | undefined): string => {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `CPF: ${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

interface RentalContractClientProps {
    rental: Rental;
    customer: Customer | null | undefined;
    companySettings: CompanyDetails;
    pixPayload: string | null;
    inventory: InventoryItem[];
}

export default function RentalContractClient({ rental, customer, companySettings, pixPayload, inventory }: RentalContractClientProps) {

  const detailedEquipment = useMemo(() => {
    const inventoryMap = new Map(inventory.map(item => [item.id, item]));

    return rental.equipment.map((eq) => {
      const inventoryItem = inventoryMap.get(eq.equipmentId);
      const dailyRateToUse = eq.customDailyRentalRate ?? inventoryItem?.dailyRentalRate ?? 0;
      const itemSubtotal = dailyRateToUse * (rental.isOpenEnded ? 1 : (rental.rentalDays || 0)) * eq.quantity;
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
  }, [rental, inventory]);
  
  const formatPixKeyForDisplay = (pixKey: string): string => {
    if (!pixKey) return '';
    let digits = pixKey.replace(/\D/g, "");
    
    if (digits.startsWith('55') && digits.length === 13) {
      digits = digits.substring(2);
    }

    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    }
    
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
    }
    
    return pixKey;
  };

  const itemsSubtotal = detailedEquipment.reduce((sum, eq) => sum + eq.lineTotal, 0);
  const contractGeneratedAt = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const valorPorExtenso = numberToWords(rental.value);
  const displayContractLogo = companySettings.contractLogoUrl || companySettings.companyLogoUrl || DEFAULT_COMPANY_LOGO;
  const contractTitle = "Contrato de Aluguel";
  const rentalPeriod = rental.isOpenEnded
    ? `${format(parseISO(rental.rentalStartDate), "dd/MM/yyyy", { locale: ptBR })} - Em Aberto`
    : `${format(parseISO(rental.rentalStartDate), "dd/MM/yyyy", { locale: ptBR })} - ${format(parseISO(rental.expectedReturnDate), "dd/MM/yyyy", { locale: ptBR })}`;
  const formattedPixKey = formatPixKeyForDisplay(companySettings.pixKey);


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
        .contract-header .company-info { text-align: right; font-size: 10px; line-height: 1.1; }
        .contract-header .company-info h1 { font-size: 14px; margin-bottom: 2px;}
        .contract-section { margin-bottom: 0.5rem; line-height: 1.1; } 
        .contract-table { width: 100%; border-collapse: collapse; margin-bottom: 0.5rem; }
        .contract-table th, .contract-table td { border: 1px solid #ddd; padding: 0.25rem 0.4rem 0.5rem 0.4rem; text-align: left; vertical-align: middle; }
        .contract-table th { background-color: #f8f8f8; font-size: 10px; }
        .contract-table .text-right { text-align: right; }
        .contract-summary-grid { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem 1rem; }
        .total-line { font-weight: bold; font-size: 12px; }
        hr { border: 0; border-top: 1px solid #eee; margin: 0.5rem 0;}
        .pix-section { text-align: center; margin-top: 0.5rem; }
        .pix-section canvas { margin: 0.5rem auto; border: 1px solid #eee; padding: 5px; background: white; }
        .pix-key-text { font-size: 9px; word-break: break-all; }
        .terms-conditions { white-space: pre-wrap; font-size: 9px; line-height: 1.2; margin-bottom: 0.25rem; }
        .contract-section p.valor-extenso-class { margin-top: 0.25rem; margin-bottom: 0.5rem; }
        .contract-section.signature-container {
          margin-top: 1rem !important;     
          margin-bottom: 0.5rem !important;  
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
        }
        .signature-area {
          text-align: center;
          margin-top: 1rem !important;     
          margin-bottom: 0.25rem !important;
        }
        .signature-area:first-child {
           margin-bottom: 1rem !important; 
        }
        .signature-line {
          display: block;
          margin: 0 auto 0.25rem auto;
          width: 250px;
          border-bottom: 1px solid #333;
          padding-bottom: 20px !important; 
        }
        footer.text-center.text-xs {
            font-size: 10px !important;
            margin-top: 1rem !important;
            padding-top: 0.5rem !important;
        }
      `}</style>

      <div className="contract-container">
        <ContractPrintActions rentalId={rental.id.toString()} customerName={customer?.name} />

        <header className="contract-header">
          <div className="logo-container">
             <Image 
                src={displayContractLogo} 
                alt={`${companySettings.companyName} Logo`}
                fill
                style={{ objectFit: 'contain' }}
                priority
                key={displayContractLogo}
                data-ai-hint="company logo"
            />
          </div>
          <div className="company-info">
            <h1 className="font-bold">{contractTitle}</h1>
            <p className="font-semibold">{companySettings.companyName}</p>
            <p>Responsável: {companySettings.responsibleName}</p>
            <p>Telefone: {companySettings.phone}</p>
            <p>Endereço: {companySettings.address}</p>
            <p>Email: {companySettings.email}</p>
            {companySettings.pixKey && <p>PIX: {companySettings.pixKey}</p>}
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
          <h3 className="font-semibold text-sm mb-1">Itens / Serviços:</h3>
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
            <h3 className="font-semibold text-sm mb-1">Observações:</h3>
            <p className="text-xs whitespace-pre-wrap">{rental.notes || 'Nenhuma observação.'}</p>
            
            <div className="mt-2">
                <h3 className="font-semibold text-sm mb-1">Regras de Cobrança:</h3>
                <ul className="text-xs list-disc list-inside">
                    {rental.isOpenEnded && (
                        <li>Será cobrado {formatToBRL(rental.value)} por dia de aluguel.</li>
                    )}
                    <li>Cobrança para Sábados: <span className="font-semibold">{rental.chargeSaturdays ? 'SIM' : 'NÃO'}</span></li>
                    <li>Cobrança para Domingos: <span className="font-semibold">{rental.chargeSundays ? 'SIM' : 'NÃO'}</span></li>
                </ul>
            </div>

            <h3 className="font-semibold text-sm mb-1 mt-2">Termos e Condições:</h3>
            <p className="terms-conditions">
              {companySettings.contractTermsAndConditions || ''}
            </p>
             <p className="text-xs mt-2 valor-extenso-class">
              Valor por extenso: {valorPorExtenso || 'Não especificado'}. {rental.isOpenEnded && <span className="font-semibold">(Valor referente à diária)</span>}
            </p>
            <section className="contract-section signature-container">
                <div className="signature-area">
                    <p className="signature-line"></p>
                    <p className="font-semibold text-xs">{companySettings.responsibleName}</p>
                    <p className="text-xs">{companySettings.companyName} (Locador)</p>
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
                  {rental.freightValue !== undefined && rental.freightValue > 0 ? (
                    <tr>
                      <td>Frete:</td>
                      <td className="text-right">{formatToBRL(rental.freightValue)}</td>
                    </tr>
                  ) : null}
                  <tr className="total-line">
                    <td>{rental.isOpenEnded ? 'Valor Diária (Total):' : 'Total Geral:'}</td>
                    <td className="text-right">{formatToBRL(rental.value)}</td>
                  </tr>
                </tbody></table>

            <div className="mt-1">
                <h3 className="font-semibold text-sm mb-1">Forma de Pagamento:</h3>
                <p className="text-xs">{paymentMethodMap[rental.paymentMethod || 'nao_definido']}</p>
                {rental.paymentStatus === 'paid' && rental.paymentDate && (
                    <p className="text-xs">Pago em: {format(parseISO(rental.paymentDate), "dd/MM/yyyy", { locale: ptBR })}</p>
                )}
                {rental.paymentStatus === 'paid' && (
                  <p className="text-sm font-semibold text-green-600 mt-1">{rental.isOpenEnded ? 'PAGAMENTO INICIAL OK' : 'CONTRATO QUITADO'}</p>
                )}
            </div>
            
            {rental.isOpenEnded && !rental.paymentDate && (
                <div className="mt-2 p-2 border border-orange-400 bg-orange-50 text-orange-800 rounded-md text-xs">
                   <AlertCircle className="inline-block h-4 w-4 mr-1"/>
                    Este é um contrato em aberto. O valor total será calculado no momento da devolução do equipamento.
                </div>
            )}

            {rental.paymentMethod === 'pix' && pixPayload && (
              <div className="pix-section">
                <h3 className="font-semibold text-sm mb-1">Pagar com PIX:</h3>
                <QRCodeCanvas value={pixPayload} size={110} level="M" includeMargin={true} />
                <div className="mt-1 text-center">
                    <p className="font-semibold text-sm">Chave PIX:</p>
                    <p className="font-mono font-bold text-base tracking-wider">{formattedPixKey}</p>
                </div>
              </div>
            )}
             {rental.paymentMethod === 'pix' && !pixPayload && companySettings.pixKey && rental.value > 0 && !rental.isOpenEnded && (
                <div className="pix-section">
                    <p className="text-xs text-muted-foreground">Gerando QR Code PIX...</p>
                    <div className="mt-1 text-center">
                        <p className="font-semibold text-sm">Chave PIX:</p>
                        <p className="font-mono font-bold text-base tracking-wider">{formattedPixKey}</p>
                    </div>
                </div>
             )}
              {rental.paymentMethod === 'pix' && !companySettings.pixKey && (
                <div className="pix-section">
                    <p className="text-xs text-destructive">Chave PIX não configurada nas informações da empresa.</p>
                </div>
              )}
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
