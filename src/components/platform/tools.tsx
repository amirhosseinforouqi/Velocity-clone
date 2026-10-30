"use client";

import { useRef, useState } from "react";
import { CircleAlert, CircleCheck, CloudUpload, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppShell } from "./shell";
import { blueBtn, greenBtn, greyBtn, Grid, input, label, Modal, PageHeader, panel, redBtn } from "./ui";

type DataType = "Deal" | "Contact" | "Lead";
type Row = Record<string, string>;
type Result = { type: string; name: string; message: string; ok: boolean };
type HistoryItem = { date: string; type: DataType; source: string; ok: boolean; processed: number; results: Result[] };

const fields: Record<DataType, string[]> = {
  Deal: ["Loan Code", "Borrower First Name", "Borrower Last Name", "Closing Date", "Mortgage Amount", "Lender Name", "Term", "Amortization", "Rate", "Deal Status", "Maturity Date", "CASL", "Email", "Cell Phone"],
  Contact: ["First Name", "Last Name", "Email", "Home Phone", "Cell Phone", "Address", "Date of Birth", "CASL"],
  Lead: ["First Name", "Last Name", "Email", "Cell Phone", "Lead Source", "Notes", "CASL"],
};
const overwriteFields = ["Closing Date", "Mortgage Amount", "CASL", "Lender Name", "Term", "Amortization", "Deal Status", "Maturity Date"];
const MAX_MB = 10;

// Minimal CSV parser: quoted fields, escaped quotes, CRLF.
export function parseCsv(text: string): Row[] {
  const out: string[][] = [[""]];
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], row = out[out.length - 1];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { row[row.length - 1] += '"'; i++; }
      else if (c === '"') q = false;
      else row[row.length - 1] += c;
    } else if (c === '"') q = true;
    else if (c === ",") row.push("");
    else if (c === "\n") out.push([""]);
    else if (c !== "\r") row[row.length - 1] += c;
  }
  const [head, ...body] = out.filter((r) => r.some((v) => v.trim()));
  return head ? body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ""]))) : [];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const autoMap = (cols: string[], type: DataType) =>
  Object.fromEntries(cols.map((c) => [c, fields[type].find((f) => norm(f) === norm(c) || norm(f).replace("borrower", "") === norm(c)) ?? ""]));

const placeholderHistory: HistoryItem[] = [];

export function AppImporter() {
  const [type, setType] = useState<DataType>("Deal");
  const [sources, setSources] = useState<string[]>([]);
  const [source, setSource] = useState("Expert (Consolidated)");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [map, setMap] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string[]>([]);
  const [show, setShow] = useState<"all" | "missing">("all");
  const [ask, setAsk] = useState<{ text: string; onYes?: () => void } | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [history, setHistory] = useState(placeholderHistory);
  const [audience, setAudience] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const expert = source === "Expert (Consolidated)" || source === "Nexa";
  const pickSource = (s: string) => { setSource(s); if (s === "Expert (Consolidated)" || s === "Nexa") setType("Deal"); };
  const pickFile = (f?: File) => {
    if (!f) return;
    if (!/\.(csv|xlsx|json)$/i.test(f.name)) return setAsk({ text: "Allowed file types: .csv, .xlsx, and .json" });
    if (f.size > MAX_MB * 1024 * 1024) return setAsk({ text: `Max file size: ${MAX_MB}MB` });
    setFile(f);
  };
  const upload = async () => {
    if (!file) return setAsk({ text: expert ? "Please make sure to upload the Consolidated CSV file." : "Please import file(s) to begin managing your data." });
    // ponytail: .xlsx needs a parser dependency; handled as a server error until the backend exists.
    if (/\.xlsx$/i.test(file.name)) return setAsk({ text: "Server error uploading file." });
    const text = await file.text();
    let data: Row[];
    try {
      data = /\.json$/i.test(file.name) ? (JSON.parse(text) as Row[]).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? "")]))) : parseCsv(text);
    } catch { return setAsk({ text: "Unable to Import, check the CSV file and try again." }); }
    if (!data.length) return setAsk({ text: "Unable to Import, check the CSV file and try again." });
    setRows(data);
    setMap(autoMap(Object.keys(data[0]), type));
    setResults(null);
  };
  const remove = () => { setFile(null); setRows(null); setMap({}); setResults(null); if (fileRef.current) fileRef.current.value = ""; };

  const cols = rows ? Object.keys(rows[0]) : [];
  const missing = cols.filter((c) => !map[c]).length;
  const setField = (col: string, f: string) => {
    const other = cols.find((c) => c !== col && map[c] === f);
    const apply = () => { setMap({ ...map, ...(other ? { [other]: "" } : {}), [col]: f }); setEditing(editing.filter((e) => e !== col)); };
    if (f && other) setAsk({ text: `'${f}' is already mapped to another import source item. Are you sure you want to change its mapping? (If you select Yes the previous mapping will be removed.)`, onYes: apply });
    else apply();
  };

  const doImport = () => {
    const mapped = (f: string) => cols.find((c) => map[c] === f);
    const first = mapped(type === "Deal" ? "Borrower First Name" : "First Name");
    const last = mapped(type === "Deal" ? "Borrower Last Name" : "Last Name");
    const code = mapped("Loan Code");
    const res: Result[] = rows!.map((r, i) => {
      const name = `${first ? r[first] : ""} ${last ? r[last] : ""}`.trim() || `Row ${i + 1}`;
      if (!first || !last) return { type, name, message: "First & Last Names are required. Please update mappings.", ok: false };
      if (type === "Deal" && (!code || !r[code])) return { type, name, message: "Import Failed - Missing Loan Code.", ok: false };
      if (type === "Deal" && i === 1) return { type, name, message: overwrite ? "Success! Deal overwritten for supported fields." : "This deal exists in Keyway and can't be imported.", ok: overwrite };
      return { type, name, message: type === "Deal" ? `Imported as ${r[code!]}` : "Imported", ok: true };
    });
    setResults(res);
    setHistory([{ date: new Date().toISOString().slice(0, 10), type, source, ok: res.every((r) => r.ok), processed: res.length, results: res }, ...history]);
    setImporting(false);
  };

  const step = "mb-5 flex items-center gap-2 border-b border-[#eee] pb-2 text-base font-semibold text-[#666]";
  const num = "grid size-6 place-items-center rounded-full bg-[#428bca] text-xs text-white";

  return (
    <AppShell>
      <PageHeader icon={Upload} title="Importer" crumbs={[["Import Your Data"]]}>
        <details className="relative">
          <summary className={cn(greyBtn, "flex h-[30px] cursor-pointer list-none items-center px-3 text-[12.6px] [&::-webkit-details-marker]:hidden")}>Import History ▾</summary>
          <div className="absolute left-0 z-20 mt-1 w-[min(560px,90vw)] rounded-[3px] border border-[#ddd] bg-white p-2 shadow-lg">
            <Grid min={480} head={["", "Date", "Data Type", "Data Source", ""]} rows={history.map((h) => [
              h.ok ? <CircleCheck key="s" className="size-4 text-[#5cb85c]" aria-label="Import Completed" /> : <CircleAlert key="s" className="size-4 text-[#f0ad4e]" aria-label="Import Partially Completed" />,
              h.date, h.type, h.source,
              <span key="a" className="flex gap-1">
                <button onClick={() => setAudience(true)} className={cn(blueBtn, "px-2 py-0.5 text-xs")}>Create Audience List</button>
                <button onClick={() => setAsk({ text: `Processed: ${h.processed} of ${h.processed} rows` + (h.results.length ? "\n" + h.results.map((r) => `${r.name}: ${r.message}`).join("\n") : "") })} className={cn(greyBtn, "px-2 py-0.5 text-xs")}>Logs</button>
              </span>,
            ])} />
          </div>
        </details>
      </PageHeader>

      <div className={cn(panel, "p-[15px]")}>
        <h2 className="mb-3 text-lg font-light text-[#666]">Ready to Import? <a href="mailto:support@example.com" className="ml-2 text-sm text-[#428bca] hover:underline">Learn How!</a></h2>
        <ol className="grid gap-3 text-[12.6px] text-[#666] sm:grid-cols-2 lg:grid-cols-4">
          {[["Select Data Type", "Select type of Data you want to Import: Expert and Nexa Data is always 'Deal.'"], ["Select Data Source", "Choose Expert or Create your own Custom Source"], ["Upload and Map Your Data", "After Uploading, Map your Data fields to Keyway. Data Source Mappings are saved for future use"], ["Import Your Data", "Import your data into Keyway Contacts, Leads and Deals. Use your Data to Create Audience Lists for your CRM Campaigns"]].map(([t, d], i) => (
            <li key={t} className="flex gap-2"><span className={num}>{i + 1}</span><span><b className="block text-[#333]">{t}</b>{d}</span></li>
          ))}
        </ol>
      </div>

      <div className={cn(panel, "p-[15px]")}>
        <p className="mb-4 text-lg font-light text-[#666]">IMPORT YOUR DATA INTO KEYWAY</p>
        <div className="grid gap-6 lg:grid-cols-3">
          <section>
            <h3 className={step}><span className={num}>1</span> Select Data Type</h3>
            {(["Deal", "Contact", "Lead"] as const).map((t) => (
              <label key={t} className={cn("flex items-center gap-2 py-1 text-[12.6px]", expert && t !== "Deal" && "text-[#aaa]")}>
                <input type="radio" name="type" checked={type === t} disabled={expert && t !== "Deal"} onChange={() => { setType(t); if (rows) setMap(autoMap(cols, t)); }} /> {t}
              </label>
            ))}
            {expert && <p className="mt-2 text-xs text-[#999]">Expert Data is always &apos;Deal&apos;</p>}
          </section>

          <section>
            <h3 className={step}><span className={num}>2</span> Select Data Source</h3>
            {["Expert (Consolidated)", "Nexa"].map((s) => (
              <label key={s} className="flex items-center gap-2 py-1 text-[12.6px]"><input type="radio" name="src" checked={source === s} onChange={() => pickSource(s)} /> {s}</label>
            ))}
            <p className="mt-3 mb-1 text-xs font-semibold text-[#999]">MY CUSTOM SOURCES</p>
            {sources.map((s) => (
              <div key={s} className="flex items-center gap-2 py-1 text-[12.6px]">
                <label className="flex flex-1 items-center gap-2"><input type="radio" name="src" checked={source === s} onChange={() => pickSource(s)} /> {s}</label>
                <button onClick={() => setDeleting(s)} aria-label={`Delete ${s}`} className="text-[#d9534f]"><Trash2 className="size-3.5" /></button>
              </div>
            ))}
            <button onClick={() => setAdding(true)} className={cn(greyBtn, "mt-2 px-3 py-1 text-[12.6px]")}>+ Add a Data Source</button>
            {flash && <p className={cn("mt-2 rounded-[3px] p-2 text-xs", flash.ok ? "bg-[#dff0d8] text-[#3c763d]" : "bg-[#f2dede] text-[#a94442]")}><b>{flash.ok ? "Whoo hoo!" : "Oh Snap!"}</b> {flash.text}</p>}
          </section>

          <section>
            <h3 className={step}><span className={num}>3</span> Upload Data</h3>
            {source === "Expert (Consolidated)" && <p className="mb-2 text-xs text-[#8a6d3b]">Please make sure to upload the Consolidated CSV file.</p>}
            {source === "Nexa" && <p className="mb-2 text-xs text-[#8a6d3b]">Nexa imports require both the Mortgage Details and Participants files to be uploaded</p>}
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files[0]); }}
              className={cn("rounded-[3px] border-2 border-dashed p-4 text-center text-[12.6px] text-[#999]", drag ? "border-[#428bca] bg-[#f0f7ff]" : "border-[#ccc]")}
            >
              <CloudUpload className="mx-auto mb-1 size-8" />
              Drag &amp; Drop Files to Upload<br />Or<br />
              <button onClick={() => fileRef.current?.click()} className={cn(blueBtn, "mt-1 px-3 py-1")}>Browse Files</button>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.json" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
              {file && <p className="mt-2 text-[#333]">{file.name}</p>}
            </div>
            <p className="mt-1 text-xs text-[#999]">Allowed file types: .csv, .xlsx, and .json · Max file size: {MAX_MB}MB</p>
            <div className="mt-2 flex gap-2">
              <button onClick={upload} className={cn(greenBtn, "px-3 py-1 text-[12.6px]")}>Upload</button>
              <button onClick={remove} className={cn(greyBtn, "px-3 py-1 text-[12.6px]")}>Remove</button>
            </div>
          </section>
        </div>
      </div>

      <div className={cn(panel, "p-[15px]")}>
        <h3 className="text-lg font-light text-[#666]">MAP YOUR DATA</h3>
        <p className="mb-3 text-[12.6px] text-[#999]">Map your Custom data to fields in Keyway</p>
        {!rows ? <p className="text-[12.6px] text-[#999]">Please import file(s) to begin managing your data.</p> : <>
          <div className="mb-2 flex flex-wrap items-center gap-3 text-[12.6px]">
            <span><b>Data Source:</b> {source}</span>
            <span><b>{rows.length}</b> Rows</span>
            <span><b>{cols.length}</b> Fields</span>
            {missing > 0 && <span className="text-[#a94442]"><b>{missing}</b> missing Keyway Location</span>}
            <label className="ml-auto flex items-center gap-1">Show:
              <select value={show} onChange={(e) => setShow(e.target.value as "all" | "missing")} className={cn(input, "w-[130px]")}>
                <option value="all">All Fields</option><option value="missing">Missing Fields</option>
              </select>
            </label>
          </div>
          <Grid head={["SOURCE", "KEYWAY", "VALUES"]} rows={cols.filter((c) => show === "all" || !map[c]).map((c) => [
            c,
            map[c] && !editing.includes(c) ? (
              <span key="v" className="flex flex-wrap items-center gap-2">{map[c]}
                <button onClick={() => setEditing([...editing, c])} className="text-xs text-[#428bca] hover:underline">Change</button>
                <button onClick={() => setField(c, "")} className="text-xs text-[#d9534f] hover:underline">Remove</button>
              </span>
            ) : (
              <select key="v" value={map[c]} onChange={(e) => setField(c, e.target.value)} title="Choose a field in Keyway to map this entry to." className={cn(input, !map[c] && "border-[#d9534f]")}>
                <option value="">Please choose a field</option>
                {fields[type].map((f) => <option key={f}>{f}</option>)}
              </select>
            ),
            rows.slice(0, 3).map((r) => r[c]).filter(Boolean).join(", "),
          ])} />
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setAsk({ text: `Mapping for '${source}' saved.` })} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Save Mapping</button>
            <button onClick={() => setImporting(true)} className={cn(greenBtn, "px-3 py-1.5 text-[12.6px]")}>Import to Keyway</button>
          </div>
        </>}
        {results && (
          <div className="mt-4">
            {results.some((r) => !r.ok) && <p className="mb-2 text-[12.6px] text-[#a94442]">Import Partially Completed</p>}
            <Grid head={["Type", "Name", "Message"]} rows={results.map((r) => [r.type, r.name, <span key="m" className={r.ok ? "text-[#3c763d]" : "text-[#a94442]"}>{r.message}</span>])} />
            <button onClick={() => setAudience(true)} className={cn(blueBtn, "mt-2 px-3 py-1.5 text-[12.6px]")}>Create Audience List</button>
          </div>
        )}
      </div>

      {adding && <AddSourceModal close={() => setAdding(false)} onAdd={(name) => {
        if (sources.concat("Expert (Consolidated)", "Nexa").some((s) => s.toLowerCase() === name.toLowerCase())) setFlash({ ok: false, text: `Data source '${name}' already exists.` });
        else { setSources([...sources, name]); pickSource(name); setFlash({ ok: true, text: `Data source '${name}' successfully added.` }); }
        setAdding(false);
      }} />}
      {deleting && (
        <Modal title="Delete Data Source" close={() => setDeleting(null)} footer={<>
          <button onClick={() => { setSources(sources.filter((s) => s !== deleting)); if (source === deleting) pickSource("Expert (Consolidated)"); setDeleting(null); }} className={cn(redBtn, "px-3 py-1.5 text-[12.6px]")}>Delete Source</button>
          <button onClick={() => setDeleting(null)} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
        </>}>
          <p className="text-[12.6px]">If you delete this Data Source any data mapping you have saved will be removed.</p>
        </Modal>
      )}
      {importing && (
        <Modal title="Import Into Keyway" close={() => setImporting(false)} footer={<>
          <button onClick={() => { setImporting(false); setAsk({ text: `Mapping for '${source}' saved.` }); }} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Save Mapping</button>
          <button onClick={doImport} className={cn(greenBtn, "px-3 py-1.5 text-[12.6px]")}>Import</button>
        </>}>
          <div className="space-y-2 text-[12.6px]">
            <p>Are you sure you want to import the data? This cannot be reversed.</p>
            <p className="text-[#999]">If you still have more mapping to do please select Save Mapping and you can continue later.</p>
            {type === "Deal" && <>
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> Overwrite existing Data</label>
              <p className="text-[#999]">{overwrite ? `Overwrite is selected, the following fields will be updated on previously imported Deals: ${overwriteFields.join(", ")}` : "Overwrite is not selected, previously imported Deals will be skipped."}</p>
            </>}
          </div>
        </Modal>
      )}
      {audience && <AudienceModal close={() => setAudience(false)} />}
      {ask && (
        <Modal title={ask.onYes ? "Change mapping" : "Keyway"} close={() => setAsk(null)} footer={ask.onYes ? <>
          <button onClick={() => { setAsk(null); ask.onYes!(); }} className={cn(blueBtn, "px-4 py-1.5 text-[12.6px]")}>Yes</button>
          <button onClick={() => setAsk(null)} className={cn(greyBtn, "px-4 py-1.5 text-[12.6px]")}>No</button>
        </> : <button onClick={() => setAsk(null)} className={cn(blueBtn, "px-4 py-1.5 text-[12.6px]")}>OK</button>}>
          <p className="text-[12.6px] whitespace-pre-line">{ask.text}</p>
        </Modal>
      )}
    </AppShell>
  );
}

function AddSourceModal({ close, onAdd }: { close: () => void; onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState(false);
  return (
    <Modal title="Add a Data Source" close={close} footer={<>
      <button onClick={() => (name.trim() ? onAdd(name.trim()) : setErr(true))} className={cn(blueBtn, "px-3 py-1.5 text-[12.6px]")}>Add</button>
      <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
    </>}>
      <label className={label}>DATA SOURCE NAME</label>
      <input autoFocus value={name} onChange={(e) => { setName(e.target.value); setErr(false); }} placeholder="Enter a name for this source…" className={input} />
      {err && <p className="mt-1 text-xs text-[#a94442]">You must provide a name for this import mapping.</p>}
    </Modal>
  );
}

const placeholderAudiences: string[] = [];

export function AudienceModal({ close }: { close: () => void }) {
  const [mode, setMode] = useState<"create" | "update" | "replace">("create");
  const [name, setName] = useState("");
  const [list, setList] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const save = () => {
    if (mode === "create" && !name.trim()) return setMsg("Please add a name for the audience list!");
    if (mode === "create" && placeholderAudiences.includes(name.trim())) return setMsg(`The name ${name.trim()} already exists.`);
    if (mode !== "create" && !list) return setMsg("Please select an audience list to update!");
    setConfirm(`Are you sure you want to ${mode} the audience list ${mode === "create" ? name.trim() : list}?`);
  };
  return (
    <Modal title="Create Audience List" close={close} footer={confirm ? <>
      <button onClick={close} className={cn(blueBtn, "px-3 py-1.5 text-[12.6px]")}>Yes</button>
      <button onClick={() => setConfirm(null)} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>No</button>
    </> : <>
      <button onClick={save} className={cn(blueBtn, "px-3 py-1.5 text-[12.6px]")}>Save</button>
      <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
    </>}>
      {confirm ? <p className="text-[12.6px]">{confirm}</p> : (
        <div className="space-y-3 text-[12.6px]">
          <p className="text-[#999]">Create or Update an Audience List for your CRM Campaigns based on the contacts in this report</p>
          <label className="flex items-center gap-2 font-semibold"><input type="radio" checked={mode === "create"} onChange={() => setMode("create")} /> Create a new Audience List:</label>
          {mode === "create" && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Audience List Name" className={input} />}
          {(["update", "replace"] as const).map((m) => (
            <div key={m}>
              <label className="flex items-center gap-2 font-semibold"><input type="radio" checked={mode === m} onChange={() => setMode(m)} /> {m === "update" ? "Update" : "Replace"} an existing Audience List:</label>
              {mode === m && <>
                <select value={list} onChange={(e) => setList(e.target.value)} className={cn(input, "mt-1")}>
                  <option value="">-- Select --</option>{placeholderAudiences.map((a) => <option key={a}>{a}</option>)}
                </select>
                {m === "update" && <p className="mt-1 text-xs text-[#999]">This won&apos;t duplicate contacts that are already in the list.</p>}
              </>}
            </div>
          ))}
          {msg && <p className="text-[#a94442]">{msg}</p>}
        </div>
      )}
    </Modal>
  );
}
