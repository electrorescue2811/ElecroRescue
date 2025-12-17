import React, { useCallback, useState } from 'react';
import { Upload, ImageIcon, Loader2 } from 'lucide-react';

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  isLoading: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onImageSelect, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        onImageSelect(file);
      }
    }
  }, [onImageSelect]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageSelect(e.target.files[0]);
    }
  }, [onImageSelect]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative overflow-hidden rounded-xl border-2 border-dashed transition-all duration-300
        min-h-[300px] flex flex-col items-center justify-center text-center p-8
        ${isDragging 
          ? 'border-blue-500 bg-blue-500/10' 
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
        }
        ${isLoading ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        disabled={isLoading}
      />
      
      {isLoading ? (
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-white">Analyzing Circuitry...</h3>
            <p className="text-sm text-slate-400">Identifying components and assessing condition</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6">
          <div className={`p-4 rounded-full transition-colors ${isDragging ? 'bg-blue-500/20' : 'bg-slate-700/50'}`}>
            {isDragging ? (
              <ImageIcon className="w-10 h-10 text-blue-400" />
            ) : (
              <Upload className="w-10 h-10 text-slate-400" />
            )}
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-medium text-white">
              {isDragging ? 'Drop image to analyze' : 'Upload PCB Image'}
            </h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Drag and drop your PCB photo here
            </p>
          </div>

          <div className="relative z-0">
             <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2 pointer-events-none">
              <Upload className="w-4 h-4" />
              Select Image
            </button>
            <p className="text-xs text-slate-500 mt-3 font-mono">Supports JPG, PNG, WEBP</p>
          </div>

          <div className="flex gap-4 mt-2">
            <span className="px-3 py-1 bg-slate-900 rounded border border-slate-700 text-xs text-slate-500 font-mono">
              COMPONENTS
            </span>
            <span className="px-3 py-1 bg-slate-900 rounded border border-slate-700 text-xs text-slate-500 font-mono">
              DAMAGE
            </span>
            <span className="px-3 py-1 bg-slate-900 rounded border border-slate-700 text-xs text-slate-500 font-mono">
              ₹ VALUATION
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;