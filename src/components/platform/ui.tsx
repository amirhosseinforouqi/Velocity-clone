"use client";

import { type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Shared Velocity (Bootstrap 3 / AdminLTE) look used across pages.
export const blueBtn = "rounded-[3px] border border-[#3d81be] bg-gradient-to-b from-[#428bcd] to-[#3d81be] text-white";
export const greenBtn = "rounded-[3px] border border-[#4cae4c] bg-gradient-to-b from-[#5cb85c] to-[#4cae4c] text-white";
export const redBtn = "rounded-[3px] border border-[#cf4f4c] bg-gradient-to-b from-[#d9534f] to-[#cf4f4c] text-white";
export const greyBtn = "rounded-[3px] border border-[#ccc] bg-white text-[#333] hover:bg-[#e6e6e6]";
export const input = "h-[30px] w-full rounded-[3px] border border-[#ccc] bg-white px-2 text-[12.6px] text-[#555] outline-none focus:border-[#66afe9]";
export const label = "mb-1 block text-[12.6px] font-semibold text-[#666]";
export const th = "border-x border-[#797979] px-2 py-2 text-left font-semibold whitespace-nowrap";
export const td = "border border-[#ddd] p-2 align-top";
export const panel = "mx-[25px] mb-5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.1)]";

export function PageHeader({ icon: Icon, title, crumbs, children }: { icon: LucideIcon; title: string; crumbs: [string, string?][]; children?: ReactNode }) {
  return (
    <section className="mx-[25px] mb-5 flex flex-wrap items-center gap-2.5 text-[#666]">
      <Icon className="size-7 stroke-[1.5]" />
      <h1 className="text-[28px] leading-[38px] font-light">{title}</h1>
      {children}
      <ol className="ml-auto hidden items-center gap-1 text-xs sm:flex">
        <li><Link href="/" className="text-[#444] hover:underline">Home</Link></li>
        {crumbs.map(([text, href]) => (
          <li key={text} className="before:mr-1 before:text-[#ccc] before:content-['>']">
            {href ? <Link href={href} className="text-[#444] hover:underline">{text}</Link> : text}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ToggleColumns({ shown, setShown, fixed, options }: { shown: string[]; setShown: (s: string[]) => void; fixed: string[]; options: readonly (readonly [string, string])[] }) {
  return (
    <details className="relative">
      <summary className={cn(blueBtn, "flex h-[34px] cursor-pointer list-none items-center gap-2 px-3 text-[12.6px] [&::-webkit-details-marker]:hidden")}>
        Toggle Columns <ChevronDown className="size-3.5" />
      </summary>
      <ul className="absolute right-0 z-20 mt-1 w-52 rounded-[3px] border border-[#ddd] bg-white py-1 text-[12.6px] shadow-lg">
        {fixed.map((l) => <li key={l}><label className="flex items-center gap-2 px-3 py-1 text-[#999]"><input type="checkbox" checked disabled /> {l}</label></li>)}
        {options.map(([k, l]) => (
          <li key={k}>
            <label className="flex items-center gap-2 px-3 py-1">
              <input type="checkbox" checked={shown.includes(k)} onChange={() => setShown(shown.includes(k) ? shown.filter((s) => s !== k) : [...shown, k])} /> {l}
            </label>
          </li>
        ))}
      </ul>
    </details>
  );
}

// Bootstrap modal: dark backdrop, white dialog, header with ×.
export function Modal({ title, close, children, footer, wide }: { title: ReactNode; close: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4" onClick={close}>
      <div role="dialog" aria-modal className={cn("mx-auto mt-[30px] rounded-[6px] bg-white text-[#333] shadow-[0_5px_15px_rgba(0,0,0,0.5)]", wide ? "max-w-[900px]" : "max-w-[600px]")} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center border-b border-[#e5e5e5] p-[15px]">
          <h4 className="text-lg">{title}</h4>
          <button onClick={close} aria-label="Close" className="ml-auto text-xl leading-none text-black/40">×</button>
        </div>
        <div className="p-[15px]">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-[#e5e5e5] p-[15px]">{footer}</div>}
      </div>
    </div>
  );
}

export function Pager({ from, to, total }: { from: number; to: number; total: number }) {
  return <p className="text-[12.6px] text-[#666]">Viewing: {total ? from : 0} - {to} of {total}</p>;
}

// Velocity's static report table: dark head, striped rows.
export function Grid({ head, rows, empty = "No records to display", min = 700 }: { head: ReactNode[]; rows: ReactNode[][]; empty?: string; min?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.6px]" style={{ minWidth: min }}>
        <thead className="bg-black/60 text-white"><tr>{head.map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((r, i) => (
            <tr key={i} className="odd:bg-white even:bg-[#fafafa]">{r.map((c, j) => <td key={j} className={td}>{c}</td>)}</tr>
          )) : <tr><td colSpan={head.length} className={cn(td, "text-center text-[#999]")}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
