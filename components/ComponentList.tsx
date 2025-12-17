import React from 'react';
import { PCBComponent } from '../types';
import { Layers, Zap, Info, Box } from 'lucide-react';

interface ComponentListProps {
  components: PCBComponent[];
  summary?: string[];
}

const ComponentList: React.FC<ComponentListProps> = ({ components, summary = [] }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-400" />
          Detected Components
        </h2>
        <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-full border border-slate-700">
          {components.length} Items Listed
        </span>
      </div>

      {/* Summary Counts Section */}
      {summary.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {summary.map((item, idx) => {
            // Try to separate the count from the name for better styling
            const match = item.match(/^(\d+x?)\s+(.+)$/);
            const count = match ? match[1] : '';
            const name = match ? match[2] : item;

            return (
              <div key={idx} className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-4 py-3 flex items-center gap-3">
                <div className="bg-blue-500/10 p-2 rounded-md shrink-0">
                  <Box className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex flex-col leading-tight">
                  {count && <span className="text-xs text-blue-400 font-mono font-bold">{count}</span>}
                  <span className="text-sm text-slate-200 font-medium">{name}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Detailed List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {components.map((comp, idx) => (
          <div 
            key={idx} 
            className={`
              p-4 rounded-lg border backdrop-blur-sm transition-all
              ${comp.isCritical 
                ? 'bg-blue-900/10 border-blue-500/30 hover:border-blue-500/50' 
                : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
              }
            `}
          >
            <div className="flex justify-between items-start mb-2">
              <span className={`text-sm font-mono px-2 py-0.5 rounded ${comp.isCritical ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-300'}`}>
                {comp.type}
              </span>
              {comp.isCritical && <Zap className="w-4 h-4 text-amber-400" />}
            </div>
            <h3 className="font-medium text-slate-200 mb-1">{comp.name}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              {comp.function}
            </p>
          </div>
        ))}
        {components.length === 0 && (
          <div className="col-span-full p-8 text-center border border-dashed border-slate-700 rounded-lg">
            <Info className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-slate-500">No individual components listed.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComponentList;