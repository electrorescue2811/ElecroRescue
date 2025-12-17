
import React from 'react';
import { CostAnalysis, FinalValuation } from '../types';
import { IndianRupee, TrendingDown, Factory, Briefcase, ShieldCheck, Recycle, ShoppingCart } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface ValuationPanelProps {
  cost: CostAnalysis;
  valuation: FinalValuation;
  onAddToMarket?: () => void;
}

const ValuationPanel: React.FC<ValuationPanelProps> = ({ cost, valuation, onAddToMarket }) => {
  
  const extractRange = (val: string) => {
    // Matches all sequences of digits, handling commas if present (e.g., 1,200)
    const matches = val.replace(/,/g, '').match(/\d+/g);
    
    if (!matches || matches.length === 0) {
      return { min: 0, max: 0, display: 10 }; // Fallback
    }

    const numbers = matches.map(n => parseInt(n, 10));
    const min = numbers[0];
    const max = numbers.length > 1 ? numbers[numbers.length - 1] : min;

    return { min, max, display: max };
  };

  const raw = extractRange(valuation.asIsValue);

  const data = [
    { name: 'Scrap Value', value: raw.display, color: '#f59e0b', min: raw.min, max: raw.max },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <IndianRupee className="w-5 h-5 text-green-400" />
        Component Salvage Valuation (INR)
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Raw Component Value Card - Expanded width or centered look */}
        <div className="col-span-1 md:col-span-2 bg-slate-800/50 p-6 rounded-lg border border-slate-700 flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-start w-full">
            <p className="text-slate-400 text-sm font-mono uppercase tracking-widest">Estimated Salvage Value</p>
            <div className="text-3xl md:text-4xl font-bold text-amber-400 mt-2 break-all">{valuation.asIsValue}</div>
            <p className="text-slate-500 text-xs mt-2 mb-4">Based on visible component count & condition</p>
            
            {/* Low Price Highlight */}
            {raw.min > 0 && (
              <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700/50 w-fit mb-4 max-w-full">
                 <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                 <span className="text-xs text-slate-300 font-medium whitespace-nowrap">Safe Conservative Estimate:</span>
                 <span className="text-sm font-bold text-emerald-400 font-mono">₹{raw.min}</span>
              </div>
            )}

            {/* Sell to Market Button */}
            {onAddToMarket && (
              <button 
                onClick={onAddToMarket}
                className="w-full sm:w-1/2 mt-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all"
              >
                <ShoppingCart className="w-4 h-4" />
                Add to Market
              </button>
            )}
          </div>
          
          <div className="hidden sm:block opacity-10 absolute top-6 right-6 pointer-events-none">
            <Recycle className="w-24 h-24 text-amber-400" />
          </div>
          
          {/* Background Decor */}
          <div className="absolute -bottom-4 -right-4 opacity-5 pointer-events-none">
            <IndianRupee className="w-32 h-32 text-amber-400" />
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="h-24 w-full bg-slate-900/30 rounded-lg border border-slate-800 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={100} 
              tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
              axisLine={false}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
              cursor={{fill: 'transparent'}}
              formatter={(value: any, name: any, props: any) => {
                 const { min, max } = props.payload;
                 if (min !== max && min > 0) return [`₹${min} - ₹${max}`, 'Est. Range'];
                 return [`₹${value}`, 'Est. Value'];
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Breakdown Details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <div className="bg-slate-800/30 p-3 rounded border border-slate-700/50">
          <div className="flex items-center gap-2 mb-1 text-slate-400">
            <Factory className="w-3 h-3" />
            <span className="text-xs uppercase">Complexity</span>
          </div>
          <p className="text-sm text-slate-200">{cost.manufacturingComplexity}</p>
        </div>
        <div className="bg-slate-800/30 p-3 rounded border border-slate-700/50">
          <div className="flex items-center gap-2 mb-1 text-slate-400">
            <Briefcase className="w-3 h-3" />
            <span className="text-xs uppercase">Components</span>
          </div>
          <p className="text-sm text-slate-200">{cost.componentValueRange}</p>
        </div>
        <div className="bg-slate-800/30 p-3 rounded border border-slate-700/50">
          <div className="flex items-center gap-2 mb-1 text-slate-400">
            <TrendingDown className="w-3 h-3" />
            <span className="text-xs uppercase">Depreciation</span>
          </div>
          <p className="text-sm text-slate-200">{cost.conditionDepreciation}</p>
        </div>
      </div>
    </div>
  );
};

export default ValuationPanel;
