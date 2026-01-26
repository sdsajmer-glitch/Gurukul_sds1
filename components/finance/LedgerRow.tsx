import React from 'react';

type LedgerRowProps = {
  date: string
  description: string
  note?: string
  debit?: number
  credit?: number
  balance: number
  protocol?: string
}

export const LedgerRow: React.FC<LedgerRowProps> = ({
  date,
  description,
  note,
  debit,
  credit,
  balance,
  protocol,
}) => {
  const isUnallocated = protocol === 'UNALLOCATED_ADVANCE';
  const isAllocated = protocol === 'ALLOCATED_SETTLEMENT';
  const isSystemSync = protocol === 'SYSTEM_SYNC';

  return (
    <div className="grid grid-cols-6 gap-4 px-12 py-7 text-sm hover:bg-white/[0.02] transition-all duration-500 items-center group relative overflow-hidden">
      {/* Visual pulse for current balance equilibrium */}
      <div className={`absolute left-0 top-6 bottom-6 w-1 rounded-r-full transition-opacity ${
        isUnallocated ? 'bg-amber-500 opacity-100' : 'bg-primary opacity-0 group-hover:opacity-100'
      }`}></div>
      
      <div className="text-white/60 font-mono text-[11px] font-bold tracking-widest">{date}</div>

      <div className="col-span-1">
        <div className="font-black text-white uppercase tracking-tighter text-[16px] group-hover:text-primary transition-colors leading-none">
          {description}
        </div>
        {note && <div className="text-[9px] text-white/20 truncate uppercase tracking-widest font-mono mt-1.5">{note}</div>}
      </div>

      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${
          isUnallocated ? 'bg-amber-500 animate-pulse' : 
          isAllocated ? 'bg-emerald-500' : 
          isSystemSync ? 'bg-blue-500' : 'bg-white/10'
        }`} />
        <span className={`text-[10px] truncate uppercase tracking-widest font-bold ${
          isUnallocated ? 'text-amber-500' : 
          isAllocated ? 'text-emerald-500' : 
          'text-white/20'
        }`}>
          {isUnallocated ? 'UNALLOCATED' : isAllocated ? 'SYNCHRONIZED' : protocol || 'LEDGER_POST'}
        </span>
      </div>

      <div className="text-red-500/80 font-black font-mono text-right text-[17px] tabular-nums tracking-tighter">
        {debit ? `₹${debit.toLocaleString()}` : '—'}
      </div>

      <div className="text-emerald-500 font-black font-mono text-right text-[17px] tabular-nums tracking-tighter">
        {credit ? `₹${credit.toLocaleString()}` : '—'}
      </div>

      <div className={`font-black text-2xl font-mono text-right tracking-tighter tabular-nums drop-shadow-2xl ${
        balance < 0 ? 'text-emerald-400' : 'text-white'
      }`}>
        ₹{Math.abs(balance).toLocaleString()}
        {balance < 0 && <span className="text-[10px] ml-1 text-emerald-500/60 font-black">ADV</span>}
      </div>
    </div>
  )
}