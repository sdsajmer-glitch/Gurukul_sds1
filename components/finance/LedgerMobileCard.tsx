import React from 'react';

type LedgerMobileCardProps = {
  date: string
  description: string
  note?: string
  debit?: number
  credit?: number
  balance: number
}

export function LedgerMobileCard({
  date,
  description,
  note,
  debit,
  credit,
  balance,
}: LedgerMobileCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#10141B] p-6 space-y-4 shadow-xl">
      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/30">
        <span>{date}</span>
        <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">REF: {note || '—'}</span>
      </div>

      <p className="font-black text-white uppercase tracking-tight text-base leading-none">{description}</p>

      <div className="flex justify-between items-center py-2 border-y border-white/[0.03]">
        <div className="space-y-1">
          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Magnitude</p>
          <div className="flex gap-4">
             {debit ? <span className="text-red-400 font-bold font-mono">− ₹{debit.toLocaleString()}</span> : null}
             {credit ? <span className="text-emerald-400 font-bold font-mono">+ ₹{credit.toLocaleString()}</span> : null}
             {!debit && !credit && <span className="text-white/20 font-mono">—</span>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Balance</p>
          <p className="font-black text-white text-xl font-mono tracking-tighter">
            ₹{balance.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}
