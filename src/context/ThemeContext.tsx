import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemePalette = 'retro' | 'ocean' | 'mint' | 'lavender' | 'coral' | 'dark';
export type FontSizeScale = 'normal' | 'medium' | 'large';
export type ShadowStyle = 'brutal' | 'soft' | 'flat';

export interface ThemeSettings {
  palette: ThemePalette;
  fontSize: FontSizeScale;
  shadowStyle: ShadowStyle;
  soundEnabled: boolean;
  autoNextQuestion: boolean;
  focusModeByDefault: boolean;
}

export const DEFAULT_THEME: ThemeSettings = {
  palette: 'retro',
  fontSize: 'normal',
  shadowStyle: 'brutal',
  soundEnabled: true,
  autoNextQuestion: false,
  focusModeByDefault: false,
};

const THEME_STORAGE_KEY = 'app_user_theme_settings';

interface ThemeContextType {
  theme: ThemeSettings;
  setTheme: React.Dispatch<React.SetStateAction<ThemeSettings>>;
  updateTheme: (partial: Partial<ThemeSettings>) => void;
  resetTheme: () => void;
  playClickSound: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Web Audio API lightweight sound synthesizer (no external audio files required)
const playBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(720, ctx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch (e) {
    // Ignore audio error
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeSettings>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_THEME, ...parsed };
      }
    } catch (e) {}
    return DEFAULT_THEME;
  });

  const updateTheme = (partial: Partial<ThemeSettings>) => {
    setTheme((prev) => {
      const updated = { ...prev, ...partial };
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const resetTheme = () => {
    setTheme(DEFAULT_THEME);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(DEFAULT_THEME));
  };

  const playClickSound = () => {
    if (theme.soundEnabled) {
      playBeep();
    }
  };

  // Apply theme attributes to <html> or root element
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove previous theme classes
    root.classList.remove(
      'theme-retro',
      'theme-ocean',
      'theme-mint',
      'theme-lavender',
      'theme-coral',
      'theme-dark',
      'font-scale-normal',
      'font-scale-medium',
      'font-scale-large',
      'shadow-style-brutal',
      'shadow-style-soft',
      'shadow-style-flat'
    );

    // Add active classes
    root.classList.add(`theme-${theme.palette}`);
    root.classList.add(`font-scale-${theme.fontSize}`);
    root.classList.add(`shadow-style-${theme.shadowStyle}`);

    // Clear any inline styles so theme variables take full effect seamlessly
    document.body.style.backgroundColor = '';
    document.body.style.color = '';

    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, updateTheme, resetTheme, playClickSound }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
