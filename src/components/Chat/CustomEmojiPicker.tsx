import React, { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, X } from '../ui/icons';

interface CustomEmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  position?: { x: number; y: number };
}

// Полный список популярных эмодзи, организованных по категориям
const EMOJI_CATEGORIES = {
  'Популярные': ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🙏', '🤔', '😍', '🤯', '😱', '😴', '🤮', '💯', '🎉', '🤝', '👎', '😁', '😘', '🤗', '😊', '😎', '🥳'],
  'Эмоции': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😶‍🌫️', '😵', '😵‍💫', '🤯', '🤠', '🥳', '😎', '🤓', '🧐'],
  'Жесты': ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃'],
  'Животные': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛'],
  'Еда': ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🌽', '🥕', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕️', '🍵', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧃', '🧉', '🧊'],
  'Активности': ['⚽️', '🏀', '🏈', '⚾️', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🥅', '🏒', '🏑', '🏏', '🥍', '🏹', '🎣', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸', '🥌', '🎿', '⛷', '🏂', '🏋️‍♀️', '🏋️', '🏋️‍♂️', '🤼‍♀️', '🤼', '🤼‍♂️', '🤸‍♀️', '🤸', '🤸‍♂️', '⛹️‍♀️', '⛹️', '⛹️‍♂️', '🤺', '🤾‍♀️', '🤾', '🤾‍♂️', '🏌️‍♀️', '🏌️', '🏌️‍♂️', '🏇', '🧘‍♀️', '🧘', '🧘‍♂️', '🏄‍♀️', '🏄', '🏄‍♂️', '🏊‍♀️', '🏊', '🏊‍♂️', '🤽‍♀️', '🤽', '🤽‍♂️', '🚣‍♀️', '🚣', '🚣‍♂️', '🧗‍♀️', '🧗', '🧗‍♂️', '🚵‍♀️', '🚵', '🚵‍♂️', '🚴‍♀️', '🚴', '🚴‍♂️', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖', '🏵', '🎗', '🎫', '🎟', '🎪', '🤹‍♀️', '🤹', '🤹‍♂️', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩'],
  'Символы': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈️', '♉️', '♊️', '♋️', '♌️', '♍️', '♎️', '♏️', '♐️', '♑️', '♒️', '♓️', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚️', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕️', '🛑', '⛔️', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗️', '❓', '❕', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯️', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿️', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '▶️', '⏸', '⏯', '⏹', '⏺', '⏭', '⏮', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔃', '🔄', '🔅', '🔆', '🎵', '🎶', '➕', '➖', '➗', '✖️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔜', '🔝', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫️', '⚪️', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾️', '◽️', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛️', '⬜️', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '👁‍🗨', '💬', '💭', '🗯', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄️', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧']
};

export function CustomEmojiPicker({ onEmojiSelect, onClose, position }: CustomEmojiPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Популярные');

  // Фильтрация эмодзи по поисковому запросу
  const filteredEmojis = useMemo(() => {
    if (!searchQuery.trim()) {
      return EMOJI_CATEGORIES[selectedCategory as keyof typeof EMOJI_CATEGORIES] || [];
    }

    // Ищем во всех категориях
    const allEmojis: string[] = [];
    Object.values(EMOJI_CATEGORIES).forEach(category => {
      allEmojis.push(...category);
    });

    // Простая фильтрация - можно улучшить
    return allEmojis.filter(emoji => emoji.includes(searchQuery));
  }, [searchQuery, selectedCategory]);

  const categories = Object.keys(EMOJI_CATEGORIES);

  // Позиционирование - окно открывается над строкой ввода сообщения (как в Telegram)
  const safePosition = useMemo(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 16;
    
    // Компактное окно эмодзи - фиксированный размер
    const pickerWidth = 360;
    const pickerHeight = 450;
    
    // Если позиция не передана, открываем над строкой ввода (снизу экрана)
    if (!position || position.x === 0 || position.y === 0) {
      return {
        bottom: '80px', // Высота строки ввода + отступ
        right: `${padding}px`,
        width: `${pickerWidth}px`,
        height: `${pickerHeight}px`,
        maxHeight: `${pickerHeight}px`,
        transform: 'none'
      };
    }

    // Вычисляем позицию относительно кнопки эмодзи в строке ввода
    // position.x - это правый край кнопки, position.y - это нижний край кнопки (нижний край строки ввода)
    const buttonRight = position.x;
    const inputBarBottom = position.y; // Нижний край строки ввода (в пикселях от верха экрана)
    
    // Открываем окно НАД строкой ввода (вверх от неё)
    // Вычисляем правую позицию (от правого края экрана)
    let right = viewportWidth - buttonRight;
    
    // Выравниваем по правому краю кнопки, но не выходим за границы
    if (right + pickerWidth > viewportWidth - padding) {
      right = viewportWidth - pickerWidth - padding;
    }
    if (right < padding) {
      right = padding;
    }
    
    // Позиция снизу - от нижнего края строки ввода вверх (над строкой ввода)
    // inputBarBottom - это Y координата нижнего края строки ввода от верха экрана
    // bottom - это расстояние от нижнего края экрана, поэтому: viewportHeight - inputBarBottom
    let bottom = viewportHeight - inputBarBottom + padding; // Отступ над строкой ввода
    
    // Проверяем, не выходит ли за верхнюю границу
    const spaceAbove = viewportHeight - inputBarBottom; // Пространство над строкой ввода
    if (spaceAbove < pickerHeight + padding) {
      // Если не помещается вверх, открываем вниз от строки ввода (под ней)
      bottom = viewportHeight - inputBarBottom - pickerHeight - padding;
      // Если и вниз не помещается, прижимаем к верхней границе
      if (bottom < padding) {
        bottom = viewportHeight - pickerHeight - padding;
      }
    }
    
    // Минимальная позиция снизу
    if (bottom < padding) {
      bottom = padding;
    }
    
    return {
      bottom: `${bottom}px`,
      right: `${right}px`,
      width: `${pickerWidth}px`,
      height: `${pickerHeight}px`,
      maxHeight: `${pickerHeight}px`,
      transform: 'none'
    };
  }, [position]);

  return (
    <>
      {/* Backdrop для закрытия при клике вне */}
      <div 
        className="fixed inset-0 z-[60]" 
        onClick={onClose}
      />
      
      {/* Кастомное окно выбора эмодзи в стиле Telegram - компактное окно с анимацией */}
      <div 
        className="fixed z-[70] bg-background/95 backdrop-blur-md border border-border/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          ...safePosition,
          animation: 'emoji-picker-pop 0.2s ease-out',
          transformOrigin: 'bottom right'
        }}
      >
        {/* Header - убираем, как в Telegram */}

        {/* Поиск и категории в одном блоке */}
        <div className="p-3 border-b border-border/60 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск эмодзи..."
              className="pl-10"
            />
          </div>
          
          {/* Категории */}
          {!searchQuery && (
            <div className="overflow-x-auto flex gap-1.5">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'ghost'}
                  size="sm"
                  className="text-xs whitespace-nowrap shrink-0"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Сетка эмодзи - 8 эмодзи в строке, неограниченное количество рядов */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredEmojis.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Эмодзи не найдены
            </div>
          ) : (
            <div 
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
                width: '100%'
              }}
            >
              {filteredEmojis.map((emoji, index) => (
                <button
                  key={`${emoji}-${index}`}
                  className="aspect-square w-full p-0 text-xl hover:bg-accent/80 hover:scale-110 active:scale-95 transition-all duration-150 rounded-lg flex items-center justify-center cursor-pointer bg-transparent border-0"
                  style={{
                    minHeight: '40px',
                    minWidth: '40px'
                  }}
                  onClick={() => {
                    onEmojiSelect(emoji);
                    onClose();
                  }}
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
