"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-[3px] border border-[#3d81be] bg-[#428bca] px-3 py-1 text-white print:hidden">
      {label}
    </button>
  );
}
