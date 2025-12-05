/**
 * Утилита для конвертации раскладки клавиатуры (аналог Punto Switcher)
 */

// Маппинг символов: английская → русская
const enToRu: { [key: string]: string } = {
  'q': 'й', 'w': 'ц', 'e': 'у', 'r': 'к', 't': 'е', 'y': 'н', 'u': 'г',
  'i': 'ш', 'o': 'щ', 'p': 'з', '[': 'х', ']': 'ъ', 'a': 'ф', 's': 'ы',
  'd': 'в', 'f': 'а', 'g': 'п', 'h': 'р', 'j': 'о', 'k': 'л', 'l': 'д',
  ';': 'ж', "'": 'э', 'z': 'я', 'x': 'ч', 'c': 'с', 'v': 'м', 'b': 'и',
  'n': 'т', 'm': 'ь', ',': 'б', '.': 'ю', '/': '.', '`': 'ё',
  'Q': 'Й', 'W': 'Ц', 'E': 'У', 'R': 'К', 'T': 'Е', 'Y': 'Н', 'U': 'Г',
  'I': 'Ш', 'O': 'Щ', 'P': 'З', '{': 'Х', '}': 'Ъ', 'A': 'Ф', 'S': 'Ы',
  'D': 'В', 'F': 'А', 'G': 'П', 'H': 'Р', 'J': 'О', 'K': 'Л', 'L': 'Д',
  ':': 'Ж', '"': 'Э', 'Z': 'Я', 'X': 'Ч', 'C': 'С', 'V': 'М', 'B': 'И',
  'N': 'Т', 'M': 'Ь', '<': 'Б', '>': 'Ю', '?': ',', '~': 'Ё',
  '@': '"', '#': '№', '$': ';', '^': ':', '&': '?'
};

// Маппинг символов: русская → английская
const ruToEn: { [key: string]: string } = {
  'й': 'q', 'ц': 'w', 'у': 'e', 'к': 'r', 'е': 't', 'н': 'y', 'г': 'u',
  'ш': 'i', 'щ': 'o', 'з': 'p', 'х': '[', 'ъ': ']', 'ф': 'a', 'ы': 's',
  'в': 'd', 'а': 'f', 'п': 'g', 'р': 'h', 'о': 'j', 'л': 'k', 'д': 'l',
  'ж': ';', 'э': "'", 'я': 'z', 'ч': 'x', 'с': 'c', 'м': 'v', 'и': 'b',
  'т': 'n', 'ь': 'm', 'б': ',', 'ю': '.', '.': '/', 'ё': '`',
  'Й': 'Q', 'Ц': 'W', 'У': 'E', 'К': 'R', 'Е': 'T', 'Н': 'Y', 'Г': 'U',
  'Ш': 'I', 'Щ': 'O', 'З': 'P', 'Х': '{', 'Ъ': '}', 'Ф': 'A', 'Ы': 'S',
  'В': 'D', 'А': 'F', 'П': 'G', 'Р': 'H', 'О': 'J', 'Л': 'K', 'Д': 'L',
  'Ж': ':', 'Э': '"', 'Я': 'Z', 'Ч': 'X', 'С': 'C', 'М': 'V', 'И': 'B',
  'Т': 'N', 'Ь': 'M', 'Б': '<', 'Ю': '>', ',': '?', 'Ё': '~',
  '"': '@', '№': '#', ';': '$', ':': '^', '?': '&'
};

/**
 * Определяет, в какой раскладке написан текст
 * @param text - Текст для анализа
 * @returns 'en' если английская, 'ru' если русская, 'mixed' если смешанная
 */
function detectLayout(text: string): 'en' | 'ru' | 'mixed' {
  if (!text || text.trim().length === 0) return 'en';
  
  let enCount = 0;
  let ruCount = 0;
  
  for (const char of text) {
    if (enToRu[char]) {
      enCount++;
    } else if (ruToEn[char]) {
      ruCount++;
    }
  }
  
  if (enCount > ruCount * 1.5) return 'en';
  if (ruCount > enCount * 1.5) return 'ru';
  return 'mixed';
}

/**
 * Конвертирует текст из одной раскладки в другую
 * @param text - Текст для конвертации
 * @param fromLayout - Исходная раскладка ('en' | 'ru' | 'auto')
 * @param toLayout - Целевая раскладка ('en' | 'ru' | 'auto')
 * @returns Конвертированный текст
 */
export function convertLayout(
  text: string,
  fromLayout: 'en' | 'ru' | 'auto' = 'auto',
  toLayout: 'en' | 'ru' | 'auto' = 'auto'
): string {
  if (!text || text.trim().length === 0) return text;
  
  // Автоопределение раскладки
  if (fromLayout === 'auto') {
    fromLayout = detectLayout(text);
  }
  
  // Если целевая раскладка 'auto', выбираем противоположную
  if (toLayout === 'auto') {
    toLayout = fromLayout === 'en' ? 'ru' : 'en';
  }
  
  // Если раскладки одинаковые, возвращаем исходный текст
  if (fromLayout === toLayout) return text;
  
  // Конвертируем
  const mapping = fromLayout === 'en' ? enToRu : ruToEn;
  let result = '';
  
  for (const char of text) {
    if (mapping[char]) {
      result += mapping[char];
    } else {
      // Если символ не в маппинге, оставляем как есть (цифры, пробелы, знаки препинания)
      result += char;
    }
  }
  
  return result;
}

/**
 * Определяет, является ли слово русским (содержит русские буквы)
 */
function isRussianWord(word: string): boolean {
  const russianLetters = /[а-яёА-ЯЁ]/;
  return russianLetters.test(word);
}

/**
 * Определяет, является ли слово английским (содержит только английские буквы, которые можно конвертировать)
 */
function isConvertibleEnglishWord(word: string): boolean {
  // Проверяем, что слово содержит только английские буквы, которые есть в маппинге
  if (!/^[a-zA-Z]+$/.test(word)) return false;
  
  // Проверяем, что все символы можно конвертировать в русские
  for (const char of word) {
    if (!enToRu[char]) return false;
  }
  
  return true;
}

/**
 * Словарь частых русских слов для исправления опечаток
 */
const commonRussianWords = new Set([
  'как', 'дела', 'привет', 'пока', 'спасибо', 'пожалуйста', 'да', 'нет',
  'хорошо', 'плохо', 'сегодня', 'завтра', 'вчера', 'сейчас', 'потом',
  'где', 'когда', 'что', 'кто', 'почему', 'какой', 'какая', 'какое',
  'это', 'то', 'тут', 'там', 'здесь', 'там', 'туда', 'сюда',
  'я', 'ты', 'он', 'она', 'оно', 'мы', 'вы', 'они',
  'мой', 'твой', 'его', 'её', 'наш', 'ваш', 'их',
  'быть', 'есть', 'был', 'была', 'было', 'были',
  'делать', 'делаю', 'делаешь', 'делает', 'делаем', 'делаете', 'делают',
  'идти', 'иду', 'идешь', 'идет', 'идем', 'идете', 'идут',
  'говорить', 'говорю', 'говоришь', 'говорит', 'говорим', 'говорите', 'говорят',
  'знать', 'знаю', 'знаешь', 'знает', 'знаем', 'знаете', 'знают',
  'хотеть', 'хочу', 'хочешь', 'хочет', 'хотим', 'хотите', 'хотят',
  'могу', 'можешь', 'может', 'можем', 'можете', 'могут',
  'нужно', 'надо', 'должен', 'должна', 'должно', 'должны',
  'можно', 'нельзя', 'хороший', 'плохой', 'большой', 'маленький',
  'новый', 'старый', 'молодой', 'старый', 'красивый', 'уродливый',
  'день', 'ночь', 'утро', 'вечер', 'неделя', 'месяц', 'год',
  'дом', 'работа', 'школа', 'университет', 'друг', 'подруга',
  'любовь', 'жизнь', 'смерть', 'счастье', 'грусть', 'радость',
  'еда', 'вода', 'хлеб', 'молоко', 'мясо', 'рыба', 'овощи',
  'машина', 'автобус', 'поезд', 'самолет', 'корабль',
  'город', 'деревня', 'страна', 'мир', 'земля', 'небо',
  'солнце', 'луна', 'звезда', 'дождь', 'снег', 'ветер',
  'и', 'или', 'но', 'а', 'чтобы', 'потому', 'что',
  'в', 'на', 'под', 'над', 'за', 'перед', 'около', 'между',
  'к', 'от', 'до', 'из', 'с', 'без', 'для', 'про'
]);

/**
 * Вычисляет расстояние Левенштейна между двумя строками
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // удаление
          dp[i][j - 1] + 1,     // вставка
          dp[i - 1][j - 1] + 1  // замена
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Находит наиболее похожее слово из словаря
 */
function findClosestWord(word: string, maxDistance: number = 2): string | null {
  if (commonRussianWords.has(word.toLowerCase())) {
    return null; // Слово уже правильное
  }

  let closestWord: string | null = null;
  let minDistance = maxDistance + 1;

  for (const dictWord of commonRussianWords) {
    // Проверяем только слова похожей длины
    if (Math.abs(word.length - dictWord.length) > maxDistance) continue;

    const distance = levenshteinDistance(word.toLowerCase(), dictWord);
    if (distance < minDistance && distance <= maxDistance) {
      minDistance = distance;
      closestWord = dictWord;
    }
  }

  return closestWord;
}

/**
 * Убирает лишние пробелы внутри слов
 */
function removeExtraSpaces(text: string): string {
  // Убираем пробелы между буквами внутри слов
  // Паттерн: буква + пробел(ы) + буква (внутри слова, но не между словами)
  // Используем более точный паттерн, который не затрагивает пробелы между словами
  return text.replace(/([а-яёА-ЯЁa-zA-Z])\s+([а-яёА-ЯЁa-zA-Z])/g, (match, p1, p2) => {
    // Проверяем, что это не начало нового слова (нет знаков препинания перед)
    // и не конец предыдущего слова (нет знаков препинания после)
    return p1 + p2;
  });
}

/**
 * Быстрое исправление текста (исправляет раскладку и грамматические ошибки)
 * Аналог Punto Switcher с проверкой орфографии
 * @param text - Текст для исправления
 * @returns Исправленный текст
 */
export function quickFix(text: string): string {
  if (!text || text.trim().length === 0) return text;
  
  // Шаг 1: Убираем лишние пробелы внутри слов
  let fixedText = removeExtraSpaces(text);
  
  // Шаг 2: Разбиваем текст на слова и разделители, сохраняя пробелы и знаки препинания
  const parts: Array<{ text: string; isWord: boolean }> = [];
  const wordRegex = /\b\w+\b/g;
  let lastIndex = 0;
  let match;
  
  // Находим все слова
  const wordMatches: Array<{ start: number; end: number; word: string }> = [];
  while ((match = wordRegex.exec(fixedText)) !== null) {
    wordMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      word: match[0]
    });
  }
  
  // Строим массив частей (слова и разделители)
  for (let i = 0; i < wordMatches.length; i++) {
    const wordMatch = wordMatches[i];
    
    // Добавляем текст до слова (разделители)
    if (wordMatch.start > lastIndex) {
      parts.push({ 
        text: fixedText.substring(lastIndex, wordMatch.start), 
        isWord: false 
      });
    }
    
    // Добавляем само слово
    parts.push({ 
      text: wordMatch.word, 
      isWord: true 
    });
    
    lastIndex = wordMatch.end;
  }
  
  // Добавляем оставшийся текст после последнего слова
  if (lastIndex < fixedText.length) {
    parts.push({ 
      text: fixedText.substring(lastIndex), 
      isWord: false 
    });
  }
  
  // Если не было найдено слов, возвращаем исходный текст
  if (parts.length === 0) {
    return fixedText;
  }
  
  // Шаг 3: Обрабатываем каждую часть
  const result: string[] = [];
  
  for (const part of parts) {
    if (!part.isWord) {
      // Разделители (пробелы, знаки препинания) оставляем как есть
      result.push(part.text);
      continue;
    }
    
    let word = part.text;
    
    // Шаг 3.1: Исправление раскладки
    // Если слово уже содержит русские буквы, проверяем опечатки
    if (isRussianWord(word)) {
      // Пытаемся исправить опечатку
      const corrected = findClosestWord(word, 2);
      if (corrected) {
        // Сохраняем регистр первой буквы
        if (word[0] === word[0].toUpperCase()) {
          word = corrected.charAt(0).toUpperCase() + corrected.slice(1);
        } else {
          word = corrected;
        }
      }
      result.push(word);
      continue;
    }
    
    // Если слово написано на английской раскладке и все символы можно конвертировать
    if (isConvertibleEnglishWord(word)) {
      // Конвертируем в русскую раскладку
      let fixed = convertLayout(word, 'en', 'ru');
      
      // После конвертации проверяем опечатки
      const corrected = findClosestWord(fixed, 2);
      if (corrected) {
        // Сохраняем регистр первой буквы
        if (fixed[0] === fixed[0].toUpperCase()) {
          fixed = corrected.charAt(0).toUpperCase() + corrected.slice(1);
        } else {
          fixed = corrected;
        }
      }
      
      result.push(fixed);
      continue;
    }
    
    // Если слово содержит смешанные символы, цифры или не требует исправления, оставляем как есть
    result.push(word);
  }
  
  return result.join('');
}

