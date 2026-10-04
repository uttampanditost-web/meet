import React, { useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { Search, Upload, Users, Download, RefreshCw, Pencil, X, CheckCircle2, AlertTriangle } from "lucide-react";

interface StudentRecord {
  id: string;
  studentId?: string;
  name: string;
  email: string;
  phone: string;
  batchName: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface StudentsTabProps {
  currentUserEmail: string;
  isAdmin: boolean;
}

const normalizeHeader = (v: string) => String(v || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const normalizePhone = (v: string) => String(v || "").replace(/[^0-9+]/g, "").replace(/^\+/, "");
const keyName = (v: string) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (c === '"') {
      if (quoted && n === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell.trim()); cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && n === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

async function parseXlsx(file: File): Promise<string[][]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const shared = zip.file("xl/sharedStrings.xml");
  const sharedStrings: string[] = [];
  if (shared) {
    const xml = new DOMParser().parseFromString(await shared.async("text"), "application/xml");
    xml.querySelectorAll("si").forEach((si) => {
      sharedStrings.push(Array.from(si.querySelectorAll("t")).map((t) => t.textContent || "").join(""));
    });
  }
  const workbook = zip.file("xl/workbook.xml");
  const rels = zip.file("xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new Error("Invalid XLSX workbook.");
  const wb = new DOMParser().parseFromString(await workbook.async("text"), "application/xml");
  const firstSheet = wb.querySelector("sheet");
  if (!firstSheet) throw new Error("No worksheet found.");
  const rid = firstSheet.getAttribute("r:id");
  const relDoc = new DOMParser().parseFromString(await rels.async("text"), "application/xml");
  const rel = Array.from(relDoc.querySelectorAll("Relationship")).find((r) => r.getAttribute("Id") === rid);
  if (!rel) throw new Error("Could not resolve worksheet.");
  let target = rel.getAttribute("Target") || "worksheets/sheet1.xml";
  target = target.replace(/^\//, "");
  if (!target.startsWith("xl/")) target = `xl/${target}`;
  const sheet = zip.file(target);
  if (!sheet) throw new Error("Worksheet data not found.");
  const doc = new DOMParser().parseFromString(await sheet.async("text"), "application/xml");
  const rows: string[][] = [];
  doc.querySelectorAll("sheetData > row").forEach((r) => {
    const cells: { col: number; value: string }[] = [];
    r.querySelectorAll("c").forEach((c) => {
      const ref = c.getAttribute("r") || "A1";
      const letters = (ref.match(/[A-Z]+/i)?.[0] || "A").toUpperCase();
      let col = 0;
      for (const ch of letters) col = col * 26 + ch.charCodeAt(0) - 64;
      col -= 1;
      const type = c.getAttribute("t");
      const v = c.querySelector("v")?.textContent || "";
      const inline = Array.from(c.querySelectorAll("is t")).map((t) => t.textContent || "").join("");
      let value = inline || v;
      if (type === "s") value = sharedStrings[Number(v)] || "";
      cells.push({ col, value });
    });
    const max = cells.reduce((m, c) => Math.max(m, c.col), -1);
    const out = Array.from({ length: max + 1 }, () => "");
    cells.forEach((c) => { out[c.col] = c.value; });
    if (out.some(Boolean)) rows.push(out);
  });
  return rows;
}

function rowsToStudents(rows: string[][], batchName: string) {
  if (rows.length < 2) throw new Error("The file needs a header row and at least one student row.");
  const headers = rows[0].map(normalizeHeader);
  const find = (...names: string[]) => {
    const wanted = names.map(normalizeHeader);
    return headers.findIndex((h) => wanted.includes(h));
  };
  const nameIdx = find("name", "studentname", "cxname", "fullname", "student");
  const emailIdx = find("email", "studentemail", "emailid");
  const phoneIdx = find("phone", "phonenumber", "mobile", "mobilenumber", "contact", "contactnumber");
  const idIdx = find("studentid", "id", "registrationid", "userid");
  if (nameIdx < 0) throw new Error("Could not find a Name column.");
  if (phoneIdx < 0) throw new Error("Could not find a Phone/Mobile column.");
  return rows.slice(1).map((r) => ({
    studentId: idIdx >= 0 ? String(r[idIdx] || "").trim() : "",
    name: String(r[nameIdx] || "").trim(),
    email: emailIdx >= 0 ? String(r[emailIdx] || "").trim().toLowerCase() : "",
    phone: normalizePhone(r[phoneIdx] || ""),
    batchName,
  })).filter((s) => s.name && s.phone);
}

export const StudentsTab: React.FC<StudentsTabProps> = ({ currentUserEmail, isAdmin }) => {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [batches, setBatches] = useState<{ name: string; count: number }[]>([]);
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [editStudent, setEditStudent] = useState<StudentRecord | null>(null);
  const [batchName, setBatchName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const LOCAL_KEY = "meettrack_students_v1";

  const syncToExtension = (records: StudentRecord[]) => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
      // The downloaded extension's sync-app.js relays this to chrome.storage.local.
      window.postMessage({
        type: "MEETTRACK_STUDENT_DIRECTORY",
        students: records.map((s) => ({
          id: s.id, studentId: s.studentId || "", name: s.name, email: s.email || "",
          phone: s.phone, batchName: s.batchName, active: s.active !== false
        }))
      }, window.location.origin);
    } catch (e) {
      console.warn("[Students] local student directory sync failed", e);
    }
  };

  const load = () => {
    setLoading(true);
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      const data: StudentRecord[] = raw ? JSON.parse(raw) : [];
      const safe = Array.isArray(data) ? data : [];
      setStudents(safe);
      const counts = new Map<string, number>();
      safe.forEach((s) => counts.set(s.batchName || "Unassigned", (counts.get(s.batchName || "Unassigned") || 0) + 1));
      setBatches(Array.from(counts.entries()).map(([name, count]) => ({ name, count })).sort((a,b) => a.name.localeCompare(b.name)));
      syncToExtension(safe);
    } catch (e: any) {
      setMessage({ type: "error", text: e?.message || "Failed to load local student directory" });
    } finally { setLoading(false); }
  };

  React.useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      const matchesBatch = batchFilter === "all" || s.batchName === batchFilter;
      const matchesSearch = !q || [s.name, s.email, s.phone, s.studentId, s.batchName].some((v) => String(v || "").toLowerCase().includes(q));
      return matchesBatch && matchesSearch;
    });
  }, [students, search, batchFilter]);

  const handleUpload = async (file: File) => {
    if (!batchName.trim()) { setMessage({ type: "error", text: "Enter the batch name first." }); return; }
    setImporting(true); setMessage(null);
    try {
      const ext = file.name.toLowerCase().split(".").pop();
      const rows = ext === "xlsx" ? await parseXlsx(file) : parseCsv(await file.text());
      const parsed = rowsToStudents(rows, batchName.trim());
      if (!parsed.length) throw new Error("No valid students found. Check Name and Phone columns.");
      const existing = (() => {
        try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]") as StudentRecord[]; } catch { return []; }
      })();
      const byKey = new Map<string, StudentRecord>();
      const keyFor = (s: any) => {
        const id = String(s.studentId || "").trim().toLowerCase();
        const email = String(s.email || "").trim().toLowerCase();
        const phone = normalizePhone(s.phone);
        return id ? `id:${id}` : email ? `email:${email}` : `phone:${phone}`;
      };
      existing.forEach((s) => byKey.set(keyFor(s), s));
      let imported = 0; let updated = 0;
      parsed.forEach((s) => {
        const k = keyFor(s);
        const prior = byKey.get(k);
        const record: StudentRecord = {
          id: prior?.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          studentId: s.studentId || "", name: s.name, email: s.email || "", phone: s.phone,
          batchName: s.batchName, active: prior?.active !== false, createdAt: prior?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        byKey.set(k, record);
        if (prior) updated++; else imported++;
      });
      const merged = Array.from(byKey.values()).sort((a,b) => a.name.localeCompare(b.name));
      setStudents(merged);
      syncToExtension(merged);
      const counts = new Map<string, number>();
      merged.forEach((s) => counts.set(s.batchName || "Unassigned", (counts.get(s.batchName || "Unassigned") || 0) + 1));
      setBatches(Array.from(counts.entries()).map(([name, count]) => ({ name, count })).sort((a,b) => a.name.localeCompare(b.name)));
      setMessage({ type: "ok", text: `Imported ${imported} students into ${batchName.trim()}. ${updated} existing records updated. Stored locally for this test build.` });
      setBatchName("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      setMessage({ type: "error", text: e?.message || "Import failed" });
    } finally { setImporting(false); }
  };

  const saveEdit = async () => {
    if (!editStudent) return;
    try {
      const existing = (() => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]") as StudentRecord[]; } catch { return []; } })();
      const updated = existing.map((s) => s.id === editStudent.id ? { ...editStudent, phone: normalizePhone(editStudent.phone), updatedAt: new Date().toISOString() } : s);
      setStudents(updated);
      syncToExtension(updated);
      setEditStudent(null); setMessage({ type: "ok", text: "Student updated locally." });
      load();
    } catch (e: any) { setMessage({ type: "error", text: e?.message || "Update failed" }); }
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Students & Batches</h2>
          <p className="text-sm text-slate-400 mt-1">Test-mode student directory. Data is stored locally in this browser and synced to the installed MeetTrack extension; Supabase is not used for this feature.</p>
        </div>
        <div className="flex gap-2 self-start lg:self-auto">
          <button onClick={() => syncToExtension(students)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-200 text-sm">Sync to Extension</button>
          <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-slate-200 text-sm"><RefreshCw className="w-4 h-4"/> Refresh</button>
        </div>
      </div>

      {message && <div className={`rounded-xl px-4 py-3 text-sm border ${message.type === "ok" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border-rose-500/30 text-rose-300"}`}>{message.text}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <div className="flex items-center gap-2 mb-3"><Upload className="w-4 h-4 text-sky-400"/><h3 className="font-semibold">Upload / Add Batch</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={batchName} onChange={(e) => setBatchName(e.target.value)} placeholder="Batch name e.g. Batch 5" className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400"/>
            <label className="md:col-span-2 flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-600 bg-slate-900/70 px-3 py-2.5 cursor-pointer hover:border-sky-400">
              <span className="text-sm text-slate-300 truncate">CSV or XLSX — Name + Phone required</span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold"><Upload className="w-3.5 h-3.5"/>{importing ? "Importing…" : "Choose File"}</span>
              <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" disabled={importing} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}/>
            </label>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Existing students are matched by student ID, email, or phone. You don't need to upload daily session bookings.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <div className="flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-purple-400"/><h3 className="font-semibold">Batch Summary</h3></div>
          <div className="space-y-2 max-h-32 overflow-auto">{batches.length ? batches.map((b) => <button key={b.name} onClick={() => setBatchFilter(b.name)} className={`w-full flex justify-between text-sm px-3 py-2 rounded-lg ${batchFilter === b.name ? "bg-sky-500/15 text-sky-300" : "bg-white/[0.03] text-slate-300"}`}><span>{b.name}</span><span>{b.count}</span></button>) : <div className="text-sm text-slate-500">No batches imported yet.</div>}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/50 overflow-hidden">
        <div className="p-4 border-b border-white/10 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex items-center gap-2"><div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone or ID…" className="w-72 max-w-full rounded-xl bg-slate-900 border border-white/10 pl-9 pr-3 py-2 text-sm text-white outline-none"/></div><select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-sm text-slate-200"><option value="all">All batches</option>{batches.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}</select></div>
          <span className="text-xs text-slate-500">{filtered.length} students</span>
        </div>
        {loading ? <div className="p-10 text-center text-slate-500">Loading students…</div> : filtered.length === 0 ? <div className="p-10 text-center text-slate-500">No students found.</div> : <div className="overflow-auto max-h-[520px]"><table className="w-full text-sm"><thead className="sticky top-0 bg-slate-950"><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500"><th className="px-4 py-3">Student</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Batch</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead><tbody>{filtered.map((s) => <tr key={s.id} className="border-t border-white/[0.06] hover:bg-white/[0.02]"><td className="px-4 py-3"><div className="font-semibold text-white">{s.name}</div><div className="text-xs text-slate-500">{s.email || "No email"}{s.studentId ? ` • ${s.studentId}` : ""}</div></td><td className="px-4 py-3 font-mono text-slate-300">{s.phone}</td><td className="px-4 py-3 text-slate-300">{s.batchName}</td><td className="px-4 py-3">{s.active ? <span className="text-emerald-300">Active</span> : <span className="text-slate-500">Inactive</span>}</td><td className="px-4 py-3 text-right"><button onClick={() => setEditStudent({ ...s })} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"><Pencil className="w-4 h-4"/></button></td></tr>)}</tbody></table></div>}
      </div>

      {editStudent && <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"><div className="w-full max-w-lg rounded-2xl bg-slate-950 border border-white/10 shadow-2xl p-5"><div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold">Edit Student</h3><button onClick={() => setEditStudent(null)}><X className="w-5 h-5 text-slate-400"/></button></div><div className="space-y-3"><input value={editStudent.name} onChange={(e) => setEditStudent({ ...editStudent, name: e.target.value })} className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-white" placeholder="Name"/><input value={editStudent.email} onChange={(e) => setEditStudent({ ...editStudent, email: e.target.value })} className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-white" placeholder="Email"/><input value={editStudent.phone} onChange={(e) => setEditStudent({ ...editStudent, phone: e.target.value })} className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-white" placeholder="Phone"/><input value={editStudent.batchName} onChange={(e) => setEditStudent({ ...editStudent, batchName: e.target.value })} className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-white" placeholder="Batch"/></div><div className="flex justify-end gap-2 mt-5"><button onClick={() => setEditStudent(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200">Cancel</button><button onClick={saveEdit} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>Save</button></div></div></div>}
    </div>
  );
};
