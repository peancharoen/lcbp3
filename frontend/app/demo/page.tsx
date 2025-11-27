// File: app/demo/page.tsx

"use client";

import { ResponsiveDataTable, ColumnDef } from "@/components/custom/responsive-data-table";
import { FileUploadZone, FileWithMeta } from "@/components/custom/file-upload-zone";
import { WorkflowVisualizer, WorkflowStep } from "@/components/custom/workflow-visualizer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// --- Mock Data ---
interface DocItem {
  id: string;
  title: string;
  status: string;
  date: string;
}

const mockData: DocItem[] = [
  { id: "RFA-001", title: "แบบก่อสร้างฐานราก", status: "Approved", date: "2023-11-01" },
  { id: "RFA-002", title: "วัสดุงานผนัง", status: "Pending", date: "2023-11-05" },
];

const columns: ColumnDef<DocItem>[] = [
  { key: "id", header: "Document No." },
  { key: "title", header: "Subject" },
  { 
    key: "status", 
    header: "Status",
    cell: (item) => (
      <Badge variant={item.status === 'Approved' ? 'default' : 'secondary'}>
        {item.status}
      </Badge>
    ) 
  },
  { key: "date", header: "Date" },
];

const mockSteps: WorkflowStep[] = [
    { id: 1, label: "ผู้รับเหมา", subLabel: "Submit", status: "completed", date: "10/11/2023" },
    { id: 2, label: "CSC", subLabel: "Review", status: "current" },
    { id: 3, label: "Designer", subLabel: "Approve", status: "pending" },
    { id: 4, label: "Owner", subLabel: "Acknowledge", status: "pending" },
];

export default function DemoPage() {
  return (
    <div className="container mx-auto py-10 space-y-10">
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">1. Responsive Data Table</h2>
        <ResponsiveDataTable 
            data={mockData} 
            columns={columns} 
            keyExtractor={(i) => i.id}
            renderMobileCard={(item) => (
                <div className="border p-4 rounded-lg shadow-sm bg-card">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-bold">{item.id}</span>
                        <Badge>{item.status}</Badge>
                    </div>
                    <p className="text-sm mb-2">{item.title}</p>
                    <div className="text-xs text-muted-foreground text-right">{item.date}</div>
                    <Button size="sm" className="w-full mt-2" variant="outline">View Detail</Button>
                </div>
            )}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">2. File Upload Zone</h2>
        <FileUploadZone 
            onFilesChanged={(files) => console.log("Files:", files)}
            accept={[".pdf", ".jpg", ".png"]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">3. Workflow Visualizer</h2>
        <div className="border p-6 rounded-lg">
             <WorkflowVisualizer steps={mockSteps} />
        </div>
      </section>
    </div>
  );
}