interface SeasonalData {
  Jan?: number;
  Feb?: number;
  Mar?: number;
  Apr?: number;
  May?: number;
  Jun?: number;
  Jul?: number;
  Aug?: number;
  Sep?: number;
  Oct?: number;
  Nov?: number;
  Dec?: number;
  bestSeason?: string;
}

export interface Trail {
  id: string;
  name: string;
  fullName: string;
  distance: number;
  distanceExtended: number;
  elevationStart: number;
  elevationMax: number;
  difficulty: string;
  notes: string;
  seasonal: SeasonalData;
  parking: string;
  range: string;
  difficultyOrder: number;
  altNames?: string[];
  parkingInfo?: string;
  bestSeason?: string;
  availableMonths?: string[];
  isWilderness?: boolean;
  webLink?: string;
  tideStationId?: string;
  hasGpx?: boolean;
  gpxFile?: string;
  trailHeadLat?: number;
  trailHeadLon?: number;
}

export interface TrailDetail {
  fullDescription: string;
  leaders: string[];
  pros: string | null;
  others: string | null;
}

interface ScheduleEntry {
  day: number;
  slot?: number;
  trail_id: string;
  early_start?: number | boolean;
  leader?: string;
}

export interface ScheduleData {
  [monthKey: string]: ScheduleEntry[];
}

export interface LookupData {
  difficulties: Array<{ code: string; order: number; label: string }>;
  parkingLevels: Record<string, string>;
}

export interface TrailsData {
  trails: Trail[];
}

export interface TrailDetailsData {
  [id: string]: TrailDetail;
}


