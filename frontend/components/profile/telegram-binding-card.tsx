// File: frontend/components/profile/telegram-binding-card.tsx
// Change Log:
// - 2026-09-25: Initial creation (Feature 258 US1, T027) — การ์ดเชื่อมต่อ Telegram DM ในหน้า Profile
'use client';

import { useState } from 'react';
import { Loader2, Send, Unlink, Link2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useTelegramStatus,
  useTelegramLinkToken,
  useUnlinkTelegram,
  useTelegramTestMessage,
} from '@/hooks/use-notification';
import { useTranslations } from '@/hooks/use-translations';

/**
 * การ์ดเชื่อมต่อ Telegram DM (deep-link flow) — ใช้ใน Profile → Notifications
 * แสดงสถานะ linked/unlinked + ปุ่มเชื่อม/ยกเลิก/ส่งข้อความทดสอบ
 */
export function TelegramBindingCard() {
  const t = useTranslations();
  const { data: status, isLoading } = useTelegramStatus();
  const linkToken = useTelegramLinkToken();
  const unlink = useUnlinkTelegram();
  const testMessage = useTelegramTestMessage();
  const [deepLink, setDeepLink] = useState<string | null>(null);

  const handleLink = () => {
    linkToken.mutate(undefined, {
      onSuccess: (data) => {
        setDeepLink(data.deepLink);
        window.open(data.deepLink, '_blank', 'noopener,noreferrer');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const linked = status?.linked === true;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{t('notification.telegram.title')}</span>
            {linked ? (
              <Badge variant="default">{t('notification.telegram.linked')}</Badge>
            ) : (
              <Badge variant="secondary">{t('notification.telegram.notLinked')}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t('notification.telegram.description')}</p>
        </div>
      </div>

      {linked && status && (
        <div className="text-sm space-y-1">
          <p>
            {t('notification.telegram.account')}:{' '}
            <span className="font-medium">{status.telegramUsername ? `@${status.telegramUsername}` : '—'}</span>
          </p>
          {status.telegramLinkedAt && (
            <p className="text-xs text-muted-foreground">
              {t('notification.telegram.linkedAt', {
                date: new Date(status.telegramLinkedAt).toLocaleString('th-TH'),
              })}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!linked ? (
          <Button size="sm" onClick={handleLink} disabled={linkToken.isPending}>
            {linkToken.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-2 h-4 w-4" />
            )}
            {t('notification.telegram.linkButton')}
          </Button>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => testMessage.mutate()} disabled={testMessage.isPending}>
              {testMessage.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {t('notification.telegram.testButton')}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" disabled={unlink.isPending}>
                  <Unlink className="mr-2 h-4 w-4" />
                  {t('notification.telegram.unlinkButton')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('notification.telegram.unlinkConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('notification.telegram.unlinkConfirmDesc')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => unlink.mutate()}>
                    {t('notification.telegram.unlinkButton')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>

      {deepLink && !linked && (
        <p className="text-xs text-muted-foreground break-all">
          {t('notification.telegram.linkHint')}{' '}
          <a href={deepLink} target="_blank" rel="noopener noreferrer" className="underline">
            {deepLink}
          </a>
        </p>
      )}
    </div>
  );
}
