'use client';

import { AlertTriangle } from 'lucide-react';

export function RagFallbackBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
      <AlertTriangle className="h-3 w-3" />
      ใช้ local model คุณภาพอาจลดลง
    </span>
  );
}
