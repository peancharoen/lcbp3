import { RFAForm } from "@/components/rfas/form";

export default function NewRFAPage() {
  return (
    <div className="max-w-4xl mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">New RFA</h1>
        <p className="text-muted-foreground mt-1">
          Create a new Request for Approval.
        </p>
      </div>

      <RFAForm />
    </div>
  );
}
