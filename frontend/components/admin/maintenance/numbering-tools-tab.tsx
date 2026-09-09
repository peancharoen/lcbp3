'use client';

// File: components/admin/maintenance/numbering-tools-tab.tsx
// Feature 253 T099: Numbering Tools tab UI

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { maintenanceService, NumberingGap } from '@/lib/services/maintenance.service';
import { parseApiError } from '@/lib/api/client';
import { AxiosError } from 'axios';
import { toast } from 'sonner';

export function NumberingToolsTab() {
  const t = useTranslations();
  const [gaps, setGaps] = useState<NumberingGap[]>([]);
  const [loading, setLoading] = useState(false);
  const [counterKey, setCounterKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [reason, setReason] = useState('');

  const handleScan = async () => {
    setLoading(true);
    try {
      const data = await maintenanceService.getNumberingGaps();
      setGaps(data);
      toast.success(t('admin.maintenance.toast.scanComplete'));
    } catch (err) {
      const apiError = parseApiError(err as AxiosError);
      toast.error(t('admin.maintenance.toast.scanFailed'), { description: apiError.error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      const result = await maintenanceService.syncCounters();
      toast.success(t('admin.maintenance.toast.syncComplete', { count: result.updated }));
    } catch (err) {
      const apiError = parseApiError(err as AxiosError);
      toast.error(t('admin.maintenance.toast.syncFailed'), { description: apiError.error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async () => {
    if (!counterKey || !newValue || !reason.trim()) return;
    setLoading(true);
    try {
      const result = await maintenanceService.overrideCounter(counterKey, Number(newValue), reason);
      toast.success(
        t('admin.maintenance.toast.overrideComplete', {
          counterKey: result.counterKey,
          previousValue: result.previousValue,
          newValue: result.newValue,
        })
      );
      setReason('');
    } catch (err) {
      const apiError = parseApiError(err as AxiosError);
      toast.error(t('admin.maintenance.toast.overrideFailed'), { description: apiError.error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={handleScan} disabled={loading}>{t('admin.maintenance.scan')}</Button>
        <Button onClick={handleSync} disabled={loading} variant="outline">{t('admin.maintenance.sync')}</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.maintenance.numbering.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {gaps.length === 0 ? (
            <p className="text-muted-foreground">{t('admin.maintenance.noResults')}</p>
          ) : (
            <ul className="space-y-2">
              {gaps.map((gap) => (
                <li key={gap.counterKey} className="border p-2 rounded">
                  <p className="font-medium">{gap.counterKey}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('admin.maintenance.vector.expectedLabel')}: {gap.expectedNext},{' '}
                    {t('admin.maintenance.vector.actualLabel')}: {gap.actualNext}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('admin.maintenance.vector.missingLabel')}: {gap.missingNumbers.slice(0, 20).join(', ')}
                    {gap.missingNumbers.length > 20 ? t('admin.maintenance.vector.moreItems') : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.maintenance.numbering.overrideTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <Label htmlFor="counter-key">{t('admin.maintenance.numbering.counterKey')}</Label>
            <Input id="counter-key" value={counterKey} onChange={(e) => setCounterKey(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="new-value">{t('admin.maintenance.numbering.newLastNumber')}</Label>
            <Input id="new-value" value={newValue} onChange={(e) => setNewValue(e.target.value)} type="number" />
          </div>
          <div>
            <Label htmlFor="override-reason">{t('admin.maintenance.numbering.reason')}</Label>
            <Input id="override-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button onClick={handleOverride} disabled={loading || !reason.trim()}>
            {t('admin.maintenance.numbering.overrideAction')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
