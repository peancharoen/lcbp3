import { DrawingUploadForm } from '@/components/drawings/upload-form';

// Force dynamic rendering to prevent build-time prerendering issues
export const dynamic = 'force-dynamic';

// Ensure this page is never statically generated
export const fetchCache = 'force-no-store';

export default function DrawingUploadPage() {
  return (
    <div className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Upload Drawing</h1>
        <p className="mt-1 text-muted-foreground">Upload a new contract or shop drawing revision.</p>
      </div>

      <DrawingUploadForm />
    </div>
  );
}
