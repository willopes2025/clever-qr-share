// Brazilian phone validation and formatting utilities

export const formatPhoneNumber = (value: string): string => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  // Limit to 11 digits (Brazilian mobile with DDD)
  const limited = digits.slice(0, 11);
  
  // Apply mask based on length
  if (limited.length <= 2) {
    return `(${limited}`;
  } else if (limited.length <= 6) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  } else if (limited.length <= 10) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
  } else {
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
  }
};

export const validateBrazilianPhone = (phone: string): { valid: boolean; message: string } => {
  const digits = phone.replace(/\D/g, '');
  
  // Check if it's likely a Label ID (too long or too short)
  if (digits.length > 13) {
    return { valid: false, message: 'Número muito longo - pode ser um ID inválido' };
  }
  
  if (digits.length < 10) {
    return { valid: false, message: 'Número muito curto' };
  }
  
  // Remove country code if present
  const nationalNumber = digits.startsWith('55') ? digits.slice(2) : digits;
  
  // Brazilian phone: 10 digits (landline) or 11 digits (mobile)
  if (nationalNumber.length !== 10 && nationalNumber.length !== 11) {
    return { valid: false, message: 'Formato inválido. Use: (XX) XXXXX-XXXX' };
  }
  
  // Validate DDD (area code) - Brazilian DDDs are 11-99
  const ddd = parseInt(nationalNumber.slice(0, 2));
  if (ddd < 11 || ddd > 99) {
    return { valid: false, message: 'DDD inválido' };
  }
  
  // Mobile numbers (11 digits) should start with 9 after DDD
  if (nationalNumber.length === 11 && nationalNumber[2] !== '9') {
    return { valid: false, message: 'Celulares devem começar com 9' };
  }
  
  return { valid: true, message: '' };
};

export const extractDigits = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

export const formatForDisplay = (phone: string): string => {
  const digits = extractDigits(phone);
  
  // Remove country code if present
  const nationalNumber = digits.startsWith('55') ? digits.slice(2) : digits;
  
  return formatPhoneNumber(nationalNumber);
};

/**
 * Normaliza telefone adicionando DDI se necessário
 */
export const normalizePhoneWithCountryCode = (
  phone: string, 
  countryCode: string = '55'
): string => {
  const digits = phone.replace(/\D/g, '');
  
  // Se já começa com o código do país, retorna como está
  if (digits.startsWith(countryCode)) {
    return digits;
  }
  
  // Se tem 10-11 dígitos (número nacional brasileiro), adiciona DDI
  if (digits.length >= 10 && digits.length <= 11) {
    return `${countryCode}${digits}`;
  }
  
  return digits;
};

/**
 * Remove DDI do telefone
 */
export const normalizePhoneWithoutCountryCode = (
  phone: string,
  countryCode: string = '55'
): string => {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.startsWith(countryCode) && digits.length > 11) {
    return digits.slice(countryCode.length);
  }
  
  return digits;
};
