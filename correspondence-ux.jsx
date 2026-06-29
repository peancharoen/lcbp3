import { useState, useRef, useEffect } from "react";

// ── Palette & helpers ──────────────────────────────────────────────────────
const STATUS_META = {
  DRAFT:    { label: "Draft",         bg: "#1E293B", text: "#94A3B8", border: "#334155" },
  SUBOWN:   { label: "Submitted",     bg: "#0C1A2E", text: "#38BDF8", border: "#0369A1" },
  PENDING:  { label: "Pending Reply", bg: "#1C0A00", text: "#FB923C", border: "#C2410C" },
  APPROVED: { label: "Approved",      bg: "#052E16", text: "#4ADE80", border: "#15803D" },
  REJECTED: { label: "Rejected",      bg: "#2D0A0A", text: "#F87171", border: "#B91C1C" },
  CLOSED:   { label: "Closed",        bg: "#1A1A2E", text: "#A78BFA", border: "#7C3AED" },
};

const PROJECTS = [
  { code: "LCBP3", name: "Laem Chabang Basin Phase 3" },
  { code: "LCBP2", name: "Laem Chabang Basin Phase 2" },
  { code: "PILOT", name: "Pilot Project" },
];
const TYPES = ["Letter", "RFI", "Notice", "Instruction", "Report", "Memo"];
const DISCIPLINES = ["GEN – General", "STR – Structural", "MEP – Mechanical", "ARC – Architecture", "CIV – Civil"];
const ORGS = ["กทท. (PAT)", "TEAM Consulting", "CHINA HARBOUR", "Third Party Inspector"];

const MOCK_DATA = [
  {
    id: 1, uuid: "c1a2b3c4", number: "LCBP3-LTR-2026-0042",
    type: "Letter", discipline: "GEN", isInternal: false,
    originator: "CHINA HARBOUR", project: "LCBP3",
    recipients: [{ org: "กทท. (PAT)", type: "TO" }, { org: "TEAM Consulting", type: "CC" }],
    tags: ["Urgent", "Schedule"],
    revisions: [
      {
        id: 10, revNo: 0, label: "0", isCurrent: false, status: "APPROVED",
        subject: "Request for Extension of Time – Phase 2 Piling Works",
        description: "Initial submission requesting EOT due to unforeseen ground conditions.",
        body: "In accordance with Clause 44 of the Contract, we hereby formally request an extension of time for the Phase 2 piling works...",
        remarks: "Supporting geotechnical report attached.",
        docDate: "2026-01-10", issuedDate: "2026-01-12", receivedDate: "2026-01-13", dueDate: "2026-02-12",
        createdBy: "John Smith", updatedBy: null,
        attachments: [
          { id: 1, name: "EOT-Request-Rev0.pdf", size: 2457600, mime: "application/pdf", isMain: true },
          { id: 2, name: "Geotech-Report.pdf", size: 8912000, mime: "application/pdf", isMain: false },
        ],
      },
      {
        id: 11, revNo: 1, label: "1", isCurrent: true, status: "PENDING",
        subject: "Request for Extension of Time – Phase 2 Piling Works (Rev.1)",
        description: "Revised submission incorporating PAT's comments dated 2026-02-01.",
        body: "Following PAT's comments dated 2026-02-01, we have revised our EOT request as follows...",
        remarks: "Updated programme attached. Previous geotechnical report remains unchanged.",
        docDate: "2026-02-08", issuedDate: "2026-02-10", receivedDate: null, dueDate: "2026-03-10",
        createdBy: "John Smith", updatedBy: "Jane Doe",
        attachments: [
          { id: 3, name: "EOT-Request-Rev1.pdf", size: 3012000, mime: "application/pdf", isMain: true },
          { id: 4, name: "Updated-Programme.xlsx", size: 512000, mime: "application/vnd.ms-excel", isMain: false },
          { id: 2, name: "Geotech-Report.pdf", size: 8912000, mime: "application/pdf", isMain: false },
        ],
      },
    ],
    references: ["LCBP3-LTR-2026-0018", "LCBP3-RFI-2025-0091"],
    createdAt: "2026-01-10",
  },
  {
    id: 2, uuid: "d2e3f4a5", number: "LCBP3-RFI-2026-0011",
    type: "RFI", discipline: "STR", isInternal: false,
    originator: "CHINA HARBOUR", project: "LCBP3",
    recipients: [{ org: "TEAM Consulting", type: "TO" }],
    tags: ["Technical"],
    revisions: [
      {
        id: 20, revNo: 0, label: "0", isCurrent: true, status: "SUBOWN",
        subject: "Clarification on Pile Cap Reinforcement Detail – Drawing STR-PC-105",
        description: "Request for information regarding conflicting dimensions in pile cap drawing.",
        body: "Please clarify the discrepancy between the plan dimension (4500mm) and section detail (4200mm) on Drawing STR-PC-105...",
        remarks: "",
        docDate: "2026-03-05", issuedDate: "2026-03-06", receivedDate: null, dueDate: "2026-03-20",
        createdBy: "Alice Chen", updatedBy: null,
        attachments: [
          { id: 5, name: "RFI-011-Query.pdf", size: 1245000, mime: "application/pdf", isMain: true },
          { id: 6, name: "STR-PC-105-marked.pdf", size: 3100000, mime: "application/pdf", isMain: false },
        ],
      },
    ],
    references: [],
    createdAt: "2026-03-05",
  },
  {
    id: 3, uuid: "e5f6a7b8", number: "LCBP3-NTC-2026-0007",
    type: "Notice", discipline: "GEN", isInternal: true,
    originator: "กทท. (PAT)", project: "LCBP3",
    recipients: [{ org: "CHINA HARBOUR", type: "TO" }, { org: "TEAM Consulting", type: "CC" }],
    tags: ["HSE", "Urgent"],
    revisions: [
      {
        id: 30, revNo: 0, label: "0", isCurrent: true, status: "CLOSED",
        subject: "Non-Conformance Notice – Safety Barrier Installation at Gate 3",
        description: "Formal notice of non-conformance regarding inadequate safety barriers.",
        body: "This is to formally notify that the safety barrier installation at Gate 3 does not comply with approved method statement MS-HSE-012...",
        remarks: "Immediate remedial action required within 48 hours.",
        docDate: "2026-02-20", issuedDate: "2026-02-20", receivedDate: "2026-02-21", dueDate: "2026-02-22",
        createdBy: "PAT Safety", updatedBy: "PAT Safety",
        attachments: [
          { id: 7, name: "NCN-007-Notice.pdf", size: 980000, mime: "application/pdf", isMain: true },
          { id: 8, name: "Photo-Evidence.zip", size: 15000000, mime: "application/zip", isMain: false },
        ],
      },
    ],
    references: ["LCBP3-LTR-2026-0031"],
    createdAt: "2026-02-20",
  },
];

// ── Utility components ─────────────────────────────────────────────────────
function StatusBadge({ code }) {
  const m = STATUS_META[code] || { label: code, bg: "#1E293B", text: "#94A3B8", border: "#334155" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
      padding: "2px 8px", borderRadius: 3,
      background: m.bg, color: m.text, border: `1px solid ${m.border}`,
      textTransform: "uppercase",
    }}>{m.label}</span>
  );
}

function TypeBadge({ type }) {
  const colors = { Letter: "#F59E0B", RFI: "#38BDF8", Notice: "#F87171", Instruction: "#A78BFA", Report: "#4ADE80", Memo: "#94A3B8" };
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
      padding: "2px 6px", borderRadius: 2,
      background: `${colors[type] || "#94A3B8"}22`,
      color: colors[type] || "#94A3B8",
      border: `1px solid ${colors[type] || "#94A3B8"}55`,
    }}>{type.toUpperCase()}</span>
  );
}

function TagPill({ label }) {
  return (
    <span style={{
      fontSize: 10, padding: "1px 7px", borderRadius: 10,
      background: "#1E293B", color: "#64748B", border: "1px solid #334155",
    }}>{label}</span>
  );
}

function FileIcon({ mime }) {
  if (mime?.includes("pdf")) return <span style={{ color: "#F87171" }}>📄</span>;
  if (mime?.includes("excel") || mime?.includes("sheet")) return <span style={{ color: "#4ADE80" }}>📊</span>;
  if (mime?.includes("zip") || mime?.includes("compressed")) return <span style={{ color: "#F59E0B" }}>📦</span>;
  return <span style={{ color: "#94A3B8" }}>📎</span>;
}

function formatBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(0) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

// ── Flow Diagram Component ─────────────────────────────────────────────────
function FlowDiagram({ onClose }) {
  const flows = [
    { step: "1", icon: "📝", title: "สร้าง Master Record", sub: "correspondences table", desc: "กำหนด Type, Number, Originator, Project, Recipients (TO/CC), Tags", color: "#F59E0B" },
    { step: "2", icon: "📋", title: "สร้าง Revision 0", sub: "correspondence_revisions (is_current=true)", desc: "ใส่เนื้อหา: Subject, Body, Dates, Status=DRAFT, Details JSON", color: "#38BDF8" },
    { step: "3", icon: "⬆️", title: "Upload ไฟล์แนบ (Phase 1)", sub: "attachments (is_temporary=true)", desc: "อัปโหลดล่วงหน้า ได้ temp_id กลับมา ไฟล์ยังไม่ Commit", color: "#A78BFA" },
    { step: "4", icon: "🔗", title: "Commit ไฟล์ (Phase 2)", sub: "correspondence_revision_attachments", desc: "ผูก temp attachment → revision ด้วย is_main_document flag, set is_temporary=false", color: "#4ADE80" },
    { step: "5", icon: "✉️", title: "Submit / ส่งเอกสาร", sub: "status: DRAFT → SUBOWN", desc: "เปลี่ยน Status, บันทึก issued_date, แจ้งเตือน Recipient", color: "#FB923C" },
    { step: "6", icon: "🔄", title: "เพิ่ม Revision ใหม่", sub: "correspondence_revisions (revision_number++)", desc: "set is_current=false บน Rev เก่า, สร้าง Rev ใหม่ is_current=true", color: "#F87171" },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#0F172A", border: "1px solid #1E293B", borderRadius: 12,
        padding: 32, maxWidth: 760, width: "90%", maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ color: "#F59E0B", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>UX FLOW DIAGRAM</div>
            <h2 style={{ color: "#F1F5F9", fontSize: 20, fontWeight: 700, margin: "4px 0 0" }}>Correspondence Lifecycle</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748B", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {/* DB Relationship */}
        <div style={{ background: "#0A1525", borderRadius: 8, padding: 16, marginBottom: 24, border: "1px solid #1E293B" }}>
          <div style={{ color: "#64748B", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 12 }}>TABLE RELATIONSHIP (Master-Revision Pattern)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {[
              { label: "correspondences", role: "MASTER", color: "#F59E0B" },
              { arrow: "1:N" },
              { label: "correspondence_revisions", role: "REVISIONS", color: "#38BDF8" },
              { arrow: "M:N" },
              { label: "attachments", role: "FILES", color: "#A78BFA" },
            ].map((item, i) => item.arrow ? (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, color: "#475569", fontSize: 11 }}>
                <div style={{ width: 20, height: 1, background: "#334155" }} />
                <span style={{ fontSize: 9, fontWeight: 700, background: "#1E293B", padding: "2px 5px", borderRadius: 3 }}>{item.arrow}</span>
                <div style={{ width: 20, height: 1, background: "#334155" }} />
              </div>
            ) : (
              <div key={i} style={{
                background: `${item.color}15`, border: `1px solid ${item.color}44`,
                borderRadius: 6, padding: "6px 12px", textAlign: "center",
              }}>
                <div style={{ color: item.color, fontSize: 11, fontWeight: 700 }}>{item.label}</div>
                <div style={{ color: "#475569", fontSize: 9 }}>{item.role}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["correspondence_recipients (M:N)", "correspondence_tags (M:N)", "correspondence_references (M:N)", "correspondence_revision_attachments (Junction)"].map(t => (
              <span key={t} style={{ fontSize: 9, color: "#475569", background: "#1E293B", padding: "2px 7px", borderRadius: 3 }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Flow Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {flows.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{
                minWidth: 32, height: 32, borderRadius: "50%",
                background: `${f.color}22`, border: `2px solid ${f.color}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 800, color: f.color,
              }}>{f.step}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#F1F5F9", fontSize: 14, fontWeight: 600 }}>{f.icon} {f.title}</span>
                  <span style={{ fontSize: 10, color: f.color, background: `${f.color}15`, padding: "1px 7px", borderRadius: 3, fontFamily: "monospace" }}>{f.sub}</span>
                </div>
                <div style={{ color: "#64748B", fontSize: 12, marginTop: 2 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Key UX Rules */}
        <div style={{ marginTop: 24, background: "#0A1525", borderRadius: 8, padding: 16, border: "1px solid #1E293B" }}>
          <div style={{ color: "#64748B", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 10 }}>KEY UX RULES</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              "correspondence_number สร้างอัตโนมัติ (DocumentNumberingModule) — ผู้ใช้เลือก Type เท่านั้น",
              "ไฟล์แนบ upload ก่อน → ได้ temp_id → commit หลัง save form (Two-Phase)",
              "is_current เปลี่ยนได้เพียง 1 Revision ต่อ Correspondence เท่านั้น",
              "แต่ละ Revision มีชุดไฟล์แนบเป็นของตัวเอง ผ่าน correspondence_revision_attachments",
              "Revision ใหม่ copy เนื้อหาจาก Rev ล่าสุด เพื่อลดการพิมพ์ซ้ำ",
              "Recipients (TO/CC) ผูกกับ Master ไม่ใช่ Revision — เปลี่ยนได้ตลอด",
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 11, color: "#94A3B8" }}>
                <span style={{ color: "#F59E0B", minWidth: 14 }}>→</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create Correspondence Wizard ───────────────────────────────────────────
function CreateWizard({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    type: "", discipline: "", isInternal: false, originator: "", project: "LCBP3",
    toOrgs: [], ccOrgs: [],
    subject: "", body: "", remarks: "", docDate: "", dueDate: "", status: "DRAFT",
    files: [], mainFileIdx: null,
  });
  const fileRef = useRef();

  const STEPS = ["Basic Info", "Content", "Attachments", "Review"];
  const total = 4;

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addFile = (e) => {
    const newFiles = Array.from(e.target.files).map(file => ({
      name: file.name, size: file.size, mime: file.type,
      tempId: "tmp_" + Math.random().toString(36).slice(2), isMain: false,
    }));
    setForm(f => ({ ...f, files: [...f.files, ...newFiles] }));
  };

  const toggleRecipient = (org, type) => {
    const key = type === "TO" ? "toOrgs" : "ccOrgs";
    const arr = form[key];
    setForm(f => ({ ...f, [key]: arr.includes(org) ? arr.filter(x => x !== org) : [...arr, org] }));
  };

  const inputStyle = {
    width: "100%", background: "#0A1525", border: "1px solid #1E293B",
    color: "#F1F5F9", padding: "8px 12px", borderRadius: 6, fontSize: 13,
    outline: "none", boxSizing: "border-box",
  };

  const labelStyle = { color: "#64748B", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", marginBottom: 4, display: "block" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 12, width: 640, maxHeight: "92vh", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 0", borderBottom: "1px solid #1E293B" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ color: "#F59E0B", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em" }}>NEW DOCUMENT</div>
              <h3 style={{ color: "#F1F5F9", fontSize: 17, fontWeight: 700, margin: "2px 0 0" }}>Create Correspondence</h3>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", fontSize: 18, cursor: "pointer" }}>✕</button>
          </div>
          {/* Step indicators */}
          <div style={{ display: "flex", gap: 0, marginBottom: -1 }}>
            {STEPS.map((s, i) => (
              <button key={i} onClick={() => i + 1 < step && setStep(i + 1)} style={{
                flex: 1, padding: "8px 0", border: "none", cursor: i + 1 < step ? "pointer" : "default",
                background: "none", borderBottom: `2px solid ${step === i + 1 ? "#F59E0B" : step > i + 1 ? "#334155" : "transparent"}`,
                color: step === i + 1 ? "#F59E0B" : step > i + 1 ? "#64748B" : "#334155",
                fontSize: 12, fontWeight: 600,
              }}>
                <span style={{
                  display: "inline-block", width: 18, height: 18, borderRadius: "50%",
                  background: step > i + 1 ? "#1E293B" : step === i + 1 ? "#F59E0B" : "#1E293B",
                  color: step > i + 1 ? "#64748B" : step === i + 1 ? "#0F172A" : "#334155",
                  fontSize: 10, fontWeight: 800, lineHeight: "18px", marginRight: 6,
                }}>{step > i + 1 ? "✓" : i + 1}</span>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "24px" }}>
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={labelStyle}>DOCUMENT TYPE *</label>
                  <select style={inputStyle} value={form.type} onChange={e => update("type", e.target.value)}>
                    <option value="">— Select type —</option>
                    {TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>DISCIPLINE</label>
                  <select style={inputStyle} value={form.discipline} onChange={e => update("discipline", e.target.value)}>
                    <option value="">— None —</option>
                    {DISCIPLINES.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>DOCUMENT NUMBER</label>
                <div style={{ ...inputStyle, color: "#475569", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#334155", fontSize: 12 }}>⚙</span>
                  <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                    {form.type ? `LCBP3-${form.type.slice(0,3).toUpperCase()}-2026-XXXX` : "เลือก Type เพื่อ Preview เลขที่"}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 10, background: "#1E293B", padding: "2px 6px", borderRadius: 3, color: "#64748B" }}>Auto-generated</span>
                </div>
              </div>
              <div>
                <label style={labelStyle}>ORIGINATOR (ผู้ส่ง) *</label>
                <select style={inputStyle} value={form.originator} onChange={e => update("originator", e.target.value)}>
                  <option value="">— Select organization —</option>
                  {ORGS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>RECIPIENTS</label>
                <div style={{ background: "#0A1525", border: "1px solid #1E293B", borderRadius: 6, overflow: "hidden" }}>
                  {ORGS.filter(o => o !== form.originator).map(org => (
                    <div key={org} style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #1E293B", gap: 12 }}>
                      <span style={{ flex: 1, color: "#94A3B8", fontSize: 13 }}>{org}</span>
                      {["TO", "CC"].map(type => (
                        <button key={type} onClick={() => toggleRecipient(org, type)} style={{
                          padding: "3px 12px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700,
                          background: (type === "TO" ? form.toOrgs : form.ccOrgs).includes(org) ? (type === "TO" ? "#0369A1" : "#1E293B") : "transparent",
                          color: (type === "TO" ? form.toOrgs : form.ccOrgs).includes(org) ? (type === "TO" ? "#38BDF8" : "#94A3B8") : "#334155",
                          border: `1px solid ${(type === "TO" ? form.toOrgs : form.ccOrgs).includes(org) ? (type === "TO" ? "#0369A1" : "#475569") : "#1E293B"}`,
                        }}>{type}</button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" id="isInternal" checked={form.isInternal} onChange={e => update("isInternal", e.target.checked)}
                  style={{ accentColor: "#F59E0B", width: 16, height: 16 }} />
                <label htmlFor="isInternal" style={{ color: "#94A3B8", fontSize: 13, cursor: "pointer" }}>
                  Internal Communication (การสื่อสารภายในองค์กร)
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#0A1525", border: "1px solid #1E293B", borderRadius: 6, padding: 12 }}>
                <div style={{ color: "#64748B", fontSize: 10, fontWeight: 700, marginBottom: 4 }}>REVISION</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 20, color: "#F59E0B", fontWeight: 800 }}>Rev. 0</span>
                  <span style={{ fontSize: 11, color: "#475569" }}>• First submission — Revision 0 จะสร้างอัตโนมัติ (is_current=true)</span>
                </div>
              </div>
              <div>
                <label style={labelStyle}>SUBJECT *</label>
                <input style={inputStyle} placeholder="หัวข้อเรื่อง" value={form.subject} onChange={e => update("subject", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>BODY (เนื้อความ)</label>
                <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical" }} placeholder="เนื้อหาเอกสาร..." value={form.body} onChange={e => update("body", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>REMARKS</label>
                <input style={inputStyle} placeholder="หมายเหตุ" value={form.remarks} onChange={e => update("remarks", e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={labelStyle}>DOCUMENT DATE</label>
                  <input type="date" style={inputStyle} value={form.docDate} onChange={e => update("docDate", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>DUE DATE</label>
                  <input type="date" style={inputStyle} value={form.dueDate} onChange={e => update("dueDate", e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>INITIAL STATUS</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["DRAFT", "SUBOWN"].map(s => (
                    <button key={s} onClick={() => update("status", s)} style={{
                      padding: "6px 16px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 700,
                      background: form.status === s ? STATUS_META[s].bg : "transparent",
                      color: form.status === s ? STATUS_META[s].text : "#475569",
                      border: `1px solid ${form.status === s ? STATUS_META[s].border : "#1E293B"}`,
                    }}>{STATUS_META[s].label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#0A1525", border: "1px dashed #334155", borderRadius: 8, padding: 24, textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>⬆️</div>
                <div style={{ color: "#94A3B8", fontSize: 14, marginBottom: 4 }}>Phase 1: Upload ไฟล์แนบ</div>
                <div style={{ color: "#475569", fontSize: 12, marginBottom: 16 }}>ไฟล์จะถูกเก็บชั่วคราว (is_temporary=true) จนกว่าจะ Save</div>
                <button onClick={() => fileRef.current?.click()} style={{
                  background: "#1E293B", border: "1px solid #334155", color: "#94A3B8",
                  padding: "8px 20px", borderRadius: 6, cursor: "pointer", fontSize: 13,
                }}>Browse Files…</button>
                <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={addFile} />
              </div>
              {form.files.length > 0 && (
                <div>
                  <div style={{ color: "#64748B", fontSize: 10, fontWeight: 700, marginBottom: 8 }}>UPLOADED FILES — Phase 2: กำหนด Main Document</div>
                  {form.files.map((file, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                      background: "#0A1525", border: "1px solid #1E293B", borderRadius: 6, marginBottom: 6,
                    }}>
                      <FileIcon mime={file.mime} />
                      <div style={{ flex: 1 }}>
                        <div style={{ color: "#E2E8F0", fontSize: 13 }}>{file.name}</div>
                        <div style={{ color: "#475569", fontSize: 11, fontFamily: "monospace" }}>{formatBytes(file.size)} · temp_id: {file.tempId}</div>
                      </div>
                      <button onClick={() => setForm(f => ({ ...f, files: f.files.map((x, j) => ({ ...x, isMain: j === i })) }))}
                        style={{
                          fontSize: 10, padding: "3px 10px", borderRadius: 3, cursor: "pointer", fontWeight: 700,
                          background: file.isMain ? "#052E16" : "transparent",
                          color: file.isMain ? "#4ADE80" : "#334155",
                          border: `1px solid ${file.isMain ? "#15803D" : "#1E293B"}`,
                        }}>{file.isMain ? "★ Main Doc" : "Set Main"}</button>
                      <button onClick={() => setForm(f => ({ ...f, files: f.files.filter((_, j) => j !== i) }))}
                        style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 14 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ background: "#0A1525", border: "1px solid #1E293B", borderRadius: 6, padding: 12, fontSize: 11, color: "#475569" }}>
                <span style={{ color: "#F59E0B" }}>📌 Note:</span> ไฟล์จะถูก commit เข้า <code style={{ color: "#94A3B8" }}>correspondence_revision_attachments</code> เมื่อกด Save เท่านั้น
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ color: "#4ADE80", fontSize: 13, background: "#052E16", border: "1px solid #15803D", borderRadius: 6, padding: 12 }}>
                ✓ Ready to create — ตรวจสอบข้อมูลก่อน Submit
              </div>
              {[
                { label: "Type", value: form.type || "—" },
                { label: "Number", value: form.type ? `LCBP3-${form.type.slice(0,3).toUpperCase()}-2026-XXXX (auto)` : "—", mono: true },
                { label: "Originator", value: form.originator || "—" },
                { label: "TO", value: form.toOrgs.join(", ") || "—" },
                { label: "CC", value: form.ccOrgs.join(", ") || "—" },
                { label: "Subject (Rev.0)", value: form.subject || "—" },
                { label: "Status", value: form.status },
                { label: "Doc Date", value: form.docDate || "—" },
                { label: "Due Date", value: form.dueDate || "—" },
                { label: "Attachments", value: form.files.length + " files" },
              ].map(({ label, value, mono }) => (
                <div key={label} style={{ display: "flex", borderBottom: "1px solid #0F172A" }}>
                  <span style={{ width: 140, color: "#475569", fontSize: 12, flexShrink: 0 }}>{label}</span>
                  <span style={{ color: "#CBD5E1", fontSize: 12, fontFamily: mono ? "monospace" : "inherit" }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #1E293B", display: "flex", justifyContent: "space-between" }}>
          <button onClick={step === 1 ? onClose : () => setStep(s => s - 1)} style={{
            background: "transparent", border: "1px solid #1E293B", color: "#64748B",
            padding: "8px 20px", borderRadius: 6, cursor: "pointer", fontSize: 13,
          }}>{step === 1 ? "Cancel" : "← Back"}</button>
          <button onClick={step === total ? () => { onCreated(); onClose(); } : () => setStep(s => s + 1)} style={{
            background: step === total ? "#15803D" : "#1E3A5F", border: "none",
            color: step === total ? "#4ADE80" : "#38BDF8",
            padding: "8px 24px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}>{step === total ? "✓ Create Correspondence" : "Next →"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Correspondence Detail ──────────────────────────────────────────────────
function CorrespondenceDetail({ doc, onBack }) {
  const [activeRevId, setActiveRevId] = useState(doc.revisions.find(r => r.isCurrent)?.id);
  const [showAddRevModal, setShowAddRevModal] = useState(false);
  const activeRev = doc.revisions.find(r => r.id === activeRevId) || doc.revisions[doc.revisions.length - 1];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Breadcrumb header */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #1E293B", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", align: "center", gap: 8 }}>
            <TypeBadge type={doc.type} />
            {doc.isInternal && <span style={{ fontSize: 9, color: "#A78BFA", background: "#1A1235", border: "1px solid #7C3AED44", padding: "1px 6px", borderRadius: 3 }}>INTERNAL</span>}
          </div>
          <div style={{ fontFamily: "monospace", color: "#F59E0B", fontSize: 15, fontWeight: 700, marginTop: 2 }}>{doc.number}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowAddRevModal(true)} style={{
            background: "#0C1A2E", border: "1px solid #0369A1", color: "#38BDF8",
            padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
          }}>+ Add Revision</button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: Revision Timeline */}
        <div style={{ width: 200, borderRight: "1px solid #1E293B", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #1E293B" }}>
            <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>REVISIONS</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {[...doc.revisions].reverse().map((rev) => (
              <button key={rev.id} onClick={() => setActiveRevId(rev.id)} style={{
                width: "100%", textAlign: "left", padding: "12px 14px",
                background: activeRevId === rev.id ? "#1E293B" : "transparent",
                border: "none", borderBottom: "1px solid #0F172A",
                cursor: "pointer", borderLeft: `3px solid ${rev.isCurrent ? "#F59E0B" : "transparent"}`,
              }}>
                <div style={{ display: "flex", align: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "monospace", color: rev.isCurrent ? "#F59E0B" : "#64748B", fontWeight: 700, fontSize: 13 }}>
                    Rev.{rev.revNo}
                  </span>
                  {rev.isCurrent && <span style={{ fontSize: 8, color: "#F59E0B", background: "#1C1200", border: "1px solid #92400E", padding: "1px 4px", borderRadius: 2, fontWeight: 700 }}>CURRENT</span>}
                </div>
                <StatusBadge code={rev.status} />
                <div style={{ color: "#334155", fontSize: 10, marginTop: 4 }}>{rev.docDate}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Main: Revision Detail */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {activeRev && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h2 style={{ color: "#F1F5F9", fontSize: 17, fontWeight: 700, margin: 0 }}>{activeRev.subject}</h2>
                  <div style={{ display: "flex", gap: 12, marginTop: 8, color: "#475569", fontSize: 12 }}>
                    <span>📅 Doc: <span style={{ color: "#94A3B8" }}>{activeRev.docDate || "—"}</span></span>
                    <span>📤 Issued: <span style={{ color: "#94A3B8" }}>{activeRev.issuedDate || "—"}</span></span>
                    <span>📥 Received: <span style={{ color: "#94A3B8" }}>{activeRev.receivedDate || "—"}</span></span>
                    <span style={{ color: activeRev.dueDate ? "#FB923C" : "#475569" }}>⏰ Due: <span style={{ color: activeRev.dueDate ? "#FB923C" : "#94A3B8" }}>{activeRev.dueDate || "—"}</span></span>
                  </div>
                </div>
                <StatusBadge code={activeRev.status} />
              </div>

              {/* Description */}
              {activeRev.description && (
                <div style={{ background: "#0A1525", border: "1px solid #1E293B", borderRadius: 6, padding: 14, marginBottom: 16 }}>
                  <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, marginBottom: 6 }}>DESCRIPTION (Revision Notes)</div>
                  <p style={{ color: "#94A3B8", fontSize: 13, margin: 0, lineHeight: 1.6 }}>{activeRev.description}</p>
                </div>
              )}

              {/* Body */}
              {activeRev.body && (
                <div style={{ background: "#080F1E", border: "1px solid #1E293B", borderRadius: 6, padding: 14, marginBottom: 16 }}>
                  <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, marginBottom: 6 }}>BODY (เนื้อความ)</div>
                  <p style={{ color: "#CBD5E1", fontSize: 13, margin: 0, lineHeight: 1.7 }}>{activeRev.body}</p>
                </div>
              )}

              {/* Remarks */}
              {activeRev.remarks && (
                <div style={{ background: "#1C0A00", border: "1px solid #92400E", borderRadius: 6, padding: 12, marginBottom: 16 }}>
                  <div style={{ color: "#92400E", fontSize: 10, fontWeight: 700, marginBottom: 4 }}>REMARKS</div>
                  <p style={{ color: "#FCD34D", fontSize: 12, margin: 0 }}>{activeRev.remarks}</p>
                </div>
              )}

              {/* Meta */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16, color: "#334155", fontSize: 11 }}>
                <span>Created by: <span style={{ color: "#64748B" }}>{activeRev.createdBy}</span></span>
                {activeRev.updatedBy && <span>· Updated by: <span style={{ color: "#64748B" }}>{activeRev.updatedBy}</span></span>}
              </div>

              {/* Attachments */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 10 }}>
                  ATTACHMENTS ({activeRev.attachments.length}) — correspondence_revision_attachments
                </div>
                {activeRev.attachments.map(att => (
                  <div key={att.id} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                    background: att.isMain ? "#0C1A0C" : "#0A1525",
                    border: `1px solid ${att.isMain ? "#166534" : "#1E293B"}`,
                    borderRadius: 6, marginBottom: 6,
                  }}>
                    <FileIcon mime={att.mime} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#E2E8F0", fontSize: 13 }}>{att.name}</div>
                      <div style={{ color: "#475569", fontSize: 11 }}>{formatBytes(att.size)} · {att.mime}</div>
                    </div>
                    {att.isMain && <span style={{ fontSize: 9, color: "#4ADE80", background: "#052E16", border: "1px solid #15803D", padding: "2px 7px", borderRadius: 3, fontWeight: 700 }}>MAIN DOC</span>}
                    <button style={{ background: "#0F172A", border: "1px solid #1E293B", color: "#64748B", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>Download</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right panel: Master info */}
        <div style={{ width: 220, borderLeft: "1px solid #1E293B", flexShrink: 0, overflowY: "auto" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #1E293B" }}>
            <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>MASTER INFO</div>
          </div>
          <div style={{ padding: "14px" }}>
            {[
              { label: "Project", value: doc.project },
              { label: "Originator", value: doc.originator },
              { label: "Discipline", value: doc.discipline },
              { label: "Created", value: doc.createdAt },
            ].map(({ label, value }) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{ color: "#334155", fontSize: 10, fontWeight: 600 }}>{label}</div>
                <div style={{ color: "#94A3B8", fontSize: 12, marginTop: 2 }}>{value}</div>
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: "#334155", fontSize: 10, fontWeight: 600, marginBottom: 6 }}>RECIPIENTS</div>
              {doc.recipients.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: r.type === "TO" ? "#38BDF8" : "#64748B", background: r.type === "TO" ? "#0C1A2E" : "#1E293B", border: `1px solid ${r.type === "TO" ? "#0369A1" : "#334155"}`, padding: "1px 5px", borderRadius: 2 }}>{r.type}</span>
                  <span style={{ color: "#64748B", fontSize: 11 }}>{r.org}</span>
                </div>
              ))}
            </div>
            {doc.tags.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: "#334155", fontSize: 10, fontWeight: 600, marginBottom: 6 }}>TAGS</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{doc.tags.map(t => <TagPill key={t} label={t} />)}</div>
              </div>
            )}
            {doc.references.length > 0 && (
              <div>
                <div style={{ color: "#334155", fontSize: 10, fontWeight: 600, marginBottom: 6 }}>REFERENCES</div>
                {doc.references.map(r => (
                  <div key={r} style={{ fontFamily: "monospace", fontSize: 10, color: "#475569", background: "#0A1525", border: "1px solid #1E293B", borderRadius: 3, padding: "3px 7px", marginBottom: 4 }}>{r}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Revision Modal (simplified) */}
      {showAddRevModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 12, padding: 28, width: 520 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ color: "#38BDF8", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em" }}>NEW REVISION</div>
                <h3 style={{ color: "#F1F5F9", fontSize: 16, fontWeight: 700, margin: "4px 0 0" }}>Add Revision {doc.revisions.length}</h3>
              </div>
              <button onClick={() => setShowAddRevModal(false)} style={{ background: "none", border: "none", color: "#475569", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ background: "#0A1525", border: "1px solid #1E293B", borderRadius: 6, padding: 12, marginBottom: 16, fontSize: 12, color: "#64748B" }}>
              <span style={{ color: "#F59E0B" }}>⚡ Auto-action:</span> Rev.{doc.revisions.length - 1} (current) จะถูก set is_current=false อัตโนมัติ
            </div>
            <div style={{ color: "#64748B", fontSize: 11, marginBottom: 6 }}>SUBJECT (copied from Rev.{doc.revisions.length - 1})</div>
            <input style={{
              width: "100%", background: "#0A1525", border: "1px solid #1E293B",
              color: "#F1F5F9", padding: "8px 12px", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 16,
            }} defaultValue={activeRev?.subject} />
            <div style={{ color: "#64748B", fontSize: 11, marginBottom: 6 }}>STATUS</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {["DRAFT", "SUBOWN", "PENDING"].map(s => (
                <button key={s} style={{
                  padding: "5px 14px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700,
                  background: s === "DRAFT" ? STATUS_META[s].bg : "transparent",
                  color: s === "DRAFT" ? STATUS_META[s].text : "#475569",
                  border: `1px solid ${s === "DRAFT" ? STATUS_META[s].border : "#1E293B"}`,
                }}>{STATUS_META[s].label}</button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowAddRevModal(false)} style={{ background: "transparent", border: "1px solid #1E293B", color: "#64748B", padding: "7px 16px", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => setShowAddRevModal(false)} style={{ background: "#0C1A2E", border: "1px solid #0369A1", color: "#38BDF8", padding: "7px 20px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Create Rev.{doc.revisions.length}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── FilterDropdown ─────────────────────────────────────────────────────────
function FilterDropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find(o => o.value === value);
  const isFiltered = value !== "ALL";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 10px 4px 10px", borderRadius: 5, cursor: "pointer",
          background: isFiltered ? "#1E293B" : "#0F172A",
          border: `1px solid ${isFiltered ? "#334155" : "#1E293B"}`,
          color: isFiltered ? "#E2E8F0" : "#475569",
          fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
          transition: "all 0.15s",
        }}
      >
        <span style={{ color: "#475569", fontWeight: 600 }}>{label}</span>
        <span style={{ color: "#334155", margin: "0 1px" }}>·</span>
        {/* Selected value with color */}
        {selected?.color ? (
          <span style={{ color: selected.color, fontWeight: 700 }}>{selected.label}</span>
        ) : (
          <span style={{ color: isFiltered ? "#E2E8F0" : "#64748B" }}>{selected?.label || "All"}</span>
        )}
        <span style={{
          fontSize: 8, color: "#475569", marginLeft: 2,
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.15s", display: "inline-block",
        }}>▼</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
          background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8,
          padding: 4, minWidth: 160,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          animation: "fadeIn 0.1s ease",
        }}>
          {options.map(opt => {
            const active = value === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 12px", borderRadius: 5, cursor: "pointer", border: "none",
                  background: active ? "#1E293B" : "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => !active && (e.currentTarget.style.background = "#141E30")}
                onMouseLeave={e => !active && (e.currentTarget.style.background = "transparent")}
              >
                {active && <span style={{ color: "#F59E0B", fontSize: 9 }}>✓</span>}
                {!active && <span style={{ width: 9 }} />}
                {opt.dot && (
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: opt.dot, flexShrink: 0 }} />
                )}
                <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: opt.color || (active ? "#F1F5F9" : "#94A3B8") }}>
                  {opt.label}
                </span>
                {opt.sublabel && (
                  <span style={{ fontSize: 10, color: "#334155", marginLeft: 2 }}>{opt.sublabel}</span>
                )}
                {opt.count !== undefined && (
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "#334155" }}>{opt.count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


export default function CorrespondenceApp() {
  const [view, setView] = useState("list"); // list | detail
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showFlow, setShowFlow] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterProject, setFilterProject] = useState("ALL");
  const [docs, setDocs] = useState(MOCK_DATA);

  const filtered = docs.filter(d => {
    const matchSearch = !search || d.number.toLowerCase().includes(search.toLowerCase()) ||
      d.revisions.some(r => r.subject.toLowerCase().includes(search.toLowerCase()));
    const matchType = filterType === "ALL" || d.type === filterType;
    const matchProject = filterProject === "ALL" || d.project === filterProject;
    const currentRev = d.revisions.find(r => r.isCurrent);
    const matchStatus = filterStatus === "ALL" || currentRev?.status === filterStatus;
    return matchSearch && matchType && matchProject && matchStatus;
  });

  if (view === "detail" && selectedDoc) {
    return (
      <div style={{ height: "100vh", background: "#080F1E", color: "#F1F5F9", fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <CorrespondenceDetail doc={selectedDoc} onBack={() => setView("list")} />
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", background: "#080F1E", color: "#F1F5F9", fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", padding: "0 24px", height: 52, borderBottom: "1px solid #1E293B", flexShrink: 0, gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 24, height: 24, background: "#F59E0B", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✉</div>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#F1F5F9" }}>Correspondence</span>
          <span style={{ color: "#334155", fontSize: 12 }}>/ LCBP3</span>
        </div>
        <div style={{ flex: 1, maxWidth: 360 }}>
          <input style={{
            width: "100%", background: "#0F172A", border: "1px solid #1E293B",
            color: "#94A3B8", padding: "6px 12px", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box",
          }} placeholder="🔍  Search number, subject…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => setShowFlow(true)} style={{
            background: "transparent", border: "1px solid #334155", color: "#64748B",
            padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12,
          }}>🗺 UX Flow</button>
          <button onClick={() => setShowCreate(true)} style={{
            background: "#0C1A2E", border: "1px solid #0369A1", color: "#38BDF8",
            padding: "6px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
          }}>+ New Correspondence</button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, padding: "8px 24px", borderBottom: "1px solid #1E293B", flexShrink: 0, alignItems: "center" }}>
        <FilterDropdown
          label="PROJECT"
          value={filterProject}
          onChange={setFilterProject}
          options={[
            { value: "ALL", label: "All Projects" },
            ...PROJECTS.map(p => ({ value: p.code, label: p.code, sublabel: p.name })),
          ]}
        />
        <div style={{ width: 1, background: "#1E293B", height: 16 }} />
        <FilterDropdown
          label="TYPE"
          value={filterType}
          onChange={setFilterType}
          options={[
            { value: "ALL", label: "All" },
            ...TYPES.map(t => {
              const colors = { Letter: "#F59E0B", RFI: "#38BDF8", Notice: "#F87171", Instruction: "#A78BFA", Report: "#4ADE80", Memo: "#94A3B8" };
              return { value: t, label: t, color: colors[t], dot: colors[t] };
            }),
          ]}
        />
        <div style={{ width: 1, background: "#1E293B", height: 16 }} />
        <FilterDropdown
          label="STATUS"
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { value: "ALL", label: "All" },
            ...Object.entries(STATUS_META).map(([code, m]) => ({
              value: code, label: m.label, color: m.text, dot: m.text,
            })),
          ]}
        />
        <span style={{ marginLeft: "auto", color: "#334155", fontSize: 11 }}>{filtered.length} documents</span>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 140px 100px 90px 90px", gap: 12, padding: "0 14px 8px", color: "#334155", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em" }}>
          <span>DOCUMENT NO.</span><span>SUBJECT (CURRENT REV.)</span><span>ORIGINATOR</span><span>TYPE</span><span>STATUS</span><span>REV.</span>
        </div>
        {filtered.map(doc => {
          const currentRev = doc.revisions.find(r => r.isCurrent) || doc.revisions[doc.revisions.length - 1];
          return (
            <div key={doc.id} onClick={() => { setSelectedDoc(doc); setView("detail"); }} style={{
              display: "grid", gridTemplateColumns: "200px 1fr 140px 100px 90px 90px",
              gap: 12, padding: "12px 14px", marginBottom: 4,
              background: "#0A1525", border: "1px solid #1E293B", borderRadius: 8,
              cursor: "pointer", alignItems: "center",
              transition: "border-color 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#334155"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#1E293B"}
            >
              <div>
                <div style={{ fontFamily: "monospace", color: "#F59E0B", fontSize: 12, fontWeight: 700 }}>{doc.number}</div>
                <div style={{ color: "#334155", fontSize: 10, marginTop: 2 }}>{doc.createdAt}</div>
              </div>
              <div>
                <div style={{ color: "#CBD5E1", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentRev?.subject}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  {doc.tags.map(t => <TagPill key={t} label={t} />)}
                  {doc.references.length > 0 && <span style={{ fontSize: 9, color: "#334155" }}>🔗 {doc.references.length} ref</span>}
                </div>
              </div>
              <div style={{ color: "#64748B", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.originator}</div>
              <div><TypeBadge type={doc.type} /></div>
              <div><StatusBadge code={currentRev?.status} /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: "monospace", color: "#64748B", fontSize: 12 }}>Rev.{currentRev?.revNo}</span>
                {doc.revisions.length > 1 && <span style={{ fontSize: 9, color: "#475569", background: "#1E293B", padding: "1px 5px", borderRadius: 10 }}>{doc.revisions.length}</span>}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#334155" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            <div>No documents found</div>
          </div>
        )}
      </div>

      {showCreate && <CreateWizard onClose={() => setShowCreate(false)} onCreated={() => {}} />}
      {showFlow && <FlowDiagram onClose={() => setShowFlow(false)} />}
    </div>
  );
}
