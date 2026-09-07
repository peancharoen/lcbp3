'use client';

// File: components/admin/maintenance/orphan-cleanup-tab.tsx
// Feature 253 T100: Orphan Cleanup tab UI

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { maintenanceService, OrphanFile } from '@/lib/services/maintenance.service';
import { parseApiError } from '@/lib/api/client';
import { AxiosError } from 'axios';
import { toast } from 'sonner';

export function OrphanCleanupTab() {
  const t = useTranslations();
  const [orphans, setOrphans] = useState<OrphanFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const handleScan = async () => {
    setLoading(true);
    try {
      const data = await maintenanceService.scanOrphans();
      setOrphans(data);
      setSelected(new Set());
      toast.success(t('admin.maintenance.toast.scanComplete', { count: data.length }));
    } catch (err) {
      const apiError = parseApiError(err as AxiosError);
      toast.error(t('admin.maintenance.toast.scanFailed'), { description: apiError.error.message });
    } finally {
      setLoading(false);
    }
  };

  const toggle = (path: string) => {
    const next = new Set(selected);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setSelected(next);
  };

  const handlePurge = async () => {
    setLoading(true);
    try {
      const result = await maintenanceService.purgeOrphans(Array.from(selected));
      toast.success(t('admin.maintenance.toast.purgeComplete', { count: result.deleted }));
      setOrphans((prev) => prev.filter((o) => !selected.has(o.path)));
      setSelected(new Set());
    } catch (err) {
      const apiError = parseApiError(err as AxiosError);
      toast.error(t('admin.maintenance.toast.purgeFailed'), { description: apiError.error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={handleScan} disabled={loading}>{t('admin.maintenance.scan')}</Button>
        <Button onClick={handlePurge} disabled={loading || selected.size === 0} variant="destructive">
          {t('admin.maintenance.purge.selected')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.maintenance.orphan.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {orphans.length === 0 ? (
            <p className="text-muted-foreground">{t('admin.maintenance.noResults')}</p>
          ) : (
            <ul className="space-y-2">
              {orphans.map((orphan) => (
                <li key={orphan.path} className="flex items-center gap-3 border p-2 rounded">
                  <Checkbox checked={selected.has(orphan.path)} onCheckedChange={() => toggle(orphan.path)} />
                  <div>
                    <p className="font-medium text-sm">{orphan.path}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('admin.maintenance.orphan.size')}: {orphan.sizeBytes} bytes — {orphan.reason}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
