import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Theme = 'light' | 'dark';

export function useTheme() {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>('light');
  const [loading, setLoading] = useState(true);

  // Apply theme to document
  const applyTheme = useCallback((newTheme: Theme) => {
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, []);

  // Load theme from DB or localStorage
  useEffect(() => {
    const loadTheme = async () => {
      // First check localStorage for immediate response
      const savedTheme = localStorage.getItem('theme') as Theme;
      if (savedTheme) {
        setThemeState(savedTheme);
        applyTheme(savedTheme);
      }

      // If user is logged in, fetch from DB
      if (user) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (data) {
            // Use type assertion for new column
            const dbTheme = (data as any).theme as Theme;
            if (dbTheme) {
              setThemeState(dbTheme);
              applyTheme(dbTheme);
              localStorage.setItem('theme', dbTheme);
            }
          }
        } catch (err) {
          console.error('Error loading theme:', err);
        }
      }

      setLoading(false);
    };

    loadTheme();
  }, [user, applyTheme]);

  // Toggle theme
  const toggleTheme = useCallback(async () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setThemeState(newTheme);
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    // Save to DB if logged in
    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ theme: newTheme } as any)
          .eq('user_id', user.id);
      } catch (err) {
        console.error('Error saving theme:', err);
      }
    }
  }, [theme, user, applyTheme]);

  // Set specific theme
  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ theme: newTheme } as any)
          .eq('user_id', user.id);
      } catch (err) {
        console.error('Error saving theme:', err);
      }
    }
  }, [user, applyTheme]);

  return {
    theme,
    loading,
    toggleTheme,
    setTheme,
    isDark: theme === 'dark',
  };
}
