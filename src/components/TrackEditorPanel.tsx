import React, {useState} from 'react';
import {
  ArrowUp,
  Check,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Play,
  RotateCcw,
  Save,
  TrendingDown,
  TrendingUp,
  Undo2,
  Upload,
  Zap,
  X,
} from 'lucide-react';
import type {TrackBiome, TrackDefinition, TrackPieceType} from '../game/types';

interface TrackEditorPanelProps {
  draftTrack: TrackDefinition;
  onChangeDraft: (next: TrackDefinition) => void;
  onTestDrive: () => void;
  onSaveAndClose: () => void;
  onExit: () => void;
}

const PIECE_OPTIONS: {type: TrackPieceType; label: string; icon: React.ReactNode}[] = [
  {type: 'straight', label: 'Straight', icon: <ArrowUp className="w-4 h-4" />},
  {type: 'left', label: 'Left 90', icon: <CornerUpLeft className="w-4 h-4" />},
  {type: 'right', label: 'Right 90', icon: <CornerUpRight className="w-4 h-4" />},
  {type: 'ramp_up', label: 'Climb', icon: <TrendingUp className="w-4 h-4" />},
  {type: 'ramp_down', label: 'Drop', icon: <TrendingDown className="w-4 h-4" />},
  {type: 'boost', label: 'Boost', icon: <Zap className="w-4 h-4 text-sky-400" />},
  {type: 'jump', label: 'Jump', icon: <ArrowUp className="w-4 h-4 text-amber-400" />},
  {type: 'checkpoint', label: 'Checkpt', icon: <Flag className="w-4 h-4 text-orange-400" />},
  {type: 'finish', label: 'Finish', icon: <Check className="w-4 h-4 text-emerald-400" />},
];

const BIOMES: {id: TrackBiome; label: string}[] = [
  {id: 'canyon', label: 'Canyon'},
  {id: 'skyline', label: 'Skyline'},
  {id: 'alpine', label: 'Alpine'},
];

export const TrackEditorPanel: React.FC<TrackEditorPanelProps> = ({
  draftTrack,
  onChangeDraft,
  onTestDrive,
  onSaveAndClose,
  onExit,
}) => {
  const [importOpen, setImportOpen] = useState(false);
  const [codeValue, setCodeValue] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');

  const addPiece = (type: TrackPieceType) => {
    onChangeDraft({
      ...draftTrack,
      pieces: [...draftTrack.pieces, type],
    });
  };

  const undoPiece = () => {
    if (draftTrack.pieces.length <= 1) return;
    onChangeDraft({
      ...draftTrack,
      pieces: draftTrack.pieces.slice(0, -1),
    });
  };

  const resetPieces = () => {
    onChangeDraft({
      ...draftTrack,
      pieces: ['start', 'straight'],
    });
  };

  const handleExport = () => {
    const payload = JSON.stringify({
      n: draftTrack.name,
      b: draftTrack.biome,
      p: draftTrack.pieces,
    });
    const encoded = btoa(unescape(encodeURIComponent(payload)));
    navigator.clipboard?.writeText(encoded).catch(() => {});
    setCodeValue(encoded);
    setImportOpen(true);
    setCopyFeedback('Track code ready & copied');
  };

  const handleImport = () => {
    try {
      const decoded = JSON.parse(decodeURIComponent(escape(atob(codeValue.trim()))));
      if (decoded && Array.isArray(decoded.p) && decoded.p.length >= 2) {
        onChangeDraft({
          ...draftTrack,
          name: typeof decoded.n === 'string' ? decoded.n : 'Imported Circuit',
          biome:
            decoded.b === 'canyon' || decoded.b === 'skyline' || decoded.b === 'alpine'
              ? decoded.b
              : 'canyon',
          pieces: decoded.p,
        });
        setImportOpen(false);
        setCopyFeedback('');
      } else {
        setCopyFeedback('Invalid track code');
      }
    } catch {
      setCopyFeedback('Invalid track code');
    }
  };

  const canDrive = draftTrack.pieces.length >= 3;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4">
      {/* Top Bar */}
      <div className="pointer-events-auto mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/80 bg-[#0d1320]/95 px-4 py-2.5 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="font-display text-sm font-bold tracking-wide text-orange-400 whitespace-nowrap shrink-0">
            TRACK BUILDER
          </span>
          <input
            type="text"
            value={draftTrack.name}
            maxLength={28}
            onChange={(e) => onChangeDraft({...draftTrack, name: e.target.value})}
            aria-label="Track name"
            className="w-44 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-sm font-medium text-slate-100 focus:border-orange-500 focus:outline-none"
          />
          <div className="hidden sm:flex items-center gap-1 rounded-lg bg-slate-900 p-1 border border-slate-800">
            {BIOMES.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onChangeDraft({...draftTrack, biome: b.id})}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  draftTrack.biome === b.id
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
          <span className="font-mono-num text-xs text-slate-400 whitespace-nowrap shrink-0">
            {draftTrack.pieces.length} pieces
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Share / Import
          </button>
          <button
            type="button"
            onClick={onTestDrive}
            disabled={!canDrive}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            Test Drive
          </button>
          <button
            type="button"
            onClick={onSaveAndClose}
            disabled={!canDrive}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-orange-400 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Save Track
          </button>
          <button
            type="button"
            onClick={onExit}
            aria-label="Exit Track Builder"
            className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Share / Import Modal */}
      {importOpen && (
        <div className="pointer-events-auto mx-auto w-full max-w-lg rounded-xl border border-slate-700 bg-[#0d1320]/98 p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-display text-sm font-bold text-slate-100">
              Offline Track Code
            </h4>
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <textarea
            value={codeValue}
            onChange={(e) => setCodeValue(e.target.value)}
            rows={3}
            placeholder="Paste a PolySprint track code here..."
            className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2.5 font-mono text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
          />
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">{copyFeedback}</span>
            <button
              type="button"
              onClick={handleImport}
              className="rounded-lg bg-sky-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400 cursor-pointer"
            >
              Load Code
            </button>
          </div>
        </div>
      )}

      {/* Bottom Dock Palette */}
      <div className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-wrap items-center justify-center gap-1.5 rounded-xl border border-slate-700/80 bg-[#0d1320]/95 px-3 py-2.5 shadow-2xl">
        {PIECE_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            type="button"
            onClick={() => addPiece(opt.type)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-orange-500/60 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        ))}

        <div className="mx-1 h-6 w-px bg-slate-700" />

        <button
          type="button"
          onClick={undoPiece}
          disabled={draftTrack.pieces.length <= 1}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Undo2 className="w-4 h-4" />
          Undo
        </button>
        <button
          type="button"
          onClick={resetPieces}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-950/50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Clear
        </button>
      </div>
    </div>
  );
};
