// Keyboard layout fixes for different languages (e.g., QWERTY <-> Cyrillic)
const QWERTY_TO_CYRILLIC: Record<string, string> = {
  'q': 'й', 'w': 'ц', 'e': 'у', 'r': 'к', 't': 'е', 'y': 'н', 'u': 'г', 'i': 'ш', 'o': 'щ', 'p': 'з',
  'a': 'ф', 's': 'ы', 'd': 'в', 'f': 'а', 'g': 'п', 'h': 'р', 'j': 'о', 'k': 'л', 'l': 'д',
  'z': 'я', 'x': 'ч', 'c': 'с', 'v': 'м', 'b': 'и', 'n': 'т', 'm': 'ь',
  'Q': 'Й', 'W': 'Ц', 'E': 'У', 'R': 'К', 'T': 'Е', 'Y': 'Н', 'U': 'Г', 'I': 'Ш', 'O': 'Щ', 'P': 'З',
  'A': 'Ф', 'S': 'Ы', 'D': 'В', 'F': 'А', 'G': 'П', 'H': 'Р', 'J': 'О', 'K': 'Л', 'L': 'Д',
  'Z': 'Я', 'X': 'Ч', 'C': 'С', 'V': 'М', 'B': 'И', 'N': 'Т', 'M': 'Ь',
  '[': 'х', ']': 'ъ', ';': 'ж', "'": 'э', ',': 'б', '.': 'ю', '/': '.',
  '{': 'Х', '}': 'Ъ', ':': 'Ж', '"': 'Э', '<': 'Б', '>': 'Ю', '?': ',',
};

const CYRILLIC_TO_QWERTY: Record<string, string> = {};
for (const [latin, cyrillic] of Object.entries(QWERTY_TO_CYRILLIC)) {
  CYRILLIC_TO_QWERTY[cyrillic] = latin;
}

/**
 * Quick fix for text typed in wrong keyboard layout
 * Converts between QWERTY and Cyrillic layouts
 */
export function quickFix(text: string): string {
  // Try to detect if text needs conversion
  const hasCyrillic = /[а-яА-ЯёЁ]/.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);
  
  // If mixed or no clear pattern, return as is
  if ((hasCyrillic && hasLatin) || (!hasCyrillic && !hasLatin)) {
    return text;
  }
  
  // Convert based on detected layout
  const map = hasCyrillic ? CYRILLIC_TO_QWERTY : QWERTY_TO_CYRILLIC;
  
  return text
    .split('')
    .map(char => map[char] || char)
    .join('');
}

/**
 * Convert QWERTY layout text to Cyrillic
 */
export function qwertyToCyrillic(text: string): string {
  return text
    .split('')
    .map(char => QWERTY_TO_CYRILLIC[char] || char)
    .join('');
}

/**
 * Convert Cyrillic layout text to QWERTY
 */
export function cyrillicToQwerty(text: string): string {
  return text
    .split('')
    .map(char => CYRILLIC_TO_QWERTY[char] || char)
    .join('');
}

/**
 * Detect if text is primarily in Cyrillic
 */
export function isCyrillic(text: string): boolean {
  const cyrillicChars = text.match(/[а-яА-ЯёЁ]/g)?.length || 0;
  const latinChars = text.match(/[a-zA-Z]/g)?.length || 0;
  return cyrillicChars > latinChars;
}
