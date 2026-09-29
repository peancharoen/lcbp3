// File: frontend/app/(admin)/admin/notifications/settings/page.tsx
// Change Log:
// - 2026-09-25: Initial creation (Feature 258 US4, T057) — Telegram bot status + global enable toggle (FR-019)
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage } from '@/types/api-error';
import { Send, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

import { useTelegramSettings, usePatchTelegramSettings } from '@/hooks/use-notification-admin';

function StatusRow({ label, ok, detail }: { label: string; ok: boolean | null; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-2 text-sm">
        {detail && <span className="text-muted-foreground">{detail}</span>}
        {ok === null ? (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        ) : ok ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive" />
        )}
      </span>
    </div>
  );
}

export default function NotificationSettingsPage() {
  const { data: settings, isLoading, isError, error } = useTelegramSettings();
  const patchSettings = usePatchTelegramSettings();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Notification Settings</h1>
        <p className="text-muted-foreground mt-1">Telegram bot status and global controls</p>
      </div>

      {isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {getApiErrorMessage(error, 'Failed to load settings')}
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full max-w-2xl" />
      ) : (
        <div className="grid gap-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" /> Telegram Bot
              </CardTitle>
              <CardDescription>Status of the dedicated DMS Telegram bot (secrets are never exposed)</CardDescription>
            </CardHeader>
            <CardContent>
              <StatusRow label="Bot token configured" ok={settings?.botTokenConfigured ?? false} />
              <StatusRow label="Webhook secret configured" ok={settings?.webhookSecretConfigured ?? false} />
              <StatusRow
                label="Bot reachable (getMe)"
                ok={settings?.botReachable ?? null}
                detail={settings?.botInfo?.username ? `@${settings.botInfo.username}` : undefined}
              />
              <StatusRow
                label="Bot username"
                ok={!!settings?.botUsername}
                detail={settings?.botUsername ? `@${settings.botUsername}` : 'not configured'}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Global Toggle</CardTitle>
              <CardDescription>Enable or disable all Telegram notifications system-wide</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="telegram-enabled">Telegram notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    {settings?.enabled
                      ? 'Currently enabled — DMs and project group posts are being sent'
                      : 'Currently disabled — queued Telegram jobs will be skipped'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={settings?.enabled ? 'default' : 'secondary'}>
                    {settings?.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <Switch
                    id="telegram-enabled"
                    checked={settings?.enabled ?? false}
                    disabled={patchSettings.isPending}
                    onCheckedChange={(checked) => patchSettings.mutate({ enabled: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
