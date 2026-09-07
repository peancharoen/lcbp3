'use client';

// File: components/admin/maintenance/vector-sync-tab.tsx
// Feature 253 T101: Vector Sync tab UI

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { maintenanceService, VectorSyncItem } from '@/lib/services/maintenance.service';
import { parseApiError } from '@/lib/api/client';
import { AxiosError } from 'axios';
import { toast } from 'sonner';

export function VectorSyncTab() {
  const t = useTranslations();
  const [items, setItems] = useState<VectorSyncItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleScan = async () => {
    setLoading(true);
    try {
      const data = await maintenanceService.findMissingVectors();
      setItems(data);
      toast.success(t('admin.maintenance.toast.vectorScanComplete', { count: data.length }));
    } catch (err) {
      const apiError = parseApiError(err as AxiosError);
      toast.error(t('admin.maintenance.toast.scanFailed'), { description: apiError.error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEnqueue = async (projectPublicId: string, documentPublicId: string) => {
    setLoading(true);
    try {
      await maintenanceService.enqueueReEmbed(projectPublicId, documentPublicId);
      toast.success(t('admin.maintenance.toast.enqueueComplete'));
    } catch (err) {
      const apiError = parseApiError(err as AxiosError);
      toast.error(t('admin.maintenance.toast.enqueueFailed'), { description: apiError.error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button onClick={handleScan} disabled={loading}>{t('admin.maintenance.scan')}</Button>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.maintenance.vector.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-muted-foreground">{t('admin.maintenance.noResults')}</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.documentPublicId} className="flex justify-between items-center border p-2 rounded">
                  <div>
                    <p className="font-medium text-sm">{item.documentPublicId}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('admin.maintenance.vector.project')}: {item.projectPublicId}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleEnqueue(item.projectPublicId, item.documentPublicId)}
                    disabled={loading}
                  >
                    {t('admin.maintenance.enqueue')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
