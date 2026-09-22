// File: frontend/components/migration/replace-file-dialog.tsx
// Change Log:
// - 2026-09-16: Initial creation — dialog เปลี่ยนไฟล์ต้นฉบับของ queue item:
//   tab "staging" เลือก PDF จาก Legacy NAS (folder tree + file list ผ่าน
//   GET /migration/legacy-folders + legacy-folder-files), tab "upload"
//   อัปโหลดจากเครื่องผ่าน POST /files/upload — ทั้งคู่ลงท้าย PATCH
//   /migration/queue/:publicId/file (backend auto re-extract หลังผูกไฟล์)
// - 2026-09-21: UX fix — dialog max-w-4xl, split pane 2:3, filename filter
//   (debounce → server-side q param ก่อน cap), ชื่อไฟล์ wrap + title tooltip,
//   แสดง "แสดง X/Y" + truncated hint (folder ที่มีไฟล์ >1,000 อ่าน/ค้นได้ครบ)
// - 2026-09-22: fix upload tab — เติม Content-Type: multipart/form-data (apiClient
//   default เป็น application/json → axios serialize FormData เป็น JSON → backend
//   400 "File is required")

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
const t = (key: string, params?: Record<string, string | number>): string => {
  const parts = key.split('.');
  let current: unknown = (aiMessages as Record<string, unknown>)
    .migration_review;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return key;
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current !== 'string') return key;
  if (!params) return current;
  return current.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(params[name] ?? `{{${name}}}`)
  );
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
  const [filesTotal, setFilesTotal] = useState(0);
  const [filesTruncated, setFilesTruncated] = useState(false);
  const [fileFilter, setFileFilter] = useState('');
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

  const loadFolderFiles = useCallback(async (folderPath: string, q?: string) => {
    setFilesLoading(true);
    setSelectedFile(null);
    try {
      const result = await migrationService.listLegacyFolderFiles(
        folderPath,
        q
      );
      setFolderFiles(result.files);
      setFilesTotal(result.total);
      setFilesTruncated(result.truncated);
    } catch {
      toast.error(t('replace_file_list_error'));
    } finally {
      setFilesLoading(false);
    }
  }, []);

  // debounce filter → reload ไฟล์ของ folder ที่เลือก (filter ฝั่ง server ก่อน cap)
  useEffect(() => {
    if (!open || !selectedFolder) return;
    const timer = setTimeout(() => {
      void loadFolderFiles(selectedFolder, fileFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [open, fileFilter, selectedFolder, loadFolderFiles]);

  const handleToggleFolder = useCallback((folderPath: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  }, []);

  const handleSelectFolder = useCallback((folderPath: string) => {
    setSelectedFolder(folderPath);
    setFileFilter('');
    setFolderFiles([]);
    setFilesTotal(0);
    setFilesTruncated(false);
    // โหลดไฟล์ผ่าน debounce effect ด้านบน (ไม่เรียกตรงเพื่อกัน double-fetch)
  }, []);

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
      >('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
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
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
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
            className="flex-1 min-h-0 grid grid-cols-[2fr_3fr] gap-3 mt-3"
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
            <div className="flex flex-col gap-1 min-w-0">
              <Input
                type="search"
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value)}
                placeholder={t('replace_file_filter_placeholder')}
                disabled={!selectedFolder}
                className="h-8 text-sm"
              />
              <div className="border rounded-md overflow-y-auto max-h-[45vh] p-1 flex-1">
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
                      title={file.filename}
                      className={`w-full flex items-start gap-2 px-2 py-1.5 text-left text-sm rounded hover:bg-muted ${
                        selectedFile?.fullPath === file.fullPath
                          ? 'bg-primary/10 font-medium'
                          : ''
                      }`}
                      onClick={() => setSelectedFile(file)}
                    >
                      <FileTextIcon className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
                      {/* break-all — ชื่อไฟล์ยาวต้องอ่านได้ครบ (wrap แทน truncate) */}
                      <span className="flex-1 min-w-0 break-all leading-snug">
                        {file.filename}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatSize(file.size)}
                      </span>
                    </button>
                  ))
                )}
              </div>
              {selectedFolder && !filesLoading && filesTotal > 0 && (
                <p className="text-xs text-muted-foreground px-1">
                  {t('replace_file_showing', {
                    shown: folderFiles.length,
                    total: filesTotal,
                  })}
                  {filesTruncated
                    ? ` — ${t('replace_file_truncated_hint')}`
                    : ''}
                </p>
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
