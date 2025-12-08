// File: e:/np-dms/lcbp3/frontend/app/(dashboard)/circulation/page.tsx
// Change Log: Added circulation page under dashboard layout

import CirculationList from "@/components/CirculationList";

/**
 * หน้าแสดงรายการการหมุนเวียนเอกสาร (อยู่ใน Dashboard)
 */
export default function CirculationPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold mb-4">Circulation</h1>
      <CirculationList />
    </section>
  );
}
