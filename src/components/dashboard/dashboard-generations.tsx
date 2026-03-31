"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CREDIT_COST_COPY,
  CREDIT_COST_IMAGE,
} from "@/lib/generation/constants";

type HistoryItem = {
  id: string;
  generation_type: string;
  status: string;
  credits_cost: number | null;
  created_at: string;
  completed_at: string | null;
  output_text: string | null;
  output_image_storage_path: string | null;
  error_message: string | null;
};

type ApiErrorBody = {
  request_id?: string;
  error?: { code?: string; message?: string; details?: unknown };
};

/** API (npr. AI_FAILED) šalje tehnički razlog u `details.detail` — bez ovoga korisnik vidi samo generičku poruku. */
function apiErrorDetailLine(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const rec = details as Record<string, unknown>;
  if (typeof rec.detail === "string" && rec.detail.trim()) return rec.detail.trim();
  return null;
}

function errorMessage(data: unknown): string {
  const d = data as ApiErrorBody;
  const msg = d?.error?.message ?? "Neočekivana greška.";
  const detail = apiErrorDetailLine(d?.error?.details);
  if (detail && !msg.includes(detail)) {
    return `${msg} (${detail})`;
  }
  return msg;
}

export function DashboardGenerations() {
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const [textPrompt, setTextPrompt] = useState("");
  const [imgTextBusy, setImgTextBusy] = useState(false);
  const [imgTextErr, setImgTextErr] = useState<string | null>(null);
  const [imgTextUrl, setImgTextUrl] = useState<string | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [sideDesc, setSideDesc] = useState("");
  const [imgPhotoBusy, setImgPhotoBusy] = useState(false);
  const [imgPhotoErr, setImgPhotoErr] = useState<string | null>(null);
  const [imgPhotoUrl, setImgPhotoUrl] = useState<string | null>(null);

  const [copyBrief, setCopyBrief] = useState("");
  const [copyImage, setCopyImage] = useState<File | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyErr, setCopyErr] = useState<string | null>(null);
  const [copyOut, setCopyOut] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const refreshBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const res = await fetch("/api/tokens/balance", { credentials: "include" });
      const data = (await res.json()) as { balance_tokens?: number } & ApiErrorBody;
      if (!res.ok) {
        setBalance(null);
        return;
      }
      setBalance(typeof data.balance_tokens === "number" ? data.balance_tokens : null);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/history?page_size=15", {
        credentials: "include",
      });
      const data = (await res.json()) as { items?: HistoryItem[] };
      if (res.ok && Array.isArray(data.items)) setHistory(data.items);
      else setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshBalance();
    void refreshHistory();
  }, [refreshBalance, refreshHistory]);

  async function submitImageFromText(e: React.FormEvent) {
    e.preventDefault();
    setImgTextErr(null);
    setImgTextUrl(null);
    setImgTextBusy(true);
    try {
      const res = await fetch("/api/generate/image/from-text", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text_prompt: textPrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImgTextErr(errorMessage(data));
        return;
      }
      const url = (data as { generation?: { output_image_signed_url?: string } })
        .generation?.output_image_signed_url;
      setImgTextUrl(url ?? null);
      await refreshBalance();
      await refreshHistory();
    } finally {
      setImgTextBusy(false);
    }
  }

  async function submitImageFromPhoto(e: React.FormEvent) {
    e.preventDefault();
    setImgPhotoErr(null);
    setImgPhotoUrl(null);
    if (!photoFile) {
      setImgPhotoErr("Izaberi fotografiju.");
      return;
    }
    setImgPhotoBusy(true);
    try {
      const fd = new FormData();
      fd.append("photo", photoFile);
      fd.append("side_description", sideDesc.trim());
      const res = await fetch("/api/generate/image/from-photo", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setImgPhotoErr(errorMessage(data));
        return;
      }
      const url = (data as { generation?: { output_image_signed_url?: string } })
        .generation?.output_image_signed_url;
      setImgPhotoUrl(url ?? null);
      await refreshBalance();
      await refreshHistory();
    } finally {
      setImgPhotoBusy(false);
    }
  }

  async function submitCopy(e: React.FormEvent) {
    e.preventDefault();
    setCopyErr(null);
    setCopyOut(null);
    setCopyBusy(true);
    try {
      const fd = new FormData();
      fd.append("text_preferences", copyBrief.trim());
      if (copyImage && copyImage.size > 0) fd.append("image", copyImage);
      const res = await fetch("/api/generate/copy", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setCopyErr(errorMessage(data));
        return;
      }
      const text = (data as { generation?: { output_text?: string } }).generation
        ?.output_text;
      setCopyOut(text ?? null);
      await refreshBalance();
      await refreshHistory();
    } finally {
      setCopyBusy(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";
  const labelClass = "text-sm font-medium text-zinc-300";
  const cardClass =
    "rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-sm";

  return (
    <div className="mt-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Stanje kredita
          </p>
          <p className="text-lg font-semibold text-zinc-100">
            {balanceLoading
              ? "…"
              : balance === null
                ? "—"
                : `${balance} tokena`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshBalance()}
          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
        >
          Osveži
        </button>
      </div>

      <p className="text-xs text-zinc-500">
        Cene po generaciji: slika {CREDIT_COST_IMAGE} tokena · tekst (copy){" "}
        {CREDIT_COST_COPY} token.
      </p>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-zinc-100">Slika iz opisa</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Gemini generiše sliku na osnovu tekstualnog prompta.
        </p>
        <form className="mt-4 space-y-3" onSubmit={submitImageFromText}>
          <div>
            <label htmlFor="text_prompt" className={labelClass}>
              Prompt
            </label>
            <textarea
              id="text_prompt"
              required
              rows={4}
              value={textPrompt}
              onChange={(e) => setTextPrompt(e.target.value)}
              className={inputClass}
              placeholder="npr. moderan salon, dnevna svetlost, minimalistički enterijer…"
            />
          </div>
          <button
            type="submit"
            disabled={imgTextBusy}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
          >
            {imgTextBusy ? "Generišem…" : `Generiši sliku (${CREDIT_COST_IMAGE} tokena)`}
          </button>
        </form>
        {imgTextErr ? (
          <p className="mt-3 text-sm text-red-400">{imgTextErr}</p>
        ) : null}
        {imgTextUrl ? (
          <div className="mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgTextUrl}
              alt="Generisana slika"
              className="max-h-96 w-auto max-w-full rounded-lg border border-zinc-700"
            />
          </div>
        ) : null}
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-zinc-100">Slika iz fotografije</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Otpremi foto prostora; AI predlaže izgled na osnovu slike i kratkog opisa.
        </p>
        <form className="mt-4 space-y-3" onSubmit={submitImageFromPhoto}>
          <div>
            <label htmlFor="photo" className={labelClass}>
              Fotografija (PNG, JPEG, WebP)
            </label>
            <input
              id="photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className={`${inputClass} py-2 file:mr-3 file:rounded file:border-0 file:bg-zinc-700 file:px-3 file:py-1 file:text-sm file:text-zinc-200`}
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label htmlFor="side_desc" className={labelClass}>
              Kratak opis (opciono)
            </label>
            <textarea
              id="side_desc"
              rows={2}
              value={sideDesc}
              onChange={(e) => setSideDesc(e.target.value)}
              className={inputClass}
              placeholder="npr. zid iza recepcije, želim topliju paletu…"
            />
          </div>
          <button
            type="submit"
            disabled={imgPhotoBusy}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
          >
            {imgPhotoBusy
              ? "Generišem…"
              : `Generiši sliku (${CREDIT_COST_IMAGE} tokena)`}
          </button>
        </form>
        {imgPhotoErr ? (
          <p className="mt-3 text-sm text-red-400">{imgPhotoErr}</p>
        ) : null}
        {imgPhotoUrl ? (
          <div className="mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgPhotoUrl}
              alt="Generisana slika"
              className="max-h-96 w-auto max-w-full rounded-lg border border-zinc-700"
            />
          </div>
        ) : null}
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-zinc-100">Marketing tekst (copy)</h2>
        <p className="mt-1 text-sm text-zinc-500">
          OpenAI na osnovu tvojih preferenci; možeš dodati i referentnu sliku.
        </p>
        <form className="mt-4 space-y-3" onSubmit={submitCopy}>
          <div>
            <label htmlFor="copy_brief" className={labelClass}>
              Preferencije / brief
            </label>
            <textarea
              id="copy_brief"
              required
              rows={5}
              value={copyBrief}
              onChange={(e) => setCopyBrief(e.target.value)}
              className={inputClass}
              placeholder="Ton, dužina, CTA, jezik, zabranjene reči…"
            />
          </div>
          <div>
            <label htmlFor="copy_img" className={labelClass}>
              Referentna slika (opciono)
            </label>
            <input
              id="copy_img"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className={`${inputClass} py-2 file:mr-3 file:rounded file:border-0 file:bg-zinc-700 file:px-3 file:py-1 file:text-sm file:text-zinc-200`}
              onChange={(e) => setCopyImage(e.target.files?.[0] ?? null)}
            />
          </div>
          <button
            type="submit"
            disabled={copyBusy}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
          >
            {copyBusy
              ? "Generišem…"
              : `Generiši tekst (${CREDIT_COST_COPY} token)`}
          </button>
        </form>
        {copyErr ? (
          <p className="mt-3 text-sm text-red-400">{copyErr}</p>
        ) : null}
        {copyOut ? (
          <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-950/80 p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
              {copyOut}
            </p>
          </div>
        ) : null}
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-100">Skorašnje generacije</h2>
          <button
            type="button"
            onClick={() => void refreshHistory()}
            className="text-xs font-medium text-sky-400 hover:text-sky-300"
          >
            Osveži listu
          </button>
        </div>
        {historyLoading ? (
          <p className="mt-4 text-sm text-zinc-500">Učitavam…</p>
        ) : history.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Još nema generacija.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {history.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800/80 py-2 last:border-0"
              >
                <span className="font-mono text-xs text-zinc-500">
                  {row.generation_type}
                </span>
                <span
                  className={
                    row.status === "succeeded"
                      ? "text-emerald-400"
                      : row.status === "failed"
                        ? "text-red-400"
                        : "text-amber-400"
                  }
                >
                  {row.status}
                </span>
                <span className="w-full text-xs text-zinc-500">
                  {new Date(row.created_at).toLocaleString("sr-Latn-RS")}
                  {row.credits_cost != null ? ` · ${row.credits_cost} tok.` : ""}
                </span>
                {row.output_text ? (
                  <p className="w-full truncate text-zinc-400">{row.output_text}</p>
                ) : null}
                {row.error_message ? (
                  <p className="w-full text-xs text-red-400/90">{row.error_message}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
