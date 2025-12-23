"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { documentNumberingService } from "@/lib/services/document-numbering.service";

export function BulkImportForm({ projectId = 1 }: { projectId?: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId.toString());

      await documentNumberingService.bulkImport(formData);
      toast.success("Bulk import initiated. Check audit logs for progress.");
      setFile(null);
    } catch (error) {
      toast.error("Failed to import numbers.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border p-4 rounded-md space-y-4">
       <h3 className="text-lg font-medium">Bulk Import Numbers</h3>
       <p className="text-sm text-gray-500">Import legacy numbers via CSV to reserve them in the system.</p>

       <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="csv-file">CSV File</Label>
          <Input id="csv-file" type="file" accept=".csv,.xlsx" onChange={handleFileChange} />
       </div>

       <Button onClick={handleUpload} disabled={!file || loading}>
         {loading ? "Importing..." : "Upload & Import"}
       </Button>
    </div>
  );
}
