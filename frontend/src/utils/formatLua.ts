export interface ParsedTrack {
  id: string;
  title: string;
  artist: string;
  assetId: string;
  status: string;
  rawName: string;
}

/**
  Parse a track title/name string into artist and title.
  Handles common patterns like:
  - "Artist - Title"
  - "Artist – Title" or "Artist — Title"
  - "Title by Artist"
  - Strips file extensions like .mp3, .ogg, .wav
 */
export function parseArtistAndTitle(rawName: string, fallbackArtist: string = 'Unknown'): { title: string; artist: string } {
  if (!rawName) return { title: 'Untitled Audio', artist: fallbackArtist };

  // Remove file extension
  let cleanName = rawName.replace(/\.(mp3|ogg|wav|m4a|flac)$/i, '').trim();

  // Pattern: "Artist - Title" or "Artist – Title" or "Artist — Title" or "Artist : Title"
  const hyphenMatch = cleanName.match(/^([^\-\–\—\:]+)\s*[\-\–\—\:]\s*(.+)$/);
  if (hyphenMatch) {
    return {
      artist: hyphenMatch[1].trim(),
      title: hyphenMatch[2].trim()
    };
  }

  // Pattern: "Title by Artist"
  const byMatch = cleanName.match(/^(.+)\s+by\s+(.+)$/i);
  if (byMatch) {
    return {
      title: byMatch[1].trim(),
      artist: byMatch[2].trim()
    };
  }

  return {
    title: cleanName,
    artist: fallbackArtist
  };
}

/**
  Format Roblox asset ID to rbxassetid:// format.
 */
export function formatRobloxAssetId(assetId: string | null | undefined): string {
  if (!assetId) return 'rbxassetid://0';
  const cleanId = String(assetId).trim();
  if (cleanId.startsWith('rbxassetid://')) {
    return cleanId;
  }
  // Strip non-digits if necessary or keep raw
  const digitsOnly = cleanId.replace(/\D/g, '');
  return digitsOnly ? `rbxassetid://${digitsOnly}` : `rbxassetid://${cleanId}`;
}

/**
  Generate Lua table string for an array of parsed tracks.
  Format:
  {
      title = "Bintang 5", 
      artist = "Tenxi",
      id = "rbxassetid://75208028481819",
  },
 */
export function generateLuaFormat(tracks: Array<{ title: string; artist: string; assetId?: string }>, wrapInList: boolean = false, variableName: string = 'MusicList'): string {
  const snippets = tracks.map(t => {
    const assetStr = formatRobloxAssetId(t.assetId);
    // Format matching exact user request with tab indentation
    return `{\n\ttitle = "${t.title.replace(/"/g, '\\"')}", \n\tartist = "${t.artist.replace(/"/g, '\\"')}",\n\tid = "${assetStr}",\n},`;
  });

  const body = snippets.join('\n');

  if (wrapInList) {
    return `local ${variableName} = {\n${snippets.map(s => s.split('\n').map(line => '\t' + line).join('\n')).join('\n')}\n}`;
  }

  return body;
}
