# Two-Phase File Upload (Frontend)

Pair with [backend two-phase upload rule](../nestjs-best-practices/rules/security-file-two-phase-upload.md).

## Flow

```
User drops file
   → POST /files/upload (temp)         → { tempId, expiresAt }
   → store tempId in form state
   → user submits form
   → POST /correspondences (with tempFileIds)  → backend commits in transaction
```

## Hook Pattern

```tsx
'use client';

import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';

export function useTwoPhaseUpload() {
  const uploadTemp = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await apiClient.post<{ tempId: string; expiresAt: string }>(
        '/files/upload',
        fd,
      );
      return data;
    },
  });

  return uploadTemp;
}
```

## Form Integration (RHF)

```tsx
export function CorrespondenceForm() {
  const form = useForm<FormData>({ resolver: zodResolver(schema) });
  const uploadTemp = useTwoPhaseUpload();
  const [tempFileIds, setTempFileIds] = useState<string[]>([]);

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'image/vnd.dwg': ['.dwg'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/zip': ['.zip'],
    },
    maxSize: 50 * 1024 * 1024, // 50 MB — must match backend
    onDrop: async (files) => {
      const results = await Promise.all(files.map((f) => uploadTemp.mutateAsync(f)));
      setTempFileIds((prev) => [...prev, ...results.map((r) => r.tempId)]);
    },
  });

  const onSubmit = async (values: FormData) => {
    await correspondenceService.create({
      ...values,
      tempFileIds, // committed server-side in the same DB transaction
    });
    setTempFileIds([]);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div {...getRootProps()} className="dropzone">
        <input {...getInputProps()} />
        <p>{t('upload.dragDrop')}</p>
      </div>
      {/* other fields */}
    </form>
  );
}
```

## Rules

- **Whitelist MIME types** — must mirror backend ADR-016 whitelist (`.pdf`, `.dwg`, `.docx`, `.xlsx`, `.zip`).
- **50 MB cap** — enforce client-side too (better UX) plus server-side (authoritative).
- **Show temp-file pills** with remove button — users see what will be attached.
- **Clear `tempFileIds` on success/cancel** — prevent stale IDs on subsequent submits.
- **No retry of expired temps** — if `expiresAt` passed, prompt re-upload.

## ❌ Forbidden

- ❌ Uploading directly to permanent storage endpoint (no commit phase)
- ❌ Hardcoded MIME list in component (keep in shared constant file mirrored from backend)
- ❌ Ignoring `maxSize` — backend will reject but UX suffers

## Reference

- [ADR-016 Security](../../../specs/06-Decision-Records/ADR-016-security-authentication.md)
- Backend rule: [`security-file-two-phase-upload.md`](../nestjs-best-practices/rules/security-file-two-phase-upload.md)
