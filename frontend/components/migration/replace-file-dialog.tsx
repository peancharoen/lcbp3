// File: frontend/components/migration/replace-file-dialog.tsx
// Change Log:
// - 2026-09-16: Initial creation — dialog เปลี่ยนไฟล์ต้นฉบับของ queue item:
//   tab "staging" เลือก PDF จาก Legacy NAS (folder tree + file list ผ่าน
//   GET /migration/legacy-folders + legacy-folder-files), tab "upload"
//   อัปโหลดจากเครื่องผ่าน POST /files/upload — ทั้งคู่ลงท้าย PATCH
//   /migration/queue/:publicId/file (backend auto re-extract หลังผูกไฟล์)

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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api/client';
import {
  migrationService,
  LegacyFolderNode,
  LegacyFolderFile,
} from '@/lib/services/migration.service';
import aiMessages from '@/public/locales/th/ai.json';

/** i18n helper — namespace migration_review ใน ai.json (pattern เดียวกับ review page) */
const t = (key: string): string => {
  const parts = key.split('.');
  let current: unknown = (aiMessages as Record<string, unknown>)
    .migration_review;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return key;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : key;
};

interface UploadedFileResult {
  publicId?: string;
  originalFilename?: string;
}

export interface ReplaceFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** publicId (UUIDv7) ของ queue item ที่จะเปลี่ยนไฟล์ */
  queuePublicId: string;
  /** path ไฟล์ปัจจุบัน (แสดงให้ผู้ตรวจเห็นว่ากำลังแทนที่อะไร) */
  currentFilePath?: string | null;
  /** callback หลังเปลี่ยนไฟล์สำเร็จ (parent refetch item) */
  onReplaced: () => void;
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

/**
 * ReplaceFileDialog — เปลี่ยนไฟล์ต้นฉบับของ queue item ที่ไฟล์ MISSING/ว่าง
 * หรือ scan ผิด: เลือกจาก Legacy NAS staging หรืออัปโหลดจากเครื่องผู้ตรวจ
 */
export function ReplaceFileDialog({
  open,
  onOpenChange,
  queuePublicId,
  currentFilePath,
  onReplaced,
}: ReplaceFileDialogProps) {
  const [tree, setTree] = useState<LegacyFolderNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderFiles, setFolderFiles] = useState<LegacyFolderFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<LegacyFolderFile | null>(
    null
  );
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // โหลด folder tree ครั้งเดียวตอน dialog เปิด
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setTreeLoading(true);
    migrationService
      .listLegacyFolders()
      .then((nodes) => {
        if (!cancelled) setTree(nodes);
      })
      .catch(() => {
        if (!cancelled) toast.error(t('replace_file_tree_error'));
      })
      .finally(() => {
        if (!cancelled) setTreeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const loadFolderFiles = useCallback(async (folderPath: string) => {
    setFilesLoading(true);
    setFolderFiles([]);
    setSelectedFile(null);
    try {
      const files = await migrationService.listLegacyFolderFiles(folderPath);
      setFolderFiles(files);
    } catch {
      toast.error(t('replace_file_list_error'));
    } finally {
      setFilesLoading(false);
    }
  }, []);

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

  const formatSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const handleConfirmStaging = async () => {
    if (!selectedFile) return;
    setSubmitting(true);
    try {
      await migrationService.replaceQueueFile(
        queuePublicId,
        { storageTempPath: selectedFile.fullPath },
        `replace-file-${queuePublicId}-${Date.now()}`
      );
      toast.success(t('replace_file_success'));
      onReplaced();
      onOpenChange(false);
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string; userMessage?: string } };
      };
      toast.error(
        err?.response?.data?.userMessage ||
          err?.response?.data?.message ||
          t('replace_file_error')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (!localFile) return;
    setSubmitting(true);
    try {
      // two-phase upload (ADR-016): อัปโหลดเป็น temp attachment ก่อน แล้วค่อยผูกเข้า queue
      const formData = new FormData();
      formData.append('file', localFile);
      const res = await apiClient.post<
        { data?: UploadedFileResult } & UploadedFileResult
      >('/files/upload', formData);
      const uploaded = res.data?.data ?? res.data;
      if (!uploaded?.publicId) {
        throw new Error('Upload response missing publicId');
      }
      await migrationService.replaceQueueFile(
        queuePublicId,
        { tempAttachmentPublicId: uploaded.publicId },
        `replace-file-${queuePublicId}-${Date.now()}`
      );
      toast.success(t('replace_file_success'));
      onReplaced();
      onOpenChange(false);
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string; userMessage?: string } };
      };
      toast.error(
        err?.response?.data?.userMessage ||
          err?.response?.data?.message ||
          t('replace_file_error')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('replace_file_title')}</DialogTitle>
          <DialogDescription className="break-all">
            {currentFilePath
              ? `${t('replace_file_current')}: ${currentFilePath}`
              : t('replace_file_no_current')}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="staging" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="staging">
              {t('replace_file_tab_staging')}
            </TabsTrigger>
            <TabsTrigger value="upload">
              {t('replace_file_tab_upload')}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="staging"
            className="flex-1 min-h-0 grid grid-cols-2 gap-3 mt-3"
          >
            <div className="border rounded-md overflow-y-auto max-h-[45vh] p-1">
              {treeLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {t('replace_file_loading')}
                </div>
              ) : tree.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3">
                  {t('replace_file_no_folders')}
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
            <div className="border rounded-md overflow-y-auto max-h-[45vh] p-1">
              {filesLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {t('replace_file_loading')}
                </div>
              ) : !selectedFolder ? (
                <p className="text-sm text-muted-foreground p-3">
                  {t('replace_file_select_folder_hint')}
                </p>
              ) : folderFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3">
                  {t('replace_file_no_files')}
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
                    onClick={() => setSelectedFile(file)}
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
            <div className="col-span-2">
              <DialogFooter>
                <Button
                  type="button"
                  onClick={handleConfirmStaging}
                  disabled={!selectedFile || submitting}
                >
                  {submitting && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {t('replace_file_confirm')}
                </Button>
              </DialogFooter>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="flex-1 mt-3 space-y-4">
            <div className="border-2 border-dashed rounded-md p-6 text-center">
              <UploadIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">
                {t('replace_file_upload_hint')}
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="max-w-xs mx-auto"
                disabled={submitting}
                onChange={(e) =>
                  setLocalFile(e.target.files?.[0] ?? null)
                }
              />
              {localFile && (
                <p className="text-sm mt-2 font-medium">
                  {localFile.name} ({formatSize(localFile.size)})
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={handleConfirmUpload}
                disabled={!localFile || submitting}
              >
                {submitting && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {t('replace_file_upload_confirm')}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
