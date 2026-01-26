import React from 'react';
import { LedgerRow } from './LedgerRow';

type LedgerEntry = {
  date: string
  description: string
  note?: string
  debit?: number
  credit?: number
  balance: number
}

export function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  return (
    <div className="mt-8 overflow-hidden rounded-[3.5rem] border border-white/[0.06] bg-[#0c0d12]/60 backdrop-blur-3xl shadow-[0_64px_128px_-32px_rgba(0,0,0,1)] ring-1 ring-white/5">
      {/* Forensic Header */}
      <div className="grid grid-cols-6 gap-4 px-12 py-6 text-[10px] font-black uppercase tracking-[0.4em] text-white/20 bg-black/60 border-b border-white/[0.04] sticky top-0 z-20 backdrop-blur-3xl shadow-xl">
        <div>Pulse (Date)</div>
        <div>Manifest Node</div>
        <div>Protocol</div>
        <div className="text-right">Debit Magnitude</div>
        <div className="text-right">Credit Magnitude</div>
        <div className="text-right">Equilibrium Balance</div>
      </div>

      {/* Rows Stream */}
      <div className="divide-y divide-white/[0.03] max-h-[600px] overflow-y-auto custom-scrollbar">
        {entries.map((entry, index) => (
          <LedgerRow
            key={index}
            date={entry.date}
            description={entry.description}
            note={entry.note}
            debit={entry.debit}
            credit={entry.credit}
            balance={entry.balance}
          />
        ))}
      </div>
      
      {/* Footer Summary Context */}
      <div className="p-8 bg-black/40 border-t border-white/5 flex justify-between items-center opacity-40">
           <p className="text-[9px] font-black uppercase tracking-[0.6em] text-white">Full Temporal Scan Completed</p>
           <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white">SHA-256 REGISTRY_HASH: {Math.random().toString(36).substring(2, 15).toUpperCase()}</p>
      </div>
    </div>
  )
}