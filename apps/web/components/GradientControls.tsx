'use client';

import { useState } from 'react';

export default function GradientControls() {
  const [showControls, setShowControls] = useState(true);
  const [params, setParams] = useState({
    zoom: 0.3,
    speed: 0.12,
    grainAmount: 0.018,
    grainSpeed: 5.0
  });

  return (
    <>
      {/* Parameter Controls */}
      {showControls && (
        <div className="glass-panel-strong rounded-2xl p-6 shadow-xl border border-white/30 w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Gradient Controls</h3>
            <button
              onClick={() => setShowControls(false)}
              className="text-white hover:text-red-400 text-xl font-bold"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-white mb-2">
                uZoom: {params.zoom.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={params.zoom}
                onChange={(e) => setParams({ ...params, zoom: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-white mb-2">
                uSpeed: {params.speed.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={params.speed}
                onChange={(e) => setParams({ ...params, speed: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-white mb-2">
                uGrainAmount: {params.grainAmount.toFixed(3)}
              </label>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.001"
                value={params.grainAmount}
                onChange={(e) => setParams({ ...params, grainAmount: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-white mb-2">
                uGrainSpeed: {params.grainSpeed.toFixed(1)}
              </label>
              <input
                type="range"
                min="0"
                max="20"
                step="0.1"
                value={params.grainSpeed}
                onChange={(e) => setParams({ ...params, grainSpeed: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            <div className="pt-4 border-t border-white/20">
              <p className="text-xs text-white/70 mb-2">Current values:</p>
              <pre className="text-xs text-white/90 bg-black/20 p-2 rounded">
                {JSON.stringify(params, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Toggle button when hidden */}
      {!showControls && (
        <button
          onClick={() => setShowControls(true)}
          className="glass-panel-strong rounded-xl px-4 py-2 shadow-lg border border-white/30 text-white font-bold hover:bg-white/20"
        >
          ⚙️ Gradient Controls
        </button>
      )}
    </>
  );
}
