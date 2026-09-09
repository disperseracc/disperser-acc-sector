import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  Copy,
  Download,
  FileCode,
  Sparkles,
  Music,
  Edit2,
  ListFilter,
  CheckCircle2,
  Code2
} from 'lucide-react';
import { parseArtistAndTitle, formatRobloxAssetId, generateLuaFormat } from '@/utils/formatLua';

interface EditableTrack {
  id: string;
  rawName: string;
  title: string;
  artist: string;
  assetId: string;
  status: string;
}

interface AutoFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: any[];
}

export const AutoFormatModal: React.FC<AutoFormatModalProps> = ({
  isOpen,
  onClose,
  selectedItems,
}) => {
  const [tracks, setTracks] = useState<EditableTrack[]>([]);
  const [copied, setCopied] = useState(false);
  const [wrapInTable, setWrapInTable] = useState(false);
  const [varName, setVarName] = useState('MusicList');
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');

  // Initialize tracks whenever selectedItems or modal open changes
  useEffect(() => {
    if (isOpen && selectedItems.length > 0) {
      const parsed = selectedItems.map(item => {
        const { title, artist } = parseArtistAndTitle(item.name || item.assetName || '');
        return {
          id: item.id,
          rawName: item.name || item.assetName || 'Untitled',
          title: item.title || title,
          artist: item.artist || artist,
          assetId: item.assetId || item.asset_id || '',
          status: item.status || 'pending',
        };
      });
      setTracks(parsed);
      setCopied(false);
    }
  }, [isOpen, selectedItems]);

  const handleTrackChange = (id: string, field: 'title' | 'artist' | 'assetId', value: string) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const luaCode = useMemo(() => {
    return generateLuaFormat(tracks, wrapInTable, varName);
  }, [tracks, wrapInTable, varName]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(luaCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([luaCode], { type: 'text/x-lua;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `music_format_${Date.now()}.lua`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-800/80 bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                Auto Format Lua
                <Badge variant="secondary" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[10px]">
                  {tracks.length} {tracks.length === 1 ? 'Track' : 'Tracks'}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                Formatted Lua structure for Roblox audio selection
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${activeTab === 'preview' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              <Code2 size={13} /> Preview
            </button>
            <button
              onClick={() => setActiveTab('edit')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${activeTab === 'edit' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              <Edit2 size={13} /> Edit ({tracks.length})
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {activeTab === 'preview' ? (
            <div className="space-y-4">
              {/* Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="wrap-switch"
                    checked={wrapInTable}
                    onCheckedChange={(checked) => setWrapInTable(!!checked)}
                  />
                  <Label htmlFor="wrap-switch" className="text-xs text-slate-300 font-medium cursor-pointer">
                    Wrap in Roblox Table Variable
                  </Label>
                </div>

                {wrapInTable && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">local</span>
                    <Input
                      value={varName}
                      onChange={(e) => setVarName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      className="bg-slate-950 border-slate-800 h-8 text-xs font-mono text-cyan-400 w-36"
                      placeholder="MusicList"
                    />
                    <span className="text-xs font-mono text-slate-500">= {"{"}</span>
                  </div>
                )}
              </div>

              {/* Code Snippet Box */}
              <div className="relative rounded-xl border border-slate-800 bg-[#0b0e14] overflow-hidden group">
                <div className="flex items-center justify-between bg-slate-900/80 px-4 py-2 border-b border-slate-800 text-[11px] font-mono text-slate-400">
                  <div className="flex items-center gap-2">
                    <FileCode size={13} className="text-cyan-400" />
                    <span>roblox_music.lua</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Lua Table Syntax</span>
                </div>
                <pre className="p-4 text-xs font-mono text-cyan-200 overflow-x-auto leading-relaxed max-h-[350px] custom-scrollbar selection:bg-cyan-500/30 selection:text-white">
                  <code>{luaCode}</code>
                </pre>
              </div>
            </div>
          ) : (
            /* Interactive Track Details Editor */
            <div className="space-y-4">
              <div className="bg-slate-900/40 border border-slate-800/80 p-3 rounded-xl text-xs text-slate-400 flex items-center gap-2">
                <Sparkles size={14} className="text-cyan-400 shrink-0" />
                <span>Adjust song title, artist name, or ID before generating code. Changes update in real-time.</span>
              </div>

              <div className="space-y-3">
                {tracks.map((track, idx) => (
                  <div key={track.id || idx} className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Music size={14} className="text-cyan-400" />
                        <span className="text-xs font-bold text-white truncate max-w-[280px]">{track.rawName}</span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] py-0 ${track.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}
                      >
                        {track.status === 'success' ? 'Accepted' : track.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Title</Label>
                        <Input
                          value={track.title}
                          onChange={(e) => handleTrackChange(track.id, 'title', e.target.value)}
                          className="bg-slate-950 border-slate-800 h-8 text-xs font-medium text-white"
                          placeholder="Song Title"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Artist</Label>
                        <Input
                          value={track.artist}
                          onChange={(e) => handleTrackChange(track.id, 'artist', e.target.value)}
                          className="bg-slate-950 border-slate-800 h-8 text-xs font-medium text-white"
                          placeholder="Artist Name"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Roblox ID</Label>
                        <Input
                          value={track.assetId}
                          onChange={(e) => handleTrackChange(track.id, 'assetId', e.target.value)}
                          className="bg-slate-950 border-slate-800 h-8 text-xs font-mono text-cyan-400"
                          placeholder="75208028481819"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 border-t border-slate-800/80 bg-slate-900/50 flex flex-row items-center justify-between sm:justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300 text-xs gap-2"
          >
            <Download size={14} /> Download .lua
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xs"
            >
              Close
            </Button>
            <Button
              onClick={handleCopy}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs px-5 gap-2 shadow-lg shadow-cyan-500/20 font-bold"
            >
              {copied ? <CheckCircle2 size={16} className="text-emerald-300" /> : <Copy size={16} />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Lua Code'}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
