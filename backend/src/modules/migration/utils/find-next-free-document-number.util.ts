// File: backend/src/modules/migration/utils/find-next-free-document-number.util.ts
// Change Log:
// - 2026-09-23: สร้างใหม่ — รวม logic "หา document_number/suffix ที่ไม่ชนกัน"
//   ที่เดิม copy-paste แยกกัน 3 จุด (legacy-ingestion.service.ts x2,
//   excel-data-review.service.ts x1) ด้วย suffix pattern ต่างกัน (-D{n}/-R{n})
//   ให้เหลือ implementation เดียว ลดความเสี่ยงแก้ collision rule ที่จุดเดียวแล้วลืมอีกจุด

/**
 * หาค่าที่ไม่ชนกับของเดิม โดยเริ่มจาก base แล้วเติม suffix ไปเรื่อยๆ (n=1,2,...)
 * จนกว่า exists() จะคืน false — ใช้กันชน unique constraint (document_number)
 * หรือ intra-batch collision (in-memory Set) แล้วแต่ที่ exists() ตรวจสอบ
 *
 * @param base ค่าฐานก่อนเติม suffix (document_number หรือ revision label)
 * @param exists เช็คว่า candidate ชนหรือยัง (DB query / in-memory Set / ทั้งคู่)
 * @param makeSuffix สร้าง suffix จากตัวนับ เช่น (n) => `-D${n}` หรือ (n) => `-R${n}`
 * @param options.skipBaseCheck ข้ามการเช็ค base ตัวเอง — ใช้เมื่อ caller ทราบอยู่แล้ว
 *   ว่า base ชนแน่นอน (กันยิง exists() ซ้ำโดยไม่จำเป็น)
 * @returns ค่าที่ไม่ชน (`value`) และจำนวนครั้งที่ต้องเติม suffix (`suffixCount`,
 *   0 = base เดิมไม่ชนตั้งแต่แรก)
 */
export async function findNextFreeDocumentNumber(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
  makeSuffix: (n: number) => string,
  options?: { skipBaseCheck?: boolean }
): Promise<{ value: string; suffixCount: number }> {
  if (!options?.skipBaseCheck && !(await exists(base))) {
    return { value: base, suffixCount: 0 };
  }
  let n = 1;
  let candidate = `${base}${makeSuffix(n)}`;
  while (await exists(candidate)) {
    n += 1;
    candidate = `${base}${makeSuffix(n)}`;
  }
  return { value: candidate, suffixCount: n };
}
