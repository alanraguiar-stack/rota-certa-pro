/**
 * Encoding utilities for handling text with Portuguese characters
 * Ensures proper UTF-8 support throughout the application
 */

/**
 * Detect if a string contains incorrectly decoded characters
 * Common patterns when UTF-8 is read as ISO-8859-1 or vice versa
 */
function hasEncodingIssues(text: string): boolean {
  // Check for common mojibake patterns (UTF-8 read as Latin-1)
  const mojibakePatterns = [
    /Ã©/g, // é
    /Ã¡/g, // á
    /Ã£/g, // ã
    /Ãµ/g, // õ
    /Ã§/g, // ç
    /Ã­/g, // í
    /Ãº/g, // ú
    /Ã³/g, // ó
    /Ã‰/g, // É
    /Ã‡/g, // Ç
    /Ã€/g, // À
    /Ã‚/g, // Â
    /Ãª/g, // ê
    /Ã´/g, // ô
    /\ufffd/g, // Replacement character
  ];
  
  return mojibakePatterns.some(pattern => pattern.test(text));
}

/**
 * Fix common mojibake issues (UTF-8 incorrectly decoded as Latin-1)
 */
function fixMojibake(text: string): string {
  const replacements: [RegExp, string][] = [
    [/Ã¡/g, 'á'],
    [/Ã /g, 'à'],
    [/Ã¢/g, 'â'],
    [/Ã£/g, 'ã'],
    [/Ã¤/g, 'ä'],
    [/Ã©/g, 'é'],
    [/Ã¨/g, 'è'],
    [/Ãª/g, 'ê'],
    [/Ã«/g, 'ë'],
    [/Ã­/g, 'í'],
    [/Ã¬/g, 'ì'],
    [/Ã®/g, 'î'],
    [/Ã¯/g, 'ï'],
    [/Ã³/g, 'ó'],
    [/Ã²/g, 'ò'],
    [/Ã´/g, 'ô'],
    [/Ãµ/g, 'õ'],
    [/Ã¶/g, 'ö'],
    [/Ãº/g, 'ú'],
    [/Ã¹/g, 'ù'],
    [/Ã»/g, 'û'],
    [/Ã¼/g, 'ü'],
    [/Ã§/g, 'ç'],
    [/Ã±/g, 'ñ'],
    [/Ã‰/g, 'É'],
    [/Ã€/g, 'À'],
    [/Ã‚/g, 'Â'],
    [/Ãƒ/g, 'Ã'],
    [/Ã‡/g, 'Ç'],
    [/Ã"/g, 'Ó'],
    [/Ã'/g, 'Ò'],
    [/Ã"/g, 'Ô'],
    [/Ã•/g, 'Õ'],
    [/Ãš/g, 'Ú'],
    [/Ã™/g, 'Ù'],
    [/Ã›/g, 'Û'],
    [/Ãœ/g, 'Ü'],
    [/Ã/g, 'Í'],
    [/ÃŠ/g, 'Ê'],
    [/Â°/g, '°'],
    [/Âº/g, 'º'],
    [/Âª/g, 'ª'],
  ];
  
  let result = text;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  
  return result;
}

/**
 * Decode a file buffer trying multiple encodings
 * Prioritizes UTF-8, then tries ISO-8859-1 (Latin-1)
 */
export async function decodeFileContent(file: File): Promise<string> {
  // First, try reading as UTF-8
  const utf8Text = await file.text();
  
  // Check if the text looks correctly decoded
  if (!hasEncodingIssues(utf8Text)) {
    return utf8Text;
  }
  
  // Try to fix mojibake patterns
  const fixedText = fixMojibake(utf8Text);
  if (fixedText !== utf8Text && !hasEncodingIssues(fixedText)) {
    return fixedText;
  }
  
  // Try reading as ISO-8859-1 (Latin-1) and converting to UTF-8
  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoder = new TextDecoder('iso-8859-1');
    const latin1Text = decoder.decode(arrayBuffer);
    
    // Check if Latin-1 decoding produced better results
    if (!hasEncodingIssues(latin1Text)) {
      return latin1Text;
    }
    
    // Try Windows-1252 (common in Brazilian Excel exports)
    const win1252Decoder = new TextDecoder('windows-1252');
    const win1252Text = win1252Decoder.decode(arrayBuffer);
    
    if (!hasEncodingIssues(win1252Text)) {
      return win1252Text;
    }
  } catch (error) {
    console.warn('Error trying alternative encodings:', error);
  }
  
  // Return the best result we have (fixed UTF-8 or original)
  return fixedText || utf8Text;
}

/**
 * Normalize text to ensure consistent UTF-8 encoding
 * Useful for text input from various sources
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  
  // Fix any mojibake patterns
  let normalized = fixMojibake(text);
  
  // Normalize Unicode (NFC - Canonical Decomposition, followed by Canonical Composition)
  normalized = normalized.normalize('NFC');
  
  // Remove any zero-width characters that might cause issues
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  return normalized;
}

/**
 * Remove accents for search/comparison purposes
 * Keeps original text but provides accent-insensitive comparison
 */
export function removeAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

