// File: components/custom/file-upload-zone.tsx

"use client";

import React, { useCallback, useState } from "react";
import { UploadCloud, File, X, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface FileWithMeta extends File {
  preview?: string;
  validationError?: string;
}

interface FileUploadZoneProps {
  /** Callback เมื่อไฟล์มีการเปลี่ยนแปลง */
  onFilesChanged: (files: FileWithMeta[]) => void;
  /** ประเภทไฟล์ที่ยอมรับ (เช่น .pdf, .dwg) */
  accept?: string[];
  /** ขนาดไฟล์สูงสุด (Bytes) Default: 50MB */
  maxSize?: number;
  /** อนุญาตให้อัปโหลดหลายไฟล์หรือไม่ */
  multiple?: boolean;
  /** ไฟล์ที่มีอยู่เดิม (ถ้ามี) */
  initialFiles?: FileWithMeta[];
  className?: string;
}

/**
 * Helper: แปลง Bytes เป็นหน่วยที่อ่านง่าย
 */
const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

/**
 * FileUploadZone Component
 * รองรับ Drag & Drop, Validation และแสดงรายการไฟล์
 */
export function FileUploadZone({
  onFilesChanged,
  accept = [".pdf", ".dwg", ".docx", ".xlsx", ".zip"],
  maxSize = 50 * 1024 * 1024, // 50MB Default
  multiple = true,
  initialFiles = [],
  className,
}: FileUploadZoneProps) {
  const [files, setFiles] = useState<FileWithMeta[]>(initialFiles);
  const [isDragging, setIsDragging] = useState(false);

  // ตรวจสอบไฟล์
  const validateFile = (file: File): string | undefined => {
    // 1. Check Size
    if (file.size > maxSize) {
      return `ขนาดไฟล์เกินกำหนด (${formatBytes(maxSize)})`;
    }
    // 2. Check Type (Extension based validation for simplicity on client)
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    if (accept.length > 0 && !accept.includes(fileExtension)) {
      return `ประเภทไฟล์ไม่รองรับ (อนุญาต: ${accept.join(", ")})`;
    }
    return undefined;
  };

  const handleFileSelect = useCallback(
    (newFiles: File[]) => {
      const processedFiles: FileWithMeta[] = newFiles.map((file) => {
        const error = validateFile(file);
        // สร้าง Object ใหม่เพื่อไม่ให้กระทบ File object เดิม
        const fileWithMeta = new File([file], file.name, { type: file.type }) as FileWithMeta;
        fileWithMeta.validationError = error;
        return fileWithMeta;
      });

      setFiles((prev) => {
        const updated = multiple ? [...prev, ...processedFiles] : processedFiles;
        onFilesChanged(updated);
        return updated;
      });
    },
    [maxSize, accept, multiple, onFilesChanged]
  );

  // Drag Events
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles((prev) => {
      const updated = prev.filter((_, index) => index !== indexToRemove);
      onFilesChanged(updated);
      return updated;
    });
  };

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Drop Zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer flex flex-col items-center justify-center gap-2",
          isDragging
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/25 hover:border-primary/50",
          "h-48"
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          className="hidden"
          multiple={multiple}
          accept={accept.join(",")}
          onChange={(e) => {
            if (e.target.files) handleFileSelect(Array.from(e.target.files));
          }}
        />
        <div className="p-3 bg-muted rounded-full">
          <UploadCloud className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            คลิกเพื่อเลือกไฟล์ หรือ ลากไฟล์มาวางที่นี่
          </p>
          <p className="text-xs text-muted-foreground">
            รองรับ: {accept.join(", ")} (สูงสุด {formatBytes(maxSize)})
          </p>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <ScrollArea className="h-[200px] w-full rounded-md border p-4">
          <div className="space-y-3">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-card rounded-md border shadow-sm group"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-primary/10 rounded-md shrink-0">
                    <File className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate max-w-[200px] sm:max-w-md">
                      {file.name}
                    </p>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                        {formatBytes(file.size)}
                        </span>
                        {file.validationError ? (
                             <Badge variant="destructive" className="text-[10px] px-1 h-5 flex gap-1">
                                <AlertTriangle className="w-3 h-3" /> {file.validationError}
                             </Badge>
                        ) : (
                            <Badge variant="outline" className="text-[10px] px-1 h-5 text-green-600 bg-green-50 border-green-200 flex gap-1">
                                <CheckCircle className="w-3 h-3" /> Ready
                            </Badge>
                        )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeFile(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}