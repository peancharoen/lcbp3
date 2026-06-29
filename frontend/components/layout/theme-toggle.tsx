'use client';

import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 gap-1.5"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title="Toggle white/dark mode"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {isDark ? 'White' : 'Dark'}
    </Button>
  );
}
