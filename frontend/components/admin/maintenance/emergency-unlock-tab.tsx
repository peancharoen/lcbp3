'use client';

// File: components/admin/maintenance/emergency-unlock-tab.tsx
// Feature 253 T102: Emergency Unlock tab UI

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { maintenanceService, ReleasedLock } from '@/lib/services/maintenance.service';
import { parseApiError } from '@/lib/api/client';
import { AxiosError } from 'axios';
import { toast } from 'sonner';

export function EmergencyUnlockTab() {
  const t = useTranslations();
  const [locks, setLocks] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [purgeIds, setPurgeIds] = useState('');
  const [documentType, setDocumentType] = useState<'CORRESPONDENCE' | 'RFA' | 'TRANSMITTAL' | 'DRAWING'>('CORRESPONDENCE');
  const [loading, setLoading] = useState(false);

  const handleScan = async () => {
    setLoading(true);
    try {
      const data = await maintenanceService.scanStuckLocks();
      setLocks(data);
      setSelected(new Set());
      toast.success(t('admin.maintenance.toast.lockScanComplete', { count: data.length }));
    } catch (err) {
      const apiError = parseApiError(err as AxiosError);
      toast.error(t('admin.maintenance.toast.scanFailed'), { description: apiError.error.message });
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const handleRelease = async () => {
    setLoading(true);
    try {
      const result = await maintenanceService.releaseLocks(Array.from(selected));
      const released = result.filter((r: ReleasedLock) => r.released).length;
      toast.success(t('admin.maintenance.toast.releaseComplete', { count: released }));
      setLocks((prev) => prev.filter((k) => !selected.has(k)));
      setSelected(new Set());
    } catch (err) {
      const apiError = parseApiError(err as AxiosError);
      toast.error(t('admin.maintenance.toast.releaseFailed'), { description: apiError.error.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePurge = async () => {
    const ids = purgeIds.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return;
    setLoading(true);
    try {
      const result = await maintenanceService.bulkHardPurge(ids, documentType);
      toast.success(t('admin.maintenance.toast.hardPurgeComplete', { count: (result as unknown[]).length }));
      setPurgeIds('');
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
        <Button onClick={handleRelease} disabled={loading || selected.size === 0} variant="destructive">
          {t('admin.maintenance.release.selected')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.maintenance.unlock.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {locks.length === 0 ? (
            <p className="text-muted-foreground">{t('admin.maintenance.noResults')}</p>
          ) : (
            <ul className="space-y-2">
              {locks.map((lock) => (
                <li key={lock} className="flex items-center gap-3 border p-2 rounded">
                  <Checkbox checked={selected.has(lock)} onCheckedChange={() => toggle(lock)} />
                  <span className="text-sm font-medium">{lock}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.maintenance.unlock.purgeTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <Label htmlFor="purge-ids">{t('admin.maintenance.unlock.purgeIds')}</Label>
            <Input id="purge-ids" value={purgeIds} onChange={(e) => setPurgeIds(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="purge-type">{t('admin.maintenance.unlock.documentType')}</Label>
            <select
              id="purge-type"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as typeof documentType)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="CORRESPONDENCE">CORRESPONDENCE</option>
              <option value="RFA">RFA</option>
              <option value="TRANSMITTAL">TRANSMITTAL</option>
              <option value="DRAWING">DRAWING</option>
            </select>
          </div>
          <Button onClick={handlePurge} disabled={loading} variant="destructive">
            {t('admin.maintenance.purge')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
