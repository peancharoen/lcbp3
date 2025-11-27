// File: lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * ฟังก์ชันสำหรับรวม ClassNames โดยใช้ clsx และ tailwind-merge
 * ช่วยแก้ปัญหา class conflict ของ Tailwind
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}