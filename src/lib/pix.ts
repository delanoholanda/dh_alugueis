
// Helper to format a field for the PIX payload
function formatField(id: string, value: string): string {
  const length = value.length.toString().padStart(2, '0');
  return `${id}${length}${value}`;
}

// Basic CRC16-CCITT calculation (commonly used for PIX)
// Source: Adapted from various online examples
function crc16ccitt(data: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= (data.charCodeAt(i) & 0xFF) << 8; // Process one byte at a time
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

interface GeneratePixPayloadArgs {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  txid: string; // Changed from optional to required for consistency with usage
  description?: string; // Description is optional in PIX spec for MAI
}

export function generatePixPayload({
  pixKey,
  merchantName,
  merchantCity,
  amount,
  txid, // No longer has a default here, will be passed from receipt page
  description,
}: GeneratePixPayloadArgs): string {
  // Normalize and truncate merchant name and city according to PIX specs
  const normalizedMerchantName = merchantName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .substring(0, 25); // Max 25 chars

  const normalizedMerchantCity = merchantCity
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .substring(0, 15); // Max 15 chars
  
  const formattedAmount = amount.toFixed(2);

  let payload = '';
  payload += formatField('00', '01'); // Payload Format Indicator

  // Merchant Account Information (MAI - ID 26)
  let mai = '';
  mai += formatField('00', 'br.gov.bcb.pix'); // GUI
  mai += formatField('01', pixKey);        // Chave PIX
  if (description) { // Descrição da cobrança (opcional, mas pode ser útil para o pagador)
    const normalizedDescription = description
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .substring(0, 70); // Limite de caracteres para descrição no MAI
    mai += formatField('02', normalizedDescription);
  }
  payload += formatField('26', mai);

  payload += formatField('52', '0000'); // Merchant Category Code (0000 for unspecified)
  payload += formatField('53', '986');  // Transaction Currency (BRL)
  payload += formatField('54', formattedAmount); // Transaction Amount
  payload += formatField('58', 'BR');   // Country Code
  payload += formatField('59', normalizedMerchantName); // Merchant Name (Nome do Recebedor que o pagador vê)
  payload += formatField('60', normalizedMerchantCity); // Merchant City

  // Additional Data Field Template (ADF - ID 62) - Reference Label (txid)
  // O txid (ID 05 dentro do ADF) é para conciliação do recebedor.
  // Deve ser alfanumérico, sem espaços, e <= 25 caracteres.
  // Se o valor do PIX é definido pelo pagador, txid DEVE ser "***".
  // No nosso caso, o valor é fixo, então usamos um txid para nossa referência.
  const validTxid = txid.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25);
  const adf = formatField('05', validTxid || '***'); // Garante que txid nunca seja vazio
  payload += formatField('62', adf);
  
  payload += '6304'; // CRC16 ID and Length (always 04 for CRC16-CCITT)
  
  const crc = crc16ccitt(payload);
  payload += crc;

  return payload;
}

    