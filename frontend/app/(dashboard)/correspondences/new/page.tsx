import { CorrespondenceForm } from "@/components/correspondences/form";

// Force dynamic rendering to prevent build-time prerendering issues
export const dynamic = 'force-dynamic';

// Ensure this page is never statically generated
export const fetchCache = 'force-no-store';

export default function NewCorrespondencePage() {
  return (
    <div className="max-w-4xl mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">New Correspondence</h1>
        <p className="text-muted-foreground mt-1">
          Create a new official letter or communication record.
        </p>
      </div>

      <div className="bg-card border rounded-lg p-6 shadow-sm">
        <CorrespondenceForm />
      </div>
    </div>
  );
}
