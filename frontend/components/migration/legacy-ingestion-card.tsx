// File: frontend/components/migration/legacy-ingestion-card.tsx
// Change Log:
// - 2026-08-20: สร้าง Ingestion Management Card สำหรับอัปโหลด Excel และสั่งเริ่มกระบวนการ Ingest (ADR-047)
// - 2026-08-21: เปลี่ยน Excel input เป็น dropdown จาก NAS + คงไว้ซึ่ง upload option
//              เปลี่ยน Staging PDF เป็น dropdown จาก subdirectories ของ NAS
//              เปลี่ยน Project UUID เป็น Project Name dropdown (ADR-019: ไม่ expose UUID)
//              เปลี่ยน Contract Code เป็น dropdown ที่กรองตาม Project ที่เลือก

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import {
  UploadCloudIcon,
  PlayIcon,
  RefreshCwIcon,
  CheckCircle2Icon,
  ChevronDown,
  ChevronRight,
  FolderIcon,
  FolderOpenIcon,
} from 'lucide-react';
import { migrationService } from '@/lib/services/migration.service';
import { projectService } from '@/lib/services/project.service';
import { contractService } from '@/lib/services/contract.service';
import { v4 as uuidv4 } from 'uuid';
import type { Contract } from '@/types/contract';

interface LegacyIngestionCardProps {
  onIngestionStarted?: () => void;
}

interface LegacyExcelFile {
  filename: string;
  fullPath: string;
  size: number;
}

interface LegacyFolderNode {
  name: string;
  path: string;
  children: LegacyFolderNode[];
}

interface ProjectOption {
  publicId: string;
  projectCode: string;
  projectName: string;
}

/** โหมดการเลือกไฟล์ Excel: เลือกจาก NAS หรือ upload ใหม่ */
type ExcelSelectionMode = 'nas' | 'upload';

export function LegacyIngestionCard({ onIngestionStarted }: LegacyIngestionCardProps) {
  // Excel source selection
  const [excelMode, setExcelMode] = useState<ExcelSelectionMode>('nas');
  const [nasExcelFiles, setNasExcelFiles] = useState<LegacyExcelFile[]>([]);
  const [selectedNasFilePath, setSelectedNasFilePath] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Staging PDF folder selection (tree view)
  const [nasFolderTree, setNasFolderTree] = useState<LegacyFolderNode[]>([]);
  const [selectedPdfFolderPath, setSelectedPdfFolderPath] = useState<string>('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);

  // Project selection (ADR-019: ใช้ publicId ภายใน ไม่ expose ใน UI)
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectPublicId, setSelectedProjectPublicId] = useState<string>('');

  // Contract selection (กรองตาม Project ที่เลือก)
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContractCode, setSelectedContractCode] = useState<string>('');

  // Other fields
  const [sheetName, setSheetName] = useState('');
  const [resume, setResume] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // โหลดรายการ Excel files และ folders จาก NAS
  useEffect(() => {
    const loadNasResources = async () => {
      try {
        const [filesRes, foldersRes] = await Promise.all([
          migrationService.listLegacyExcelFiles(),
          migrationService.listLegacyFolders(),
        ]);
        setNasExcelFiles(filesRes);
        setNasFolderTree(foldersRes);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'ไม่สามารถโหลดรายการจาก NAS ได้';
        toast.error(errMsg);
      }
    };
    loadNasResources();
  }, []);

  // โหลดรายการ Projects สำหรับ dropdown
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const result = await projectService.getAll({ isActive: true, limit: 100 });
        // projectService.getAll อาจ return array หรือ { data: array, meta }
        const projectList: ProjectOption[] = Array.isArray(result)
          ? result.map((p: ProjectOption) => ({
              publicId: p.publicId,
              projectCode: p.projectCode,
              projectName: p.projectName,
            }))
          : (result as { data?: ProjectOption[] })?.data?.map((p) => ({
              publicId: p.publicId,
              projectCode: p.projectCode,
              projectName: p.projectName,
            })) ?? [];
        setProjects(projectList);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'ไม่สามารถโหลดรายการโครงการได้';
        toast.error(errMsg);
      }
    };
    loadProjects();
  }, []);

  // โหลดรายการ Contracts เมื่อเลือก Project ใหม่
  const loadContracts = useCallback(async (projectPublicId: string) => {
    if (!projectPublicId) {
      setContracts([]);
      setSelectedContractCode('');
      return;
    }
    try {
      const result = await contractService.getAll({ projectId: projectPublicId });
      setContracts(result);
      setSelectedContractCode('');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'ไม่สามารถโหลดรายการสัญญาได้';
      toast.error(errMsg);
      setContracts([]);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectPublicId) {
      loadContracts(selectedProjectPublicId);
    } else {
      setContracts([]);
      setSelectedContractCode('');
    }
  }, [selectedProjectPublicId, loadContracts]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handleStartIngest = async () => {
    // ตรวจสอบข้อมูลที่จำเป็น
    if (excelMode === 'nas' && !selectedNasFilePath) {
      toast.error('กรุณาเลือกไฟล์ Excel จาก NAS');
      return;
    }
    if (excelMode === 'upload' && !uploadedFile) {
      toast.error('กรุณาเลือกไฟล์ Excel (.xlsx) ที่จะอัปโหลด');
      return;
    }
    if (!selectedProjectPublicId) {
      toast.error('กรุณาเลือกโครงการ');
      return;
    }

    try {
      setUploading(true);
      setStatusMessage('กำลังเตรียมไฟล์ Excel...');

      let filePath: string;

      if (excelMode === 'nas') {
        // ใช้ path จาก NAS โดยตรง
        filePath = selectedNasFilePath;
        setStatusMessage(`ใช้ไฟล์จาก NAS: ${selectedNasFilePath}`);
      } else {
        // Upload ไฟล์ใหม่ขึ้น Server
        setStatusMessage('กำลังอัปโหลดไฟล์ Excel ขึ้นสู่ Server...');
        const uploadRes = await migrationService.uploadExcelFile(uploadedFile!);
        filePath = uploadRes.filePath;
        toast.success(`อัปโหลดไฟล์สำเร็จ: ${uploadRes.originalFilename}`);
      }

      // ส่งคำสั่งเริ่ม Streaming Ingestion
      setStatusMessage('กำลังเริ่มต้นกระบวนการ Streaming Ingestion เบื้องหลัง...');
      const idempotencyKey = `ingest-${uuidv4()}`;
      const ingestRes = await migrationService.startIngestion(
        {
          filePath,
          projectPublicId: selectedProjectPublicId,
          contractCode: selectedContractCode || undefined,
          sheetName: sheetName || undefined,
          pdfFolderPath: selectedPdfFolderPath || undefined,
          resume,
        },
        idempotencyKey
      );

      setStatusMessage(`เริ่มกระบวนการสำเร็จ (Batch ID: ${ingestRes.batchId})`);
      const summary = `นำเข้าสำเร็จ ${ingestRes.enqueuedCount ?? 0} รายการ | ข้าม ${ingestRes.skippedCount ?? 0} | ผิดพลาด ${ingestRes.errorCount ?? 0} | ทั้งหมด ${ingestRes.totalRowsProcessed ?? 0} แถว`;
      toast.success(summary);
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
        {/* --- แถวที่ 1: เลือกไฟล์ Excel (NAS หรือ Upload) + Project + Contract --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Excel source selection */}
          <div className="space-y-1.5">
            <Label htmlFor="excel-source" className="text-xs font-semibold">
              ไฟล์ Excel (.xlsx) *
            </Label>
            <Select
              value={excelMode}
              onValueChange={(value: ExcelSelectionMode) => setExcelMode(value)}
              disabled={uploading}
            >
              <SelectTrigger id="excel-source" className="text-xs">
                <SelectValue placeholder="เลือกแหล่งไฟล์" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nas">เลือกจาก NAS</SelectItem>
                <SelectItem value="upload">อัปโหลดไฟล์ใหม่</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Excel file dropdown from NAS หรือ file upload */}
          <div className="space-y-1.5">
            <Label htmlFor="excel-file" className="text-xs font-semibold">
              {excelMode === 'nas' ? 'เลือกไฟล์จาก NAS' : 'เลือกไฟล์ที่จะอัปโหลด'}
            </Label>
            {excelMode === 'nas' ? (
              <Select
                value={selectedNasFilePath}
                onValueChange={setSelectedNasFilePath}
                disabled={uploading || nasExcelFiles.length === 0}
              >
                <SelectTrigger id="excel-file" className="text-xs">
                  <SelectValue
                    placeholder={
                      nasExcelFiles.length === 0
                        ? 'ไม่พบไฟล์ใน NAS'
                        : 'เลือกไฟล์ Excel...'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {nasExcelFiles.map((file) => (
                    <SelectItem key={file.fullPath} value={file.fullPath}>
                      {file.filename} ({(file.size / 1024).toFixed(0)} KB)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="excel-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={uploading}
                className="text-xs cursor-pointer file:cursor-pointer"
              />
            )}
          </div>

          {/* Project Name dropdown (ADR-019: ไม่ expose UUID ใน UI) */}
          <div className="space-y-1.5">
            <Label htmlFor="project-name" className="text-xs font-semibold">
              ชื่อโครงการ *
            </Label>
            <Select
              value={selectedProjectPublicId}
              onValueChange={setSelectedProjectPublicId}
              disabled={uploading || projects.length === 0}
            >
              <SelectTrigger id="project-name" className="text-xs">
                <SelectValue
                  placeholder={
                    projects.length === 0
                      ? 'ไม่พบโครงการ'
                      : 'เลือกโครงการ...'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.publicId} value={project.publicId}>
                    {project.projectName} ({project.projectCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contract Code dropdown (กรองตาม Project ที่เลือก) */}
          <div className="space-y-1.5">
            <Label htmlFor="contract-code" className="text-xs font-semibold">
              รหัสคู่สัญญา (Contract Code)
            </Label>
            <Select
              value={selectedContractCode}
              onValueChange={setSelectedContractCode}
              disabled={
                uploading ||
                !selectedProjectPublicId ||
                contracts.length === 0
              }
            >
              <SelectTrigger id="contract-code" className="text-xs">
                <SelectValue
                  placeholder={
                    !selectedProjectPublicId
                      ? 'เลือกโครงการก่อน'
                      : contracts.length === 0
                        ? 'ไม่พบสัญญาในโครงการ'
                        : 'เลือกสัญญา...'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {contracts.map((contract) => (
                  <SelectItem
                    key={contract.publicId ?? contract.contractCode}
                    value={contract.contractCode}
                  >
                    {contract.contractCode} — {contract.contractName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* --- แถวที่ 2: Staging PDF folder (tree view) + Sheet name --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <Label htmlFor="staging-path" className="text-xs font-semibold">
              โฟลเดอร์ Staging PDF บน NAS
            </Label>
            <Popover open={folderPickerOpen} onOpenChange={setFolderPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="staging-path"
                  variant="outline"
                  role="combobox"
                  disabled={uploading || nasFolderTree.length === 0}
                  className="w-full justify-between text-xs font-normal"
                >
                  <span className="truncate">
                    {selectedPdfFolderPath
                      ? selectedPdfFolderPath.replace(/^.*\/([^/]+)$/, '$1/')
                      : nasFolderTree.length === 0
                        ? 'ไม่พบโฟลเดอร์ใน NAS'
                        : 'เลือกโฟลเดอร์ Staging PDF...'}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[480px] p-0" align="start">
                <div className="max-h-[320px] overflow-y-auto p-1">
                  {nasFolderTree.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      ไม่พบโฟลเดอร์ใน NAS
                    </div>
                  ) : (
                    <FolderTree
                      nodes={nasFolderTree}
                      expanded={expandedFolders}
                      onToggle={(path) => {
                        const next = new Set(expandedFolders);
                        if (next.has(path)) {
                          next.delete(path);
                        } else {
                          next.add(path);
                        }
                        setExpandedFolders(next);
                      }}
                      selectedPath={selectedPdfFolderPath}
                      onSelect={(path) => {
                        setSelectedPdfFolderPath(path);
                        setFolderPickerOpen(false);
                      }}
                    />
                  )}
                </div>
              </PopoverContent>
            </Popover>
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
              disabled={
                uploading ||
                (excelMode === 'nas' ? !selectedNasFilePath : !uploadedFile) ||
                !selectedProjectPublicId
              }
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

// --- FolderTree: recursive tree view สำหรับเลือก Staging PDF folder ---
interface FolderTreeProps {
  nodes: LegacyFolderNode[];
  expanded: Set<string>;
  onToggle: (path: string) => void;
  selectedPath: string;
  onSelect: (path: string) => void;
  depth?: number;
}

function FolderTree({
  nodes,
  expanded,
  onToggle,
  selectedPath,
  onSelect,
  depth = 0,
}: FolderTreeProps) {
  return (
    <ul className={depth === 0 ? '' : 'ml-3 border-l border-border/40 pl-1'}>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = expanded.has(node.path);
        const isSelected = selectedPath === node.path;
        return (
          <li key={node.path}>
            <div
              className={`flex items-center gap-1 rounded px-1.5 py-1 text-xs cursor-pointer hover:bg-accent ${
                isSelected ? 'bg-primary/15 text-primary font-medium' : ''
              }`}
              style={{ paddingLeft: `${depth * 12 + 6}px` }}
              onClick={() => onSelect(node.path)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(node.path);
                }
              }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 hover:bg-accent-foreground/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(node.path);
                  }}
                  aria-label={isExpanded ? 'ย่อ' : 'ขยาย'}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <span className="inline-block w-[22px] shrink-0" />
              )}
              {isExpanded && hasChildren ? (
                <FolderOpenIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <FolderIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{node.name}</span>
            </div>
            {hasChildren && isExpanded && (
              <FolderTree
                nodes={node.children}
                expanded={expanded}
                onToggle={onToggle}
                selectedPath={selectedPath}
                onSelect={onSelect}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
