import type {GhostFrame, TrackDefinition, TrackRecord} from './types';

const RECORDS_PREFIX = 'polysprint_record_v1_';
const CUSTOM_TRACKS_KEY = 'polysprint_custom_tracks_v1';
const MUTE_KEY = 'polysprint_muted_v1';

export function getTrackRecord(trackId: string): TrackRecord {
  try {
    const raw = localStorage.getItem(RECORDS_PREFIX + trackId);
    if (raw) {
      const parsed = JSON.parse(raw) as TrackRecord;
      if (parsed && typeof parsed === 'object') {
        return {
          trackId,
          bestTimeMs: typeof parsed.bestTimeMs === 'number' ? parsed.bestTimeMs : null,
          ghost: Array.isArray(parsed.ghost) ? parsed.ghost : [],
          updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
        };
      }
    }
  } catch {
    // Fallback cleanly if storage is unavailable
  }
  return {
    trackId,
    bestTimeMs: null,
    ghost: [],
    updatedAt: 0,
  };
}

export function saveTrackRecord(
  trackId: string,
  bestTimeMs: number,
  ghost: GhostFrame[],
): TrackRecord {
  // Downsample ghost to ~20 Hz to keep localStorage fast & compact offline
  const compacted: GhostFrame[] = [];
  let lastT = -1;
  for (let i = 0; i < ghost.length; i++) {
    const f = ghost[i];
    if (i === 0 || i === ghost.length - 1 || f.t - lastT >= 0.048) {
      compacted.push({
        t: Math.round(f.t * 1000) / 1000,
        x: Math.round(f.x * 100) / 100,
        y: Math.round(f.y * 100) / 100,
        z: Math.round(f.z * 100) / 100,
        heading: Math.round(f.heading * 1000) / 1000,
        pitch: Math.round(f.pitch * 1000) / 1000,
        roll: Math.round(f.roll * 1000) / 1000,
      });
      lastT = f.t;
    }
  }

  const record: TrackRecord = {
    trackId,
    bestTimeMs,
    ghost: compacted,
    updatedAt: Date.now(),
  };

  try {
    localStorage.setItem(RECORDS_PREFIX + trackId, JSON.stringify(record));
  } catch {
    // If quota is tight, save time without ghost frames
    try {
      localStorage.setItem(
        RECORDS_PREFIX + trackId,
        JSON.stringify({...record, ghost: []}),
      );
    } catch {
      // ignore
    }
  }
  return record;
}

export function loadCustomTracks(): TrackDefinition[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TRACKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is TrackDefinition =>
        Boolean(t && typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.pieces)),
    );
  } catch {
    return [];
  }
}

export function saveCustomTrack(track: TrackDefinition): TrackDefinition[] {
  const existing = loadCustomTracks().filter((t) => t.id !== track.id);
  const next = [{...track, isCustom: true}, ...existing];
  try {
    localStorage.setItem(CUSTOM_TRACKS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function deleteCustomTrack(trackId: string): TrackDefinition[] {
  const next = loadCustomTracks().filter((t) => t.id !== trackId);
  try {
    localStorage.setItem(CUSTOM_TRACKS_KEY, JSON.stringify(next));
    localStorage.removeItem(RECORDS_PREFIX + trackId);
  } catch {
    // ignore
  }
  return next;
}

export function loadMutedPreference(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveMutedPreference(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? 'true' : 'false');
  } catch {
    // ignore
  }
}
