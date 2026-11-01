"use client";

import { useEffect, useRef, useState } from "react";
import type { CatalogReport } from "@/lib/catalog";
import type { Source } from "@/types";

type Row = {
  source: Source;
  filename: string;
  page_url?: string;
  creator_name?: string;
  creator_url?: string;
  title?: string;
  notes?: string;
  active?: string;
  times_used: number;
};

type Listing = { rows: Row[]; report: CatalogReport; saved?: string; error?: string };

const SOURCE_INFO: Record<Source, { label: string; kind: string; creator: string; site: string; page: string; profile: string }> = {
  lummi: {
    label: "Lummi",
    kind: "AI",
    creator: "Creator",
    site: "lummi.ai",
    page: "https://www.lummi.ai/photo/…",
    profile: "https://www.lummi.ai/creator/…",
  },
  unsplash: {
    label: "Unsplash",
    kind: "Real",
    creator: "Photographer",
    site: "unsplash.com",
    page: "https://unsplash.com/photos/…",
    profile: "https://unsplash.com/@…",
  },
};

function fieldsFor(source: Source) {
  const info = SOURCE_INFO[source];
  return [
    { key: "page_url", label: "Page URL", placeholder: info.page },
    { key: "creator_name", label: info.creator, placeholder: `Name as shown on ${info.site}` },
    { key: "creator_url", label: `${info.creator} URL`, placeholder: info.profile },
    { key: "title", label: "Title", placeholder: "Defaults to the file name" },
    { key: "notes", label: "Notes", placeholder: "Optional" },
  ] as const;
}

const isActive = (v?: string) => !/^(no|false|0|n)$/i.test(v ?? "");

export default function AdminCatalog() {
  const [data, setData] = useState<Listing | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadSource, setUploadSource] = useState<Source>("lummi");
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
    if (await send({ method: "POST", body: new FormData(e.currentTarget) })) {
      uploadForm.current?.reset();
      setUploadSource(uploadSource); // keep the chosen source for the next upload
    }
  }

  async function save(e: React.FormEvent<HTMLFormElement>, row: Row) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const fields = Object.fromEntries(fieldsFor(row.source).map((f) => [f.key, String(form.get(f.key) ?? "")]));
    await send({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: row.source, filename: row.filename, ...fields, active: form.get("active") ? "yes" : "no" }),
    });
  }

  const report = data?.report;

  return (
    <div className="admin">
      <h1>Image catalog</h1>
      {report && (
        <p className="muted">
          {(Object.keys(SOURCE_INFO) as Source[]).map((s, i) => (
            <span key={s}>
              {i > 0 && " · "}
              {SOURCE_INFO[s].label} ({SOURCE_INFO[s].kind}): {report.sources[s].active} active,{" "}
              {report.sources[s].unused} unused
              {report.sources[s].lowStock && " (running low)"}
            </span>
          ))}
        </p>
      )}
      <p className="muted small">
        Local only. Download images by hand from the source site, then add them here. Changes save to images/ and
        local Postgres. To update the live site, run <code>npm run catalog:sync:prod</code>.
      </p>

      <form ref={uploadForm} className="admin-card" onSubmit={upload}>
        <h2>Add an image</h2>
        <label className="admin-field">
          <span>Source</span>
          <select name="source" value={uploadSource} onChange={(e) => setUploadSource(e.target.value as Source)}>
            {(Object.keys(SOURCE_INFO) as Source[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_INFO[s].label} ({SOURCE_INFO[s].kind})
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Image</span>
          <input type="file" name="file" accept=".png,.jpg,.jpeg,.webp" required />
        </label>
        {fieldsFor(uploadSource).map((f) => (
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
          <li key={`${row.source}/${row.filename}`}>
            <form className="admin-card admin-row" onSubmit={(e) => save(e, row)}>
              <img src={`/api/admin/image?s=${row.source}&f=${encodeURIComponent(row.filename)}`} alt="" />
              <div className="admin-row-fields">
                <p>
                  <span className="admin-badge">
                    {SOURCE_INFO[row.source]?.label} · {SOURCE_INFO[row.source]?.kind}
                  </span>{" "}
                  <strong>{row.filename}</strong>
                  <span className="muted small">
                    {" "}
                    · used {row.times_used} {row.times_used === 1 ? "time" : "times"}
                  </span>
                </p>
                {fieldsFor(row.source).map((f) => (
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
