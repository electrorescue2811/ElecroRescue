
import React from 'react';
import { DamageAssessment } from '../types';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Gauge, 
  Flame, 
  Droplets, 
  SearchX, 
  Activity, 
  Zap, 
  Wind,
  XCircle,
  Minimize2,
  Trash2,
  Scan
} from 'lucide-react';

interface DamageReportProps {
  assessment: DamageAssessment;
}

const DamageReport: React.FC<DamageReportProps> = ({ assessment }) => {
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-400 border-green-500/30 bg-green-500/10';
      case 'B': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
      case 'C': return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      case 'D': return 'text-red-400 border-red-500/30 bg-red-500/10';
      default: return 'text-slate-400 border-slate-700 bg-slate-800';
    }
  };

  const getGradeLabel = (grade: string) => {
    switch (grade) {
      case 'A': return 'Excellent (Clean)';
      case 'B': return 'Good (Minor Wear/Dust)';
      case 'C': return 'Fair (Damaged/Grime)';
      case 'D': return 'Poor (Critical Failure)';
      default: return 'Unknown';
    }
  };

  const getFaultConfig = (fault: string) => {
    const text = fault.toLowerCase();
    
    // Thermal Damage
    if (text.includes('burn') || text.includes('char') || text.includes('scorch') || text.includes('heat') || text.includes('thermal')) {
      return {
        icon: <Flame className="w-5 h-5 text-orange-500 shrink-0" />,
        className: "border-orange-500/20 bg-orange-500/10 text-orange-200"
      };
    }
    
    // Liquid/Corrosion
    if (text.includes('corros') || text.includes('rust') || text.includes('oxid') || text.includes('moist') || text.includes('water') || text.includes('liquid') || text.includes('leak')) {
      return {
        icon: <Droplets className="w-5 h-5 text-cyan-400 shrink-0" />,
        className: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200"
      };
    }

    // Missing Components
    if (text.includes('miss') || text.includes('gone') || text.includes('lost') || text.includes('pad') || text.includes('detached')) {
      return {
        icon: <SearchX className="w-5 h-5 text-purple-400 shrink-0" />,
        className: "border-purple-500/20 bg-purple-500/10 text-purple-200"
      };
    }

    // Structural Damage
    if (text.includes('crack') || text.includes('break') || text.includes('broken') || text.includes('fracture') || text.includes('snap') || text.includes('chipped')) {
      return {
        icon: <Activity className="w-5 h-5 text-red-500 shrink-0" />,
        className: "border-red-500/20 bg-red-500/10 text-red-200"
      };
    }

    // Electrical Issues
    if (text.includes('short') || text.includes('solder') || text.includes('trace') || text.includes('bridge') || text.includes('connection')) {
      return {
        icon: <Zap className="w-5 h-5 text-yellow-400 shrink-0" />,
        className: "border-yellow-500/20 bg-yellow-500/10 text-yellow-200"
      };
    }

    // Alignment / Pins / Scratches
    if (text.includes('bent') || text.includes('pin') || text.includes('warp') || text.includes('align') || text.includes('scratch') || text.includes('scuff')) {
      return {
        icon: <Minimize2 className="w-5 h-5 text-indigo-400 shrink-0" />,
        className: "border-indigo-500/20 bg-indigo-500/10 text-indigo-200"
      };
    }

    // Cleanliness: Dust
    if (text.includes('dust') || text.includes('dirt') || text.includes('lint') || text.includes('fiber')) {
      return {
        icon: <Wind className="w-5 h-5 text-slate-400 shrink-0" />,
        className: "border-slate-500/20 bg-slate-500/10 text-slate-300"
      };
    }

    // Cleanliness: Debris/Residue
    if (text.includes('debris') || text.includes('grime') || text.includes('flux') || text.includes('residue') || text.includes('stain')) {
      return {
        icon: <Trash2 className="w-5 h-5 text-stone-400 shrink-0" />,
        className: "border-stone-500/20 bg-stone-500/10 text-stone-300"
      };
    }

    // Default generic fault
    return {
      icon: <XCircle className="w-5 h-5 text-red-400 shrink-0" />,
      className: "border-red-900/30 bg-red-900/10 text-red-300"
    };
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-400" />
        Condition & Damage Report
      </h2>

      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 rounded-lg border gap-4 sm:gap-0 ${getGradeColor(assessment.conditionGrade)}`}>
        <div>
          <p className="text-sm font-medium uppercase tracking-wider opacity-80">Condition Grade</p>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold font-mono">{assessment.conditionGrade}</span>
            <span className="text-lg font-medium opacity-90">{getGradeLabel(assessment.conditionGrade)}</span>
          </div>
        </div>
        <Gauge className="w-12 h-12 opacity-80 self-end sm:self-auto" />
      </div>

      <div className="bg-slate-800/40 rounded-lg p-5 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-3 uppercase tracking-wide flex items-center gap-2">
          <Scan className="w-4 h-4 text-slate-500" />
          Detailed Observations
        </h3>
        <p className="text-slate-400 mb-4 leading-relaxed text-sm">
          {assessment.conditionDescription}
        </p>

        {assessment.visibleFaults.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Detected Issues</h4>
            <ul className="space-y-2">
              {assessment.visibleFaults.map((fault, idx) => {
                const config = getFaultConfig(fault);
                return (
                  <li key={idx} className={`flex items-start gap-3 text-sm p-3 rounded-md border transition-all hover:bg-opacity-70 ${config.className}`}>
                    {config.icon}
                    <span className="leading-snug pt-0.5">{fault}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-400 bg-green-900/10 p-3 rounded border border-green-900/20 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>No critical visual faults or contamination detected.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DamageReport;
