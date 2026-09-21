// File: frontend/components/admin/ai/rag-console/ReOcrReplacePicker.tsx
// Change Log:
// - 2026-09-19: ADR-055 D18/D22 — candidate file picker สำหรับ re-OCR replace flow
//   (tab staging = เลือกจาก Legacy NAS tree, tab upload = two-phase upload → temp attachment)
//   pattern ตาม migration replace-file-dialog แต่ emit selection ให้ parent แทนการ PATCH เอง

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  Loader2,
  UploadIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api/client';
import {
  migrationService,
  LegacyFolderNode,
  LegacyFolderFile,
} from '@/lib/services/migration.service';
import { useRagAdminT } from './rag-admin-i18n';

/** selection ที่ picker ส่งให้ parent — XOR: staging path หรือ temp attachment (D18/D20) */
export interface ReOcrReplaceSelection {
  storageTempPath?: string;
  tempAttachmentPublicId?: string;
  /** ชื่อไฟล์ที่เลือก — ใช้แสดง filename-mismatch warning (D21) */
  filename: string;
}

interface UploadedFileResult {
  publicId?: string;
  originalFilename?: string;
}

interface FolderNodeRowProps {
  node: LegacyFolderNode;
  depth: number;
  expanded: Set<string>;
  selectedFolder: string | null;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}

/** แถวโฟลเดอร์ใน tree (recursive, unexported — single-export rule) */
function FolderNodeRow({
  node,
  depth,
  expanded,
  selectedFolder,
  onToggle,
  onSelect,
}: FolderNodeRowProps) {
  const isExpanded = expanded.has(node.path);
  const isSelected = selectedFolder === node.path;
  return (
    <div>
      <button
        type="button"
        className={`w-full flex items-center gap-1 px-2 py-1 text-left text-sm rounded hover:bg-muted ${
          isSelected ? 'bg-primary/10 font-medium' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          onSelect(node.path);
          if (!isExpanded) onToggle(node.path);
        }}
      >
        {node.children.length > 0 ? (
          <span
            role="button"
            tabIndex={-1}
            className="shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.path);
            }}
          >
            {isExpanded ? (
              <ChevronDownIcon className="w-3 h-3" />
            ) : (
              <ChevronRightIcon className="w-3 h-3" />
            )}
          </span>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {isSelected ? (
          <FolderOpenIcon className="w-4 h-4 shrink-0 text-primary" />
        ) : (
          <FolderIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isExpanded &&
        node.children.map((child) => (
          <FolderNodeRow
            key={child.path}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            selectedFolder={selectedFolder}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

export interface ReOcrReplacePickerProps {
  /** เรียกเมื่อ selection เปลี่ยน — null = ยังไม่ได้เลือก/ล้างค่า */
  onChange: (selection: ReOcrReplaceSelection | null) => void;
}

/**
 * เลือกไฟล์ candidate สำหรับ replace flow — staging (Legacy NAS tree) หรืออัปโหลดจากเครื่อง
 * upload tab: อัปโหลดเป็น temp attachment ทันทีที่เลือกไฟล์ (two-phase — ADR-016)
 */
export function ReOcrReplacePicker({ onChange }: ReOcrReplacePickerProps) {
  const t = useRagAdminT();
  const [tree, setTree] = useState<LegacyFolderNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderFiles, setFolderFiles] = useState<LegacyFolderFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<LegacyFolderFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // โหลด folder tree ครั้งเดียวตอน mount (picker อยู่ใน dialog ที่ mount เมื่อเปิด)
  useEffect(() => {
    let cancelled = false;
    setTreeLoading(true);
    migrationService
      .listLegacyFolders()
      .then((nodes) => {
        if (!cancelled) setTree(nodes);
      })
      .catch(() => {
        if (!cancelled) toast.error(t('re_ocr.replace.tree_error'));
      })
      .finally(() => {
        if (!cancelled) setTreeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const loadFolderFiles = useCallback(
    async (folderPath: string) => {
      setFilesLoading(true);
      setFolderFiles([]);
      setSelectedFile(null);
      onChange(null);
      try {
        setFolderFiles(await migrationService.listLegacyFolderFiles(folderPath));
      } catch {
        toast.error(t('re_ocr.replace.list_error'));
      } finally {
        setFilesLoading(false);
      }
    },
    [onChange, t]
  );

  const handleToggleFolder = useCallback((folderPath: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  }, []);

  const handleSelectFolder = useCallback(
    (folderPath: string) => {
      setSelectedFolder(folderPath);
      void loadFolderFiles(folderPath);
    },
    [loadFolderFiles]
  );

  const handleSelectStagingFile = (file: LegacyFolderFile) => {
    setSelectedFile(file);
    onChange({ storageTempPath: file.fullPath, filename: file.filename });
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post<
        { data?: UploadedFileResult } & UploadedFileResult
      >('/files/upload', formData);
      const uploaded = res.data?.data ?? res.data;
      if (!uploaded?.publicId) {
        throw new Error('Upload response missing publicId');
      }
      setUploadedName(uploaded.originalFilename ?? file.name);
      onChange({
        tempAttachmentPublicId: uploaded.publicId,
        filename: uploaded.originalFilename ?? file.name,
      });
    } catch {
      toast.error(t('re_ocr.replace.upload_error'));
      onChange(null);
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <Tabs
      defaultValue="staging"
      className="w-full"
      onValueChange={() => {
        // สลับ tab = เปลี่ยน source — ล้าง selection ของ tab เดิม (XOR)
        setSelectedFile(null);
        setUploadedName(null);
        onChange(null);
      }}
    >
      <TabsList className="grid grid-cols-2 w-full">
        <TabsTrigger value="staging">{t('re_ocr.replace.tab_staging')}</TabsTrigger>
        <TabsTrigger value="upload">{t('re_ocr.replace.tab_upload')}</TabsTrigger>
      </TabsList>

      <TabsContent value="staging" className="grid grid-cols-2 gap-3 mt-3">
        <div className="border rounded-md overflow-y-auto max-h-[35vh] p-1">
          {treeLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              {t('re_ocr.replace.loading')}
            </div>
          ) : tree.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3">
              {t('re_ocr.replace.no_folders')}
            </p>
          ) : (
            tree.map((node) => (
              <FolderNodeRow
                key={node.path}
                node={node}
                depth={0}
                expanded={expanded}
                selectedFolder={selectedFolder}
                onToggle={handleToggleFolder}
                onSelect={handleSelectFolder}
              />
            ))
          )}
        </div>
        <div className="border rounded-md overflow-y-auto max-h-[35vh] p-1">
          {filesLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              {t('re_ocr.replace.loading')}
            </div>
          ) : !selectedFolder ? (
            <p className="text-sm text-muted-foreground p-3">
              {t('re_ocr.replace.select_folder_hint')}
            </p>
          ) : folderFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3">
              {t('re_ocr.replace.no_files')}
            </p>
          ) : (
            folderFiles.map((file) => (
              <button
                key={file.fullPath}
                type="button"
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded hover:bg-muted ${
                  selectedFile?.fullPath === file.fullPath
                    ? 'bg-primary/10 font-medium'
                    : ''
                }`}
                onClick={() => handleSelectStagingFile(file)}
              >
                <FileTextIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span className="truncate flex-1">{file.filename}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatSize(file.size)}
                </span>
              </button>
            ))
          )}
        </div>
        {selectedFile && (
          <p className="col-span-2 text-sm font-medium" data-testid="staging-selected">
            {selectedFile.filename}
          </p>
        )}
      </TabsContent>

      <TabsContent value="upload" className="mt-3">
        <div className="border-2 border-dashed rounded-md p-6 text-center">
          <UploadIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-3">
            {t('re_ocr.replace.upload_hint')}
          </p>
          <Input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="max-w-xs mx-auto"
            disabled={uploading}
            onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
          />
          {uploading && (
            <p className="text-sm mt-2 text-muted-foreground">
              <Loader2 className="inline w-4 h-4 animate-spin mr-1" />
              {t('re_ocr.replace.uploading')}
            </p>
          )}
          {uploadedName && (
            <p className="text-sm mt-2 font-medium" data-testid="upload-selected">
              {uploadedName}
            </p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
