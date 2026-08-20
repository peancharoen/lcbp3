// File: frontend/components/migration/legacy-ingestion-card.tsx
// Change Log:
// - 2026-08-20: สร้าง Ingestion Management Card สำหรับอัปโหลด Excel และสั่งเริ่มกระบวนการ Ingest (ADR-047)

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { UploadCloudIcon, PlayIcon, RefreshCwIcon, CheckCircle2Icon } from 'lucide-react';
import { migrationService } from '@/lib/services/migration.service';
import { v4 as uuidv4 } from 'uuid';

/** Default LCBP3 project publicId — ใช้เป็นค่าเริ่มต้นในหน้า Ingestion (สามารถเปลี่ยนได้ใน UI) */
const DEFAULT_LCBP3_PROJECT_PUBLIC_ID = '01a01992-8420-7312-b8da-2a4d64133fea';

interface LegacyIngestionCardProps {
  onIngestionStarted?: () => void;
}

export function LegacyIngestionCard({ onIngestionStarted }: LegacyIngestionCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [projectPublicId, setProjectPublicId] = useState(DEFAULT_LCBP3_PROJECT_PUBLIC_ID);
  const [contractCode, setContractCode] = useState('LCBP3-C2');
  const [sheetName, setSheetName] = useState('');
  const [pdfFolderPath, setPdfFolderPath] = useState('/share/np-dms/staging_ai/');
  const [resume, setResume] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleStartIngest = async () => {
    if (!file) {
      toast.error('กรุณาเลือกไฟล์ Excel (.xlsx)');
      return;
    }
    if (!projectPublicId) {
      toast.error('กรุณาระบุ UUID โครงการ');
      return;
    }

    try {
      setUploading(true);
      setStatusMessage('กำลังอัปโหลดไฟล์ Excel ขึ้นสู่ Server...');

      // 1. Upload Excel file
      const uploadRes = await migrationService.uploadExcelFile(file);
      toast.success(`อัปโหลดไฟล์สำเร็จ: ${uploadRes.originalFilename}`);

      // 2. Start Background Streaming Ingestion
      setStatusMessage('กำลังเริ่มต้นกระบวนการ Streaming Ingestion เบื้องหลัง...');
      const idempotencyKey = `ingest-${uuidv4()}`;
      const ingestRes = await migrationService.startIngestion(
        {
          filePath: uploadRes.filePath,
          projectPublicId,
          contractCode: contractCode || undefined,
          sheetName: sheetName || undefined,
          pdfFolderPath: pdfFolderPath || undefined,
          resume,
        },
        idempotencyKey
      );

      setStatusMessage(`เริ่มกระบวนการสำเร็จ (Batch ID: ${ingestRes.batchId})`);
      toast.success('ระบบเริ่มนำเข้าเอกสารลงใน Review Queue เรียบร้อยแล้ว');
      if (onIngestionStarted) {
        onIngestionStarted();
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการนำเข้าไฟล์';
      setStatusMessage(`ล้มเหลว: ${errMsg}`);
      toast.error(errMsg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="border-primary/20 shadow-sm mb-6 bg-gradient-to-r from-background to-muted/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <UploadCloudIcon className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">นำเข้าเอกสาร Legacy ผ่านไฟล์ Excel (ADR-047)</CardTitle>
        </div>
        <CardDescription>
          อ่านข้อมูลแบบ Streaming โดยไม่กินหน่วยความจำ พร้อมส่งประมวลผล AI/OCR เบื้องหลังเข้าสู่ Review Queue
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="space-y-1.5">
            <Label htmlFor="excel-file" className="text-xs font-semibold">
              ไฟล์ Excel (.xlsx) *
            </Label>
            <Input
              id="excel-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              disabled={uploading}
              className="text-xs cursor-pointer file:cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-uuid" className="text-xs font-semibold">
              UUID โครงการ (ADR-019) *
            </Label>
            <Input
              id="project-uuid"
              value={projectPublicId}
              onChange={(e) => setProjectPublicId(e.target.value)}
              placeholder="UUIDv7 ของโครงการ"
              disabled={uploading}
              className="text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contract-code" className="text-xs font-semibold">
              รหัสคู่สัญญา (Contract Code)
            </Label>
            <Input
              id="contract-code"
              value={contractCode}
              onChange={(e) => setContractCode(e.target.value)}
              placeholder="เช่น LCBP3-C2"
              disabled={uploading}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sheet-name" className="text-xs font-semibold">
              ชื่อ Worksheet (optional)
            </Label>
            <Input
              id="sheet-name"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder="default = worksheet แรก"
              disabled={uploading}
              className="text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <Label htmlFor="staging-path" className="text-xs font-semibold">
              โฟลเดอร์ Staging PDF บน NAS
            </Label>
            <Input
              id="staging-path"
              value={pdfFolderPath}
              onChange={(e) => setPdfFolderPath(e.target.value)}
              placeholder="/share/np-dms/staging_ai/"
              disabled={uploading}
              className="text-xs font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="resume-mode"
              checked={resume}
              onCheckedChange={(checked) => setResume(Boolean(checked))}
              disabled={uploading}
            />
            <label
              htmlFor="resume-mode"
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              โหมด Resume (ทำต่อจาก Checkpoint เดิม)
            </label>
          </div>

          <div className="flex items-center gap-3">
            {statusMessage && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2Icon className="h-3.5 w-3.5 text-primary" />
                {statusMessage}
              </span>
            )}
            <Button
              onClick={handleStartIngest}
              disabled={uploading || !file}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {uploading ? (
                <>
                  <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
                  กำลังประมวลผล...
                </>
              ) : (
                <>
                  <PlayIcon className="h-4 w-4 mr-2" />
                  เริ่มการนำเข้า (Start Ingest)
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
