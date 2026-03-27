import { FileText, Image, Table2, File } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function getFileIcon(mimeType: string | null | undefined): LucideIcon {
  if (!mimeType) return File;
  if (mimeType === "application/pdf") return FileText;
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return FileText;
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return Table2;
  return File;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
