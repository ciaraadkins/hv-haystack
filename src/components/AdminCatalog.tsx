"use client";

import { useEffect, useRef, useState } from "react";
import type { CatalogReport } from "@/lib/catalog";

type Row = {
  filename: string;
  lummi_url?: string;
  creator_name?: string;
  creator_url?: string;
  title?: string;
  notes?: string;
  active?: string;
  times_used: number;
};

type Listing = { rows: Row[]; report: CatalogReport; saved?: string; error?: string };

const FIELDS = [
  { key: "lummi_url", label: "Lummi URL", placeholder: "https://www.lummi.ai/photo/…" },
  { key: "creator_name", label: "Creator", placeholder: "Name as shown on Lummi" },
  { key: "creator_url", label: "Creator URL", placeholder: "https://www.lummi.ai/creator/…" },
  { key: "title", label: "Title", placeholder: "Defaults to the file name" },
  { key: "notes", label: "Notes", placeholder: "Optional" },
] as const;

const isActive = (v?: string) => !/^(no|false|0|n)$/i.test(v ?? "");

export default function AdminCatalog() {
  const [data, setData] = useState<Listing | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const uploadForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    fetch("/api/admin/catalog")
      .then((res) => res.json())
      .then(setData)
      .catch(() => setMessage("Couldn't load the catalog. Is local Postgres running?"));
  }, []);

  async function send(init: RequestInit) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/catalog", init);
      const body = (await res.json()) as Listing;
      if (!res.ok) throw new Error(body.error ?? "Something went wrong");
      setData(body);
      setMessage(`Saved ${body.saved}.`);
      return true;
    } catch (err) {
      setMessage((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (await send({ method: "POST", body: new FormData(e.currentTarget) })) uploadForm.current?.reset();
  }

  async function save(e: React.FormEvent<HTMLFormElement>, filename: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const fields = Object.fromEntries(FIELDS.map((f) => [f.key, String(form.get(f.key) ?? "")]));
    await send({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, ...fields, active: form.get("active") ? "yes" : "no" }),
    });
  }

  const report = data?.report;

  return (
    <div className="admin">
      <h1>Lummi catalog</h1>
      {report && (
        <p className="muted">
          {report.active} active · {report.unused} not used yet
          {report.lowStock && " · running low, aim for 14+ unused"}
        </p>
      )}
      <p className="muted small">
        Local only. Changes save to images/lummi/ and local Postgres. To update the live site, run{" "}
        <code>npm run catalog:sync:prod</code>.
      </p>

      <form ref={uploadForm} className="admin-card" onSubmit={upload}>
        <h2>Add an image</h2>
        <label className="admin-field">
          <span>Image</span>
          <input type="file" name="file" accept=".png,.jpg,.jpeg,.webp" required />
        </label>
        {FIELDS.map((f) => (
          <label key={f.key} className="admin-field">
            <span>{f.label}</span>
            <input type="text" name={f.key} placeholder={f.placeholder} />
          </label>
        ))}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Add to catalog"}
        </button>
      </form>

      {message && <p className="admin-message">{message}</p>}

      <h2>Images ({data?.rows.length ?? 0})</h2>
      <ul className="admin-list">
        {data?.rows.map((row) => (
          <li key={row.filename}>
            <form className="admin-card admin-row" onSubmit={(e) => save(e, row.filename)}>
              <img src={`/api/admin/image?f=${encodeURIComponent(row.filename)}`} alt="" />
              <div className="admin-row-fields">
                <p>
                  <strong>{row.filename}</strong>
                  <span className="muted small">
                    {" "}
                    · used {row.times_used} {row.times_used === 1 ? "time" : "times"}
                  </span>
                </p>
                {FIELDS.map((f) => (
                  <label key={f.key} className="admin-field">
                    <span>{f.label}</span>
                    <input type="text" name={f.key} defaultValue={row[f.key] ?? ""} placeholder={f.placeholder} />
                  </label>
                ))}
                <div className="admin-row-actions">
                  <label>
                    <input type="checkbox" name="active" defaultChecked={isActive(row.active)} /> Active
                  </label>
                  <button className="btn" disabled={busy}>
                    Save
                  </button>
                </div>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
