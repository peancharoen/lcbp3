'use client';

// File: app/(admin)/admin/doc-control/maintenance/page.tsx
// Feature 253 T098: Maintenance Console page with 4 tabs

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { NumberingToolsTab } from '@/components/admin/maintenance/numbering-tools-tab';
import { OrphanCleanupTab } from '@/components/admin/maintenance/orphan-cleanup-tab';
import { VectorSyncTab } from '@/components/admin/maintenance/vector-sync-tab';
import { EmergencyUnlockTab } from '@/components/admin/maintenance/emergency-unlock-tab';

export default function MaintenancePage() {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState('numbering');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('admin.maintenance.title')}</h1>
        <p className="text-muted-foreground">{t('admin.maintenance.subtitle')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-[600px]">
          <TabsTrigger value="numbering">{t('admin.maintenance.numbering.title')}</TabsTrigger>
          <TabsTrigger value="orphan">{t('admin.maintenance.orphan.title')}</TabsTrigger>
          <TabsTrigger value="vector">{t('admin.maintenance.vector.title')}</TabsTrigger>
          <TabsTrigger value="unlock">{t('admin.maintenance.unlock.title')}</TabsTrigger>
        </TabsList>

        <TabsContent value="numbering" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.maintenance.numbering.description')}</CardTitle>
            </CardHeader>
            <CardContent>
              <NumberingToolsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orphan" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.maintenance.orphan.description')}</CardTitle>
            </CardHeader>
            <CardContent>
              <OrphanCleanupTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vector" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.maintenance.vector.description')}</CardTitle>
            </CardHeader>
            <CardContent>
              <VectorSyncTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unlock" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.maintenance.unlock.description')}</CardTitle>
            </CardHeader>
            <CardContent>
              <EmergencyUnlockTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
