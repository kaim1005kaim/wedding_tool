'use client';

import { useState } from 'react';
import { useGradientStore } from '@/lib/store/gradient-store';

export default function GradientControls() {
  const [showControls, setShowControls] = useState(true);
  const globalParams = useGradientStore((state) => state.params);
  const setGlobalParams = useGradientStore((state) => state.setParams);

  const [localParams, setLocalParams] = useState(globalParams);
  const [applied, setApplied] = useState(true);

  const handleApply = () => {
    setGlobalParams(localParams);
    setApplied(true);
  };

  const handleChange = (key: keyof typeof localParams, value: number) => {
    setLocalParams({ ...localParams, [key]: value });
    setApplied(false);
  };

  return (
    <>
      {showControls && (
        <div className="glass-panel-strong rounded-2xl p-6 shadow-xl border border-white/30 w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Gradient Controls</h3>
            <button onClick={() => setShowControls(false)} className="text-white hover:text-red-400 text-xl font-bold">
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-white mb-2">uZoom: {localParams.zoom.toFixed(2)}</label>
              <input type="range" min="0" max="2" step="0.01" value={localParams.zoom} onChange={(e) => handleChange('zoom', parseFloat(e.target.value))} className="w-full" />
            </div>

            <div>
              <label className="block text-sm font-bold text-white mb-2">uSpeed: {localParams.speed.toFixed(2)}</label>
              <input type="range" min="0" max="2" step="0.01" value={localParams.speed} onChange={(e) => handleChange('speed', parseFloat(e.target.value))} className="w-full" />
            </div>

            <div>
              <label className="block text-sm font-bold text-white mb-2">uGrainAmount: {localParams.grainAmount.toFixed(3)}</label>
              <input type="range" min="0" max="0.5" step="0.001" value={localParams.grainAmount} onChange={(e) => handleChange('grainAmount', parseFloat(e.target.value))} className="w-full" />
            </div>

            <div>
              <label className="block text-sm font-bold text-white mb-2">uGrainSpeed: {localParams.grainSpeed.toFixed(1)}</label>
              <input type="range" min="0" max="20" step="0.1" value={localParams.grainSpeed} onChange={(e) => handleChange('grainSpeed', parseFloat(e.target.value))} className="w-full" />
            </div>

            <div className="pt-4 border-t border-white/20">
              <button onClick={handleApply} disabled={applied} className={`w-full px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${applied ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 active:scale-95'}`}>
                {applied ? '✓ 反映済み' : '反映する'}
              </button>
            </div>

            <div className="pt-2">
              <p className="text-xs text-white/70 mb-2">Current values:</p>
              <pre className="text-xs text-white/90 bg-black/20 p-2 rounded">{JSON.stringify(localParams, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}

      {!showControls && (
        <button onClick={() => setShowControls(true)} className="glass-panel-strong rounded-xl px-4 py-2 shadow-lg border border-white/30 text-white font-bold hover:bg-white/20">
          ⚙️ Gradient Controls
        </button>
      )}
    </>
  );
}
