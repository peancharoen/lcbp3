import { DrawingUploadForm } from "@/components/drawings/upload-form";

export default function DrawingUploadPage() {
  return (
    <div className="max-w-4xl mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Upload Drawing</h1>
        <p className="text-muted-foreground mt-1">
          Upload a new contract or shop drawing revision.
        </p>
      </div>

      <DrawingUploadForm />
    </div>
  );
}
