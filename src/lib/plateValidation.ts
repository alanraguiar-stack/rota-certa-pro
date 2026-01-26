// Brazilian plate validation utility

// Old format: ABC-1234
// New Mercosul format: ABC1D23

export function validateBrazilianPlate(plate: string): { valid: boolean; formatted: string; error?: string } {
  // Remove spaces and convert to uppercase
  const cleanPlate = plate.replace(/[\s-]/g, '').toUpperCase();
  
  if (cleanPlate.length === 0) {
    return { valid: false, formatted: '', error: 'Placa é obrigatória' };
  }

  if (cleanPlate.length !== 7) {
    return { valid: false, formatted: cleanPlate, error: 'Placa deve ter 7 caracteres' };
  }

  // Old format: ABC1234 (3 letters + 4 numbers)
  const oldFormatRegex = /^[A-Z]{3}[0-9]{4}$/;
  
  // Mercosul format: ABC1D23 (3 letters + 1 number + 1 letter + 2 numbers)
  const mercosulFormatRegex = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

  if (oldFormatRegex.test(cleanPlate)) {
    // Format as ABC-1234
    const formatted = `${cleanPlate.slice(0, 3)}-${cleanPlate.slice(3)}`;
    return { valid: true, formatted };
  }

  if (mercosulFormatRegex.test(cleanPlate)) {
    // Format as ABC1D23 (no hyphen for Mercosul)
    return { valid: true, formatted: cleanPlate };
  }

  return { 
    valid: false, 
    formatted: cleanPlate, 
    error: 'Formato inválido. Use ABC-1234 ou ABC1D23 (Mercosul)' 
  };
}

export function formatPlateInput(value: string): string {
  // Remove non-alphanumeric characters except hyphen
  const clean = value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
  
  // Limit to 8 characters (including possible hyphen)
  return clean.slice(0, 8);
}
