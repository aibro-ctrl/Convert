import React, { createContext, useState, useContext, useEffect } from 'react';

type Theme = 'default' | 'dark' | 'purple' | 'emerald' | 'orange';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('app-theme');
    return (saved as Theme) || 'default';
  });

  useEffect(() => {
    // Удалить все классы тем
    document.documentElement.classList.remove('default', 'dark', 'purple', 'emerald', 'orange');
    // Добавить текущую тему
    document.documentElement.classList.add(theme);
    // Сохранить в localStorage
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

export const themes: { value: Theme; label: string }[] = [
  { value: 'default', label: 'По умолчанию' },
  { value: 'dark', label: 'Темная тема' },
  { value: 'purple', label: 'Фиолетовая' },
  { value: 'emerald', label: 'Изумрудная' },
  { value: 'orange', label: 'Оранжевая' },
];
