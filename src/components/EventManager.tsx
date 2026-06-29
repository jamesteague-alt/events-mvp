import React, { useState, useMemo, useId } from 'react';
import {
  Search, Filter, Radio, Video, Calendar, MapPin, Users, Globe, Eye, EyeOff, Edit2,
  Trash2, Copy, Check, ChevronDown, ChevronUp, X, Clock, Upload,
  AlertCircle, Plus, Archive, Shield, CreditCard, Captions,
  Power, Square, Zap, Activity, Play, Volume2, VolumeX, Monitor,
  ChevronLeft, ChevronRight, Pause, Maximize2,
  Crown, Mail, UserPlus, UserX, RefreshCw,
} from 'lucide-react';

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────

type InputType = 'RTMP_PUSH' | 'SRT_CALLER' | 'RTP_PUSH' | 'HLS_PULL' | 'MEDIACONNECT';
type EventStatus = 'live' | 'upcoming' | 'ended' | 'draft';
type ChannelState = 'idle' | 'starting' | 'running' | 'stopping';
type ViewMode = 'listing' | 'create' | 'edit' | 'vip-members';
type VipDistributionStatus = 'pending' | 'queued' | 'sent' | 'failed';

// ─── BROADCAST PRESETS ───────────────────────────────────────────────────────
type PresetStatus = 'ACTIVE' | 'IN_USE';

interface PresetInput {
  input_type: InputType;
  protocol_label: string;
  endpoint_url: string;
  endpoint_port?: number;
  stream_key?: string;
}

interface PresetOutput {
  type: 'video' | 'radio';
  name: string;       // e.g. "Live Video", "Live Audio (Radio)"
  codec: string;      // e.g. "H.264 AVC", "AAC-LC"
  resolution: string; // shortened, e.g. "1080p" ("—" for audio)
  bitrate: string;    // e.g. "5 Mbps", "128 kbps"
}

// Broadcast "extras" — toggled on the preset, surfaced per-stream as pills/boxes (like Live2VOD).
interface PresetExtras {
  live2vod: boolean;
  vip: boolean;       // mirror video streams to the VIP roster
  captions: boolean;  // Live Captions — ENG
}

interface BroadcastPreset {
  preset_id: string;
  name: string;
  status: PresetStatus;
  input: PresetInput;
  outputs: PresetOutput[];
  extras: PresetExtras;
}

// ─── DATA INTEGRATION (Opta / stats feed) ────────────────────────────────────
type StatsFeedProvider = 'opta' | 'statsperform' | 'genius' | 'sportradar';
type SourceProvider = StatsFeedProvider | 'manual';

interface CatalogFixture {
  opta_id: string;
  home_team: string;
  away_team: string;
  competition: string;
  round: string;
  venue: string;
  kickoff_iso: string;
}

interface StatsFeedSettings {
  provider: StatsFeedProvider;
  primary_team_display: string;
  credentials_configured: boolean;
  competitions_in_scope: string[];
  default_pull_count: number;
}

interface SourceMatch {
  provider: SourceProvider;
  source_id: string;
  pulled_at: string;
  raw_snapshot: {
    home_team: string;
    away_team: string;
    competition: string;
    venue: string;
    kickoff_iso: string;
  };
}

interface StreamRights {
  geo_profile: string;
  geo_countries: string[];
  subscription_plans: string[];
  segment_ids: string[];
  combine_mode: 'AND' | 'OR';
}

interface SegmentDefinition {
  id: string;
  display_name: string;
}

interface StreamRow {
  id: string;
  preset_id: string;
  preset_name: string;
  input: PresetInput;
  output: PresetOutput;
  live2vod: boolean;
  vip: boolean;
  captions: boolean;
  rights: StreamRights;
  expanded: boolean;
}

interface VipRosterEntry {
  id: string;
  email: string;
  name?: string;
  added_at: string;
  added_by: string;
  revoked: boolean;
  revoked_at?: string;
}

interface VipDelivery {
  enabled: boolean;
  last_email_sent_at?: string;
  hosted_page_url?: string;
  distribution_status?: VipDistributionStatus;
}

const VIP_ROSTER_CAP = 50;
const VIP_ROSTER_SOFT_WARN = 40;

interface LiveEvent {
  id: string;
  title: string;
  description: string;
  status: EventStatus;
  channelState: ChannelState;
  includeMatchDetails: boolean;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  round: string;
  venue: string;
  event_start_time: string;
  kickoff_time: string;
  event_end_time: string;
  opta_id: string;
  external_id: string;
  source_match?: SourceMatch;
  visibility: 'visible' | 'hidden';
  image_16x9: { name: string; url: string } | null;
  currentViewers: number;
  peakViewers: number;
  streams: StreamRow[];
  vip_delivery: VipDelivery;
  apiUrl: string;
  isDraft: boolean;
}

// ─── SHARED CONSTANTS ────────────────────────────────────────────────────────

const BROADCAST_PRESETS: BroadcastPreset[] = [
  {
    preset_id: 'preset_stadium_hd', name: 'Stadium HD — Video + Radio', status: 'ACTIVE',
    input: { input_type: 'RTMP_PUSH', protocol_label: 'RTMP Push', endpoint_url: 'rtmp://ingest.medialive.eu-west-2.amazonaws.com/live', stream_key: 'bc001-a1b2c3d4e5f6' },
    outputs: [
      { type: 'video', name: 'Live Video',         codec: 'H.264 AVC', resolution: '1080p', bitrate: '5 Mbps' },
      { type: 'radio', name: 'Live Audio (Radio)', codec: 'AAC-LC',    resolution: '—',     bitrate: '128 kbps' },
    ],
    extras: { live2vod: true, vip: true, captions: true },
  },
  {
    preset_id: 'preset_srt_video', name: 'SRT Low-Latency — Video', status: 'ACTIVE',
    input: { input_type: 'SRT_CALLER', protocol_label: 'SRT Caller', endpoint_url: 'srt://ingest.medialive.eu-west-2.amazonaws.com', endpoint_port: 9001 },
    outputs: [
      { type: 'video', name: 'Live Video', codec: 'H.264 AVC', resolution: '1080p', bitrate: '5 Mbps' },
    ],
    extras: { live2vod: true, vip: false, captions: false },
  },
  {
    preset_id: 'preset_mediaconnect_multi', name: 'MediaConnect — Multi-bitrate + Radio', status: 'ACTIVE',
    input: { input_type: 'MEDIACONNECT', protocol_label: 'MediaConnect', endpoint_url: 'arn:aws:mediaconnect:eu-west-2:123456789:flow:bc005-main' },
    outputs: [
      { type: 'video', name: 'Live Video (HD)',    codec: 'H.264 AVC', resolution: '1080p', bitrate: '6 Mbps' },
      { type: 'video', name: 'Live Video (SD)',    codec: 'H.264 AVC', resolution: '720p',  bitrate: '3 Mbps' },
      { type: 'radio', name: 'Live Audio (Radio)', codec: 'AAC-LC',    resolution: '—',     bitrate: '128 kbps' },
    ],
    extras: { live2vod: false, vip: true, captions: true },
  },
  {
    preset_id: 'preset_training_hls', name: 'Training Ground — HLS Pull', status: 'IN_USE',
    input: { input_type: 'HLS_PULL', protocol_label: 'HLS Pull', endpoint_url: 'https://s3.eu-west-2.amazonaws.com/yc-live-backup/stream.m3u8' },
    outputs: [
      { type: 'video', name: 'Live Video', codec: 'H.264 AVC', resolution: '720p', bitrate: '3 Mbps' },
    ],
    extras: { live2vod: false, vip: false, captions: false },
  },
];

const FIXTURE_CATALOG: CatalogFixture[] = [
  { opta_id: 'g2412345', home_team: 'Burnley FC',       away_team: 'Blackburn Rovers', competition: 'EFL Championship', round: 'Regular Season', venue: 'Turf Moor',          kickoff_iso: '2026-03-15T15:00:00+00:00' },
  { opta_id: 'g2412401', home_team: 'Birmingham City',  away_team: 'Burnley FC',       competition: 'EFL Championship', round: 'Regular Season', venue: "St Andrew's",        kickoff_iso: '2026-03-22T15:00:00+00:00' },
  { opta_id: 'g2412458', home_team: 'Burnley FC',       away_team: 'Leicester City',   competition: 'EFL Championship', round: 'Regular Season', venue: 'Turf Moor',          kickoff_iso: '2026-03-29T13:30:00+00:00' },
  { opta_id: 'g2412513', home_team: 'Sheffield United', away_team: 'Burnley FC',       competition: 'EFL Championship', round: 'Regular Season', venue: 'Bramall Lane',       kickoff_iso: '2026-04-04T17:30:00+00:00' },
  { opta_id: 'g2412571', home_team: 'Burnley FC',       away_team: 'Leeds United',     competition: 'EFL Championship', round: 'Regular Season', venue: 'Turf Moor',          kickoff_iso: '2026-04-12T12:00:00+00:00' },
  { opta_id: 'g2412628', home_team: 'Sunderland',       away_team: 'Burnley FC',       competition: 'EFL Championship', round: 'Regular Season', venue: 'Stadium of Light',   kickoff_iso: '2026-04-18T15:00:00+00:00' },
  { opta_id: 'g2412684', home_team: 'Burnley FC',       away_team: 'Middlesbrough',    competition: 'EFL Championship', round: 'Regular Season', venue: 'Turf Moor',          kickoff_iso: '2026-04-26T15:00:00+00:00' },
  { opta_id: 'g2412741', home_team: 'Burnley FC',       away_team: 'West Brom',        competition: 'EFL Championship', round: 'Regular Season', venue: 'Turf Moor',          kickoff_iso: '2026-05-03T15:00:00+00:00' },
  { opta_id: 'g2412798', home_team: 'Norwich City',     away_team: 'Burnley FC',       competition: 'EFL Championship', round: 'Regular Season', venue: 'Carrow Road',        kickoff_iso: '2026-05-09T12:30:00+00:00' },
  { opta_id: 'g2412855', home_team: 'Burnley FC',       away_team: 'Coventry City',    competition: 'EFL Championship', round: 'Regular Season', venue: 'Turf Moor',          kickoff_iso: '2026-05-17T15:00:00+00:00' },
  { opta_id: 'fc2400988', home_team: 'Burnley FC',      away_team: 'Watford',          competition: 'FA Cup',           round: 'Round 4', venue: 'Turf Moor',          kickoff_iso: '2026-03-25T19:45:00+00:00' },
  { opta_id: 'fc2401012', home_team: 'Burnley FC',      away_team: 'Bolton Wanderers', competition: 'FA Cup',           round: 'Round 5', venue: 'Turf Moor',          kickoff_iso: '2026-04-08T19:45:00+00:00' },
  { opta_id: 'lc2400677', home_team: 'Burnley FC',      away_team: 'Wigan Athletic',   competition: 'EFL Cup',          round: 'Round 3', venue: 'Turf Moor',          kickoff_iso: '2026-03-19T19:45:00+00:00' },
  { opta_id: 'g2412912', home_team: 'Burnley FC',       away_team: 'Birmingham City',  competition: 'EFL Championship', round: 'Regular Season', venue: 'Turf Moor',          kickoff_iso: '2026-05-24T15:00:00+00:00' },
  { opta_id: 'g2412969', home_team: 'Leicester City',   away_team: 'Burnley FC',       competition: 'EFL Championship', round: 'Regular Season', venue: 'King Power Stadium', kickoff_iso: '2026-05-31T16:30:00+00:00' },
];

const initialStatsFeedSettings: StatsFeedSettings = {
  provider: 'opta',
  primary_team_display: 'Burnley FC',
  credentials_configured: true,
  competitions_in_scope: ['EFL Championship', 'FA Cup', 'EFL Cup'],
  default_pull_count: 10,
};

const TEAMS = [
  'Burnley FC', 'Blackburn Rovers', 'Birmingham City', 'Leicester City',
  'Sheffield United', 'Leeds United', 'Sunderland', 'Middlesbrough',
  'West Brom', 'Norwich City', 'Coventry City', 'Watford',
  'KC Current', 'Portland Thorns', 'Orlando Pride', 'Washington Spirit',
  'San Diego Wave', 'OL Reign', 'North Carolina Courage', 'Houston Dash',
  'Angel City FC', 'NJ/NY Gotham FC', 'Racing Louisville FC', 'Chicago Red Stars',
];

const VENUES = [
  'Turf Moor', 'Ewood Park', "St Andrew's", 'King Power Stadium',
  'Bramall Lane', 'Elland Road', 'Stadium of Light', 'Riverside Stadium',
  'CPKC Stadium', 'Providence Park', 'Snapdragon Stadium', 'BMO Stadium',
];

const COMPETITIONS = ['EFL Championship', 'FA Cup', 'EFL Cup', 'Friendly', 'Pre-Season', 'NWSL Regular Season'];

const ROUNDS = ['Regular Season', 'Group Stage', 'Round 3', 'Round 4', 'Round 5', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final', 'Play-off', 'Replay'];

const GEO_PROFILES = [
  'Worldwide (No Restrictions)', 'Domestic Only', 'International Only',
  'EFL Broadcast Territory', 'Europe Only', 'North America Only', 'Asia-Pacific', 'Custom',
];

const COUNTRIES = [
  'United Kingdom', 'United States', 'Canada', 'Germany', 'France', 'Spain',
  'Italy', 'Netherlands', 'Belgium', 'Sweden', 'Norway', 'Denmark',
  'Australia', 'Japan', 'South Korea', 'India', 'China', 'Brazil',
  'Argentina', 'Mexico', 'Ireland', 'Portugal', 'Poland', 'Switzerland',
];

const SUBSCRIPTION_PLANS = [
  { id: 'plan_free',      name: 'Free Tier',                  description: 'No subscription required' },
  { id: 'plan_monthly',   name: 'Monthly Pass (£9.99/mo)',    description: 'Rolling monthly subscription' },
  { id: 'plan_annual',    name: 'Annual Pass (£99.99/yr)',    description: 'Best value annual subscription' },
  { id: 'plan_matchday',  name: 'Match Day Pass (£4.99)',     description: 'Single event access' },
  { id: 'plan_season',    name: 'Season Ticket Holder',       description: 'Complimentary with season ticket' },
  { id: 'plan_premium',   name: 'Premium All-Access',         description: 'All live & VOD content' },
];

const SEGMENT_LIBRARY: SegmentDefinition[] = [
  { id: 'seg_season_ticket',         display_name: 'Season Ticket Holders' },
  { id: 'seg_members',               display_name: 'Members' },
  { id: 'seg_family_pass',           display_name: 'Family Pass Holders' },
  { id: 'seg_junior_members',        display_name: 'Junior Members' },
  { id: 'seg_corporate_hospitality', display_name: 'Corporate Hospitality' },
  { id: 'seg_media_accredited',      display_name: 'Media Accredited' },
  { id: 'seg_intl_supporters',       display_name: 'International Supporters Club' },
  { id: 'seg_internal_staff',        display_name: 'Internal Staff' },
  { id: 'seg_lapsed_fans',           display_name: 'Lapsed Fans (re-engagement)' },
  { id: 'seg_newsletter_optin',      display_name: 'Newsletter Subscribers' },
  { id: 'seg_app_active_30d',        display_name: 'Active App Users (30d)' },
  { id: 'seg_watched_last_match',    display_name: 'Watched Last Match' },
];

const INPUT_TYPE_COLORS: Record<InputType, string> = {
  RTMP_PUSH:    'bg-blue-100 text-blue-800',
  SRT_CALLER:   'bg-emerald-100 text-emerald-800',
  RTP_PUSH:     'bg-violet-100 text-violet-800',
  HLS_PULL:     'bg-amber-100 text-amber-800',
  MEDIACONNECT: 'bg-cyan-100 text-cyan-800',
};

const STREAM_ICONS = [
  { id: 'video', label: 'Video', Icon: Video },
  { id: 'radio', label: 'Radio', Icon: Radio },
];

// ─── UTILITIES ───────────────────────────────────────────────────────────────

const formatDateTime = (s: string): string => {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
};

const formatShortDate = (s: string): string => {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const calculateChannelStart = (d: string, t: string): string => {
  if (!d || !t) return '';
  const dt = new Date(`${d}T${t}`);
  dt.setMinutes(dt.getMinutes() - 90);
  return dt.toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
};

const getStatusColor = (status: EventStatus): string => {
  switch (status) {
    case 'live':     return 'bg-red-100 text-red-800 border-red-200';
    case 'upcoming': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'ended':    return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'draft':    return 'bg-amber-100 text-amber-800 border-amber-200';
    default:         return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

const getChannelStateDisplay = (state: ChannelState) => {
  switch (state) {
    case 'running':  return { label: 'Channel Running',    color: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' };
    case 'starting': return { label: 'Channel Starting…',  color: 'text-blue-700 bg-blue-50 border-blue-200',         dot: 'bg-blue-500 animate-pulse' };
    case 'stopping': return { label: 'Channel Stopping…',  color: 'text-amber-700 bg-amber-50 border-amber-200',      dot: 'bg-amber-500 animate-pulse' };
    default:         return { label: 'Channel Idle',       color: 'text-slate-500 bg-slate-50 border-slate-200',      dot: 'bg-slate-400' };
  }
};

const getMissingFields = (event: LiveEvent): string[] => {
  const missing: string[] = [];
  if (!event.description) missing.push('Description');
  if (!event.event_start_time) missing.push('Event Start Time');
  if (!event.kickoff_time) missing.push('Kick-off Time');
  if (!event.event_end_time) missing.push('Event End Time');
  if (event.streams.length === 0) missing.push('Streams (none configured)');
  if (event.includeMatchDetails && !event.venue) missing.push('Venue');
  const hasAnyRights = event.streams.some(
    s => s.rights.geo_profile || s.rights.geo_countries.length > 0 || s.rights.subscription_plans.length > 0 || s.rights.segment_ids.length > 0
  );
  if (!hasAnyRights && event.streams.length > 0) missing.push('Rights restrictions');
  return missing;
};

const EMPTY_STREAM_RIGHTS: StreamRights = { geo_profile: '', geo_countries: [], subscription_plans: [], segment_ids: [], combine_mode: 'AND' };

let rowCounter = 100;
// Generate one read-only Live Stream per preset output, ready for Rights & Restrictions.
const streamsFromPreset = (preset: BroadcastPreset): StreamRow[] =>
  preset.outputs.map(output => ({
    id: `sr-${++rowCounter}`,
    preset_id: preset.preset_id,
    preset_name: preset.name,
    input: preset.input,
    output,
    live2vod: preset.extras.live2vod,
    vip: preset.extras.vip,
    captions: preset.extras.captions,
    rights: { ...EMPTY_STREAM_RIGHTS },
    expanded: false,
  }));

const getReadiness = (event: LiveEvent): 'Draft' | 'Ready' => (event.streams.length > 0 ? 'Ready' : 'Draft');

// ─── DATA-INTEGRATION LOOKUP ─────────────────────────────────────────────────
type LookupMode  = 'id' | 'search';
type LookupState = 'idle' | 'searching' | 'matched' | 'not_found';

const lookupFixture = (idOrSearch: string, mode: LookupMode): CatalogFixture | null => {
  const q = idOrSearch.trim().toLowerCase();
  if (!q) return null;
  if (mode === 'id') return FIXTURE_CATALOG.find(f => f.opta_id.toLowerCase() === q) || null;
  return FIXTURE_CATALOG.find(f =>
    f.home_team.toLowerCase().includes(q) || f.away_team.toLowerCase().includes(q) || f.competition.toLowerCase().includes(q)
  ) || null;
};

// ─── MOCK INITIAL EVENTS ─────────────────────────────────────────────────────

const RTMP_INPUT: PresetInput = { input_type: 'RTMP_PUSH', protocol_label: 'RTMP Push', endpoint_url: 'rtmp://ingest.medialive.eu-west-2.amazonaws.com/live', stream_key: 'bc001-a1b2c3d4e5f6' };
const SRT_INPUT: PresetInput  = { input_type: 'SRT_CALLER', protocol_label: 'SRT Caller', endpoint_url: 'srt://ingest.medialive.eu-west-2.amazonaws.com', endpoint_port: 9001 };
const OUT_VIDEO: PresetOutput = { type: 'video', name: 'Live Video', codec: 'H.264 AVC', resolution: '1080p', bitrate: '5 Mbps' };
const OUT_RADIO: PresetOutput = { type: 'radio', name: 'Live Audio (Radio)', codec: 'AAC-LC', resolution: '—', bitrate: '128 kbps' };

// Seed dates are computed relative to "today" so the listing's date sort + Previous Events reveal are demonstrable.
const DAY_MS = 86400000;
const seedISO = (offsetDays: number, h: number, m: number): string => {
  const d = new Date(Date.now() + offsetDays * DAY_MS); d.setHours(h, m, 0, 0); return d.toISOString();
};
const seedStreams = (presetId: string): StreamRow[] => streamsFromPreset(BROADCAST_PRESETS.find(p => p.preset_id === presetId)!);

const initialEvents: LiveEvent[] = [
  {
    id: 'evt_001', title: 'KC Current vs Portland Thorns',
    description: 'Regular season match featuring two top teams in the league',
    status: 'live', channelState: 'running', includeMatchDetails: true,
    homeTeam: 'KC Current', awayTeam: 'Portland Thorns', competition: 'NWSL Regular Season', round: 'Regular Season', venue: 'CPKC Stadium',
    event_start_time: seedISO(0, 18, 30), kickoff_time: seedISO(0, 19, 0), event_end_time: seedISO(0, 21, 0),
    opta_id: 'g8812345', external_id: '',
    source_match: { provider: 'opta', source_id: 'g8812345', pulled_at: '2026-01-20T10:00:00Z', raw_snapshot: { home_team: 'KC Current', away_team: 'Portland Thorns', competition: 'NWSL Regular Season', venue: 'CPKC Stadium', kickoff_iso: '2026-01-26T19:00:00' } },
    visibility: 'visible',
    image_16x9: null, currentViewers: 12453, peakViewers: 15782,
    streams: [
      { id: 'sr-001a', preset_id: 'preset_stadium_hd', preset_name: 'Stadium HD — Video + Radio', input: RTMP_INPUT, output: OUT_VIDEO,    live2vod: true,  vip: true, captions: true, rights: { geo_profile: 'Domestic Only', geo_countries: [], subscription_plans: ['plan_season', 'plan_premium'], segment_ids: [], combine_mode: 'AND' }, expanded: false },
      { id: 'sr-001b', preset_id: 'preset_stadium_hd', preset_name: 'Stadium HD — Video + Radio', input: RTMP_INPUT, output: OUT_RADIO,    live2vod: true,  vip: true, captions: true, rights: { geo_profile: 'Worldwide (No Restrictions)', geo_countries: [], subscription_plans: ['plan_free'], segment_ids: [], combine_mode: 'AND' }, expanded: false },
    ],
    vip_delivery: { enabled: true, hosted_page_url: 'https://vip.yinzcam.com/burnley/evt_001', distribution_status: 'pending' }, apiUrl: 'https://api.example.com/v1/events/evt_001', isDraft: false,
  },
  {
    id: 'evt_002', title: 'Season Launch Press Conference',
    description: 'Join us for the official 2026 season announcement with special guests',
    status: 'upcoming', channelState: 'idle', includeMatchDetails: false,
    homeTeam: '', awayTeam: '', competition: '', round: '', venue: '',
    event_start_time: seedISO(2, 13, 45), kickoff_time: seedISO(2, 14, 0), event_end_time: seedISO(2, 15, 30),
    opta_id: '', external_id: 'PRESS-2026-001', visibility: 'visible',
    image_16x9: null, currentViewers: 0, peakViewers: 0,
    streams: [
      { id: 'sr-002a', preset_id: 'preset_srt_video', preset_name: 'SRT Low-Latency — Video', input: SRT_INPUT, output: OUT_VIDEO, live2vod: true, vip: false, captions: false, rights: { geo_profile: 'Worldwide (No Restrictions)', geo_countries: [], subscription_plans: ['plan_free'], segment_ids: [], combine_mode: 'AND' }, expanded: false },
    ],
    vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_002', isDraft: false,
  },
  {
    id: 'evt_003', title: 'Orlando Pride vs Washington Spirit',
    description: '', status: 'draft', channelState: 'idle', includeMatchDetails: true,
    homeTeam: 'Orlando Pride', awayTeam: 'Washington Spirit', competition: 'NWSL Regular Season', round: 'Regular Season', venue: '',
    event_start_time: seedISO(4, 17, 0), kickoff_time: seedISO(4, 17, 30), event_end_time: '',
    opta_id: '', external_id: '', visibility: 'hidden',
    image_16x9: null, currentViewers: 0, peakViewers: 0,
    streams: [], vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_003', isDraft: true,
  },
  {
    id: 'evt_004', title: 'Player Q&A Session',
    description: 'Interactive session with star players answering fan questions',
    status: 'ended', channelState: 'idle', includeMatchDetails: false,
    homeTeam: '', awayTeam: '', competition: '', round: '', venue: '',
    event_start_time: seedISO(-3, 15, 45), kickoff_time: seedISO(-3, 16, 0), event_end_time: seedISO(-3, 17, 0),
    opta_id: '', external_id: '', visibility: 'visible',
    image_16x9: null, currentViewers: 0, peakViewers: 8432,
    streams: [
      { id: 'sr-004a', preset_id: 'preset_srt_video', preset_name: 'SRT Low-Latency — Video', input: SRT_INPUT, output: OUT_VIDEO, live2vod: true, vip: false, captions: false, rights: { geo_profile: 'Worldwide (No Restrictions)', geo_countries: [], subscription_plans: ['plan_monthly', 'plan_annual'], segment_ids: ['seg_junior_members', 'seg_family_pass'], combine_mode: 'OR' }, expanded: false },
    ],
    vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_004', isDraft: false,
  },
  {
    id: 'evt_005', title: 'San Diego Wave vs OL Reign',
    description: 'Western Conference battle for playoff positioning',
    status: 'ended', channelState: 'idle', includeMatchDetails: true,
    homeTeam: 'San Diego Wave', awayTeam: 'OL Reign', competition: 'NWSL Regular Season', round: 'Regular Season', venue: 'Snapdragon Stadium',
    event_start_time: seedISO(-6, 19, 30), kickoff_time: seedISO(-6, 20, 0), event_end_time: seedISO(-6, 22, 0),
    opta_id: 'g8898765', external_id: '',
    source_match: { provider: 'opta', source_id: 'g8898765', pulled_at: '2026-01-18T09:00:00Z', raw_snapshot: { home_team: 'San Diego Wave', away_team: 'OL Reign', competition: 'NWSL Regular Season', venue: 'Snapdragon Stadium', kickoff_iso: '2026-01-24T20:00:00' } },
    visibility: 'visible',
    image_16x9: null, currentViewers: 0, peakViewers: 18942,
    streams: [
      { id: 'sr-005a', preset_id: 'preset_stadium_hd', preset_name: 'Stadium HD — Video + Radio', input: RTMP_INPUT, output: OUT_VIDEO, live2vod: true, vip: true, captions: true, rights: { geo_profile: 'North America Only', geo_countries: [], subscription_plans: ['plan_season', 'plan_premium'], segment_ids: [], combine_mode: 'AND' }, expanded: false },
      { id: 'sr-005b', preset_id: 'preset_stadium_hd', preset_name: 'Stadium HD — Video + Radio', input: RTMP_INPUT, output: OUT_RADIO, live2vod: true, vip: true, captions: true, rights: { geo_profile: 'Worldwide (No Restrictions)', geo_countries: [], subscription_plans: ['plan_free'], segment_ids: [], combine_mode: 'AND' }, expanded: false },
    ],
    vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_005', isDraft: false,
  },
  {
    id: 'evt_006', title: 'Burnley FC vs Bristol City',
    description: 'EFL Championship matchday at Turf Moor',
    status: 'ended', channelState: 'idle', includeMatchDetails: true,
    homeTeam: 'Burnley FC', awayTeam: 'Bristol City', competition: 'EFL Championship', round: 'Regular Season', venue: 'Turf Moor',
    event_start_time: seedISO(-1, 14, 30), kickoff_time: seedISO(-1, 15, 0), event_end_time: seedISO(-1, 17, 0),
    opta_id: '', external_id: '', visibility: 'visible',
    image_16x9: null, currentViewers: 0, peakViewers: 9120,
    streams: seedStreams('preset_srt_video'),
    vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_006', isDraft: false,
  },
  {
    id: 'evt_007', title: 'Watford vs Burnley FC',
    description: 'EFL Championship away fixture',
    status: 'ended', channelState: 'idle', includeMatchDetails: true,
    homeTeam: 'Watford', awayTeam: 'Burnley FC', competition: 'EFL Championship', round: 'Regular Season', venue: 'Vicarage Road',
    event_start_time: seedISO(-9, 19, 15), kickoff_time: seedISO(-9, 19, 45), event_end_time: seedISO(-9, 21, 45),
    opta_id: '', external_id: '', visibility: 'visible',
    image_16x9: null, currentViewers: 0, peakViewers: 7430,
    streams: seedStreams('preset_srt_video'),
    vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_007', isDraft: false,
  },
  {
    id: 'evt_008', title: 'Burnley FC vs Hull City',
    description: 'EFL Championship matchday at Turf Moor',
    status: 'ended', channelState: 'idle', includeMatchDetails: true,
    homeTeam: 'Burnley FC', awayTeam: 'Hull City', competition: 'EFL Championship', round: 'Regular Season', venue: 'Turf Moor',
    event_start_time: seedISO(-13, 14, 30), kickoff_time: seedISO(-13, 15, 0), event_end_time: seedISO(-13, 17, 0),
    opta_id: '', external_id: '', visibility: 'visible',
    image_16x9: null, currentViewers: 0, peakViewers: 8210,
    streams: seedStreams('preset_srt_video'),
    vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_008', isDraft: false,
  },
  {
    id: 'evt_009', title: 'Burnley FC vs Oxford United',
    description: 'EFL Championship matchday at Turf Moor',
    status: 'ended', channelState: 'idle', includeMatchDetails: true,
    homeTeam: 'Burnley FC', awayTeam: 'Oxford United', competition: 'EFL Championship', round: 'Regular Season', venue: 'Turf Moor',
    event_start_time: seedISO(-20, 14, 30), kickoff_time: seedISO(-20, 15, 0), event_end_time: seedISO(-20, 17, 0),
    opta_id: '', external_id: '', visibility: 'visible',
    image_16x9: null, currentViewers: 0, peakViewers: 6890,
    streams: seedStreams('preset_srt_video'),
    vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_009', isDraft: false,
  },
  {
    id: 'evt_010', title: 'Burnley FC vs Leeds United',
    description: 'EFL Championship — top-of-the-table clash',
    status: 'upcoming', channelState: 'idle', includeMatchDetails: true,
    homeTeam: 'Burnley FC', awayTeam: 'Leeds United', competition: 'EFL Championship', round: 'Regular Season', venue: 'Turf Moor',
    event_start_time: seedISO(7, 14, 30), kickoff_time: seedISO(7, 15, 0), event_end_time: seedISO(7, 17, 0),
    opta_id: '', external_id: '', visibility: 'visible',
    image_16x9: null, currentViewers: 0, peakViewers: 0,
    streams: seedStreams('preset_stadium_hd'),
    vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_010', isDraft: false,
  },
  {
    id: 'evt_011', title: 'Sunderland vs Burnley FC',
    description: 'EFL Championship away fixture',
    status: 'upcoming', channelState: 'idle', includeMatchDetails: true,
    homeTeam: 'Sunderland', awayTeam: 'Burnley FC', competition: 'EFL Championship', round: 'Regular Season', venue: 'Stadium of Light',
    event_start_time: seedISO(12, 12, 0), kickoff_time: seedISO(12, 12, 30), event_end_time: seedISO(12, 14, 30),
    opta_id: '', external_id: '', visibility: 'visible',
    image_16x9: null, currentViewers: 0, peakViewers: 0,
    streams: seedStreams('preset_srt_video'),
    vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_011', isDraft: false,
  },
];

const initialVipRoster: VipRosterEntry[] = [
  { id: 'vip_001', email: 'chairman@burnleyfc.com',  name: 'Alan Pace',            added_at: '2025-08-10T09:12:00Z', added_by: 'media.manager@burnleyfc.com', revoked: false },
  { id: 'vip_002', email: 'ceo@burnleyfc.com',       name: 'Neil Hart',            added_at: '2025-08-10T09:12:18Z', added_by: 'media.manager@burnleyfc.com', revoked: false },
  { id: 'vip_003', email: 'directors@burnleyfc.com', name: 'Board Distribution',   added_at: '2025-08-10T09:13:02Z', added_by: 'media.manager@burnleyfc.com', revoked: false },
  { id: 'vip_004', email: 'partners.exec@efl.com',   name: 'EFL Partner Comp',     added_at: '2025-09-04T11:48:21Z', added_by: 'media.manager@burnleyfc.com', revoked: false },
  { id: 'vip_005', email: 'sponsor.lead@vbet.com',   name: 'vbet – Lead Sponsor',  added_at: '2025-09-14T16:02:55Z', added_by: 'media.manager@burnleyfc.com', revoked: false },
  { id: 'vip_006', email: 'legacy@burnleyfc.com',    name: 'Legacy (deprecated)',  added_at: '2024-07-01T12:00:00Z', added_by: 'media.manager@burnleyfc.com', revoked: true, revoked_at: '2025-09-30T17:00:00Z' },
];

// ─── UTILITY FUNCTIONS ───────────────────────────────────────────────────────

function activeVipCount(roster: VipRosterEntry[]): number {
  return roster.filter(r => !r.revoked).length;
}


// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function AutocompleteInput({ label, value, onChange, options, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder: string; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const filtered = focused && value
    ? options.filter(o => o.toLowerCase().includes(value.toLowerCase())).slice(0, 6)
    : [];
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder={placeholder}
          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm" />
        {filtered.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filtered.map(item => (
              <button key={item} onMouseDown={() => onChange(item)} className="w-full px-3.5 py-2 text-left hover:bg-slate-50 text-sm">{item}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ImageUploadZone({ label, aspectLabel, image, onUpload, onRemove, aspectClass }: {
  label: string; aspectLabel: string; image: { name: string; url: string } | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; onRemove: () => void; aspectClass: string;
}) {
  const inputId = useId();
  if (image) {
    return (
      <div className="relative group">
        <div className={`${aspectClass} rounded-lg overflow-hidden bg-slate-900`}>
          <img src={image.url} alt={label} className="w-full h-full object-cover" />
        </div>
        <button onClick={onRemove} className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
        <p className="text-[10px] text-slate-500 mt-1 text-center truncate">{image.name}</p>
      </div>
    );
  }
  return (
    <div>
      <input type="file" accept="image/*" onChange={onUpload} className="hidden" id={inputId} />
      <label htmlFor={inputId} className={`${aspectClass} flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg hover:border-emerald-500 cursor-pointer bg-slate-50 transition-colors`}>
        <Upload size={20} className="text-slate-400 mb-1.5" />
        <p className="text-xs font-medium text-slate-700">{label}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{aspectLabel}</p>
      </label>
    </div>
  );
}

function RightsPanel({ rights, onChange }: { rights: StreamRights; onChange: (r: StreamRights) => void }) {
  const [countrySearch, setCountrySearch] = useState('');
  const [segmentSearch, setSegmentSearch] = useState('');
  const filteredCountries = countrySearch
    ? COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase()) && !rights.geo_countries.includes(c))
    : [];
  const filteredSegments = segmentSearch
    ? SEGMENT_LIBRARY.filter(s => s.display_name.toLowerCase().includes(segmentSearch.toLowerCase()) && !rights.segment_ids.includes(s.id))
    : [];
  const showCombineToggle = rights.subscription_plans.length > 0 && rights.segment_ids.length > 0;

  return (
    <div className="bg-slate-50 border-t border-slate-200 px-5 py-4 space-y-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rights Restrictions</p>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
          <Globe size={14} className="text-slate-400" /> Geo-Profile
        </label>
        <select value={rights.geo_profile} onChange={e => onChange({ ...rights, geo_profile: e.target.value })}
          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm">
          <option value="">No geo-profile selected</option>
          {GEO_PROFILES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
          <MapPin size={14} className="text-slate-400" /> Geo-Country Restrictions
        </label>
        {rights.geo_countries.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {rights.geo_countries.map(c => (
              <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                {c}<button onClick={() => onChange({ ...rights, geo_countries: rights.geo_countries.filter(x => x !== c) })} className="hover:text-red-600"><X size={12} /></button>
              </span>
            ))}
          </div>
        )}
        <div className="relative">
          <input type="text" value={countrySearch} onChange={e => setCountrySearch(e.target.value)}
            placeholder="Search and add blocked countries..."
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm" />
          {filteredCountries.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {filteredCountries.map(c => (
                <button key={c} onClick={() => { onChange({ ...rights, geo_countries: [...rights.geo_countries, c] }); setCountrySearch(''); }}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 text-sm">{c}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
          <CreditCard size={14} className="text-slate-400" /> Subscription Requirement
        </label>
        {rights.subscription_plans.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {rights.subscription_plans.map(pId => {
              const plan = SUBSCRIPTION_PLANS.find(p => p.id === pId);
              return (
                <span key={pId} className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-100 text-violet-800 rounded-full text-xs font-medium">
                  {plan?.name || pId}
                  <button onClick={() => onChange({ ...rights, subscription_plans: rights.subscription_plans.filter(x => x !== pId) })} className="hover:text-violet-600"><X size={12} /></button>
                </span>
              );
            })}
          </div>
        )}
        <select onChange={e => { if (e.target.value && !rights.subscription_plans.includes(e.target.value)) { onChange({ ...rights, subscription_plans: [...rights.subscription_plans, e.target.value] }); } e.target.value = ''; }}
          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm">
          <option value="">Add subscription plan...</option>
          {SUBSCRIPTION_PLANS.filter(p => !rights.subscription_plans.includes(p.id)).map(p => (
            <option key={p.id} value={p.id}>{p.name} – {p.description}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
          <Users size={14} className="text-slate-400" /> Audience Segments
          <span className="text-[10px] font-normal text-slate-400">(YinzCam segmentation)</span>
        </label>
        {rights.segment_ids.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {rights.segment_ids.map(sId => {
              const seg = SEGMENT_LIBRARY.find(s => s.id === sId);
              return (
                <span key={sId} className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-100 text-sky-800 rounded-full text-xs font-medium">
                  {seg?.display_name || sId}
                  {!seg && <span className="text-[9px] text-amber-700 bg-amber-100 rounded px-1 py-0.5">unknown</span>}
                  <button onClick={() => onChange({ ...rights, segment_ids: rights.segment_ids.filter(x => x !== sId) })} className="hover:text-sky-600"><X size={12} /></button>
                </span>
              );
            })}
          </div>
        )}
        <div className="relative">
          <input type="text" value={segmentSearch} onChange={e => setSegmentSearch(e.target.value)}
            placeholder="Search and add audience segments..."
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm" />
          {filteredSegments.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredSegments.map(s => (
                <button key={s.id} onClick={() => { onChange({ ...rights, segment_ids: [...rights.segment_ids, s.id] }); setSegmentSearch(''); }}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 text-sm flex items-center justify-between">
                  <span>{s.display_name}</span>
                  <code className="text-[10px] text-slate-400 font-mono">{s.id}</code>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5">Segments are managed in the YinzCam Audiences module.</p>
      </div>

      {showCombineToggle && (
        <div className="bg-white border border-slate-300 rounded-lg p-3">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 block">Match logic</label>
          <div className="flex items-center gap-2 mb-1">
            <button type="button" onClick={() => onChange({ ...rights, combine_mode: 'AND' })}
              className={`flex-1 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-colors ${rights.combine_mode === 'AND' ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'}`}>
              Plan <strong>AND</strong> segment
            </button>
            <button type="button" onClick={() => onChange({ ...rights, combine_mode: 'OR' })}
              className={`flex-1 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-colors ${rights.combine_mode === 'OR' ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'}`}>
              Plan <strong>OR</strong> segment
            </button>
          </div>
          <p className="text-[10px] text-slate-500">
            {rights.combine_mode === 'AND'
              ? 'Stricter – viewer must hold one of the listed plans AND be in one of the listed segments.'
              : 'Looser – viewer passes if they hold one of the listed plans OR are in one of the listed segments.'}
          </p>
        </div>
      )}
    </div>
  );
}

function StreamRowCard({ row, index, onUpdate, onRemove }: {
  row: StreamRow; index: number; onUpdate: (r: StreamRow) => void; onRemove: () => void;
}) {
  const hasRights = !!row.rights.geo_profile || row.rights.geo_countries.length > 0 || row.rights.subscription_plans.length > 0 || row.rights.segment_ids.length > 0;
  const si = STREAM_ICONS.find(s => s.id === row.output.type);
  const OutputIcon = si ? si.Icon : Video;
  const inp = row.input;

  return (
    <div className="rounded-xl border-2 border-emerald-300 bg-white shadow-sm overflow-hidden transition-all">
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-emerald-600 text-white">{index + 1}</span>
            <div className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center flex-shrink-0">
              <OutputIcon size={16} className="text-slate-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{row.output.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{row.preset_name}</p>
            </div>
            {row.live2vod && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1 flex-shrink-0"><Archive size={9} /> Live2VOD</span>}
            {row.captions && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1 flex-shrink-0"><Captions size={9} /> Captions</span>}
            {row.vip && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-700 flex items-center gap-1 flex-shrink-0"><Crown size={9} /> VIP</span>}
            {hasRights && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 flex-shrink-0">Rights set</span>}
          </div>
          <button onClick={onRemove} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 ml-2" title="Remove stream">
            <Trash2 size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Input source (from preset, read-only) */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Broadcast Input</label>
            <div className="mb-1.5"><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${INPUT_TYPE_COLORS[inp.input_type]}`}>{inp.protocol_label}</span></div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-500 uppercase w-14 flex-shrink-0">Endpoint</span>
                <code className="text-[10px] text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded break-all">{inp.endpoint_url}</code>
              </div>
              {inp.endpoint_port && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase w-14 flex-shrink-0">Port</span>
                  <code className="text-[10px] text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{inp.endpoint_port}</code>
                </div>
              )}
              {inp.stream_key && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase w-14 flex-shrink-0">Key</span>
                  <code className="text-[10px] text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{inp.stream_key}</code>
                </div>
              )}
            </div>
          </div>

          {/* Output (from preset, read-only) */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Stream Output</label>
            <p className="text-sm font-medium text-slate-900">{row.output.name}</p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">{row.output.codec}</span>
              {row.output.resolution && row.output.resolution !== '—' && <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">{row.output.resolution}</span>}
              {row.output.bitrate !== '—' && <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">{row.output.bitrate}</span>}
            </div>
            {row.live2vod && (
              <div className="mt-3 flex items-start gap-2.5 p-2.5 rounded-lg border border-amber-200 bg-amber-50">
                <Archive size={12} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-slate-800">Live2VOD enabled</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">Archived to S3 for on-demand replay (preset extra).</p>
                </div>
              </div>
            )}
            {row.captions && (
              <div className="mt-3 flex items-start gap-2.5 p-2.5 rounded-lg border border-blue-200 bg-blue-50">
                <Captions size={12} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-slate-800">Live Captions — ENG</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">Live English subtitles burned to the stream (preset extra).</p>
                </div>
              </div>
            )}
            {row.vip && (
              <div className="mt-3 flex items-start gap-2.5 p-2.5 rounded-lg border border-fuchsia-200 bg-fuchsia-50">
                <Crown size={12} className="text-fuchsia-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-slate-800">VIP delivery</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">Mirrored to the VIP roster (preset extra). Manage in <strong>VIP Members</strong>.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200">
        <button onClick={() => onUpdate({ ...row, expanded: !row.expanded })}
          className={`w-full px-5 py-3 flex items-center justify-between transition-colors ${row.expanded ? 'bg-violet-50' : hasRights ? 'bg-violet-50 hover:bg-violet-100' : 'bg-slate-50 hover:bg-slate-100'}`}>
          <div className="flex items-center gap-2.5">
            <Shield size={16} className={hasRights ? 'text-violet-600' : 'text-slate-400'} />
            <span className={`text-sm font-semibold ${hasRights ? 'text-violet-800' : 'text-slate-600'}`}>Rights &amp; Restrictions</span>
            {hasRights ? (
              <div className="flex items-center gap-2">
                {row.rights.geo_profile && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-200 text-violet-800 flex items-center gap-1"><Globe size={9} />{row.rights.geo_profile}</span>}
                {row.rights.geo_countries.length > 0 && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1"><MapPin size={9} />{row.rights.geo_countries.length} blocked</span>}
                {row.rights.subscription_plans.length > 0 && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-200 text-violet-800 flex items-center gap-1"><CreditCard size={9} />{row.rights.subscription_plans.length} plan{row.rights.subscription_plans.length > 1 ? 's' : ''}</span>}
                {row.rights.segment_ids.length > 0 && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 flex items-center gap-1"><Users size={9} />{row.rights.segment_ids.length} segment{row.rights.segment_ids.length > 1 ? 's' : ''}</span>}
                {row.rights.subscription_plans.length > 0 && row.rights.segment_ids.length > 0 && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">{row.rights.combine_mode}</span>}
              </div>
            ) : <span className="text-[10px] text-slate-400">Not configured</span>}
          </div>
          {row.expanded ? <ChevronUp size={16} className="text-violet-500" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>
        {row.expanded && <RightsPanel rights={row.rights} onChange={r => onUpdate({ ...row, rights: r })} />}
      </div>
    </div>
  );
}

// ─── PRESET PICKER (wizard: choose a Broadcast Preset → generate streams) ─────
function PresetPicker({ onConfirm }: { onConfirm: (preset: BroadcastPreset) => void }) {
  const [selectedId, setSelectedId] = useState('');
  const preset = BROADCAST_PRESETS.find(p => p.preset_id === selectedId) || null;

  return (
    <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/60">
      <label className="block text-sm font-medium text-slate-700 mb-1.5">Broadcast Preset</label>
      <div className="flex gap-2">
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
          className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-lg bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm">
          <option value="">Select a preset…</option>
          {BROADCAST_PRESETS.map(p => (
            <option key={p.preset_id} value={p.preset_id} disabled={p.status === 'IN_USE'}>
              {p.name} · {p.outputs.length} output{p.outputs.length !== 1 ? 's' : ''}{p.status === 'IN_USE' ? ' — In Use' : ''}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => preset && onConfirm(preset)} disabled={!preset}
          className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-1.5">
          <Check size={14} /> Confirm
        </button>
      </div>

      {preset && (
        <div className="mt-3 bg-white border border-slate-200 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${INPUT_TYPE_COLORS[preset.input.input_type]}`}>{preset.input.protocol_label}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${preset.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{preset.status === 'ACTIVE' ? 'Active' : 'In use'}</span>
              {preset.extras.live2vod && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1"><Archive size={9} /> Live2VOD</span>}
              {preset.extras.vip && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1 border border-amber-300"><Crown size={9} /> VIP</span>}
            </div>
            <span className="text-[10px] text-slate-400">{preset.outputs.length} output{preset.outputs.length !== 1 ? 's' : ''} → {preset.outputs.length} live stream{preset.outputs.length !== 1 ? 's' : ''}</span>
          </div>
          {/* Input source in-line */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
            <span className="font-semibold text-slate-500 uppercase">Input</span>
            <code className="text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded break-all">{preset.input.endpoint_url}</code>
            {preset.input.endpoint_port && <span className="text-slate-500">Port <code className="font-mono text-slate-700">{preset.input.endpoint_port}</code></span>}
            {preset.input.stream_key && <span className="text-slate-500">Key <code className="font-mono text-slate-700">{preset.input.stream_key}</code></span>}
          </div>
          {/* Outputs list */}
          <div className="space-y-1.5">
            {preset.outputs.map((o, i) => {
              const oi = STREAM_ICONS.find(s => s.id === o.type);
              const OIcon = oi ? oi.Icon : Video;
              return (
                <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5">
                  <OIcon size={13} className="text-slate-500 flex-shrink-0" />
                  <span className="text-xs font-medium text-slate-800">{o.name}</span>
                  <span className="text-[10px] text-slate-500">{o.codec}{o.resolution !== '—' ? ` · ${o.resolution}` : ''}{o.bitrate !== '—' ? ` · ${o.bitrate}` : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


// ─── OPTA LOOKUP FIELD ───────────────────────────────────────────────────────
function OptaLookupField({ optaId, onOptaIdChange, onMatchApplied, enableResync, lastPulledAt, onResyncCompared }: {
  optaId: string; onOptaIdChange: (id: string) => void; onMatchApplied: (fixture: CatalogFixture) => void;
  enableResync?: boolean; lastPulledAt?: string; onResyncCompared?: (fixture: CatalogFixture) => void;
}) {
  const [mode, setMode]       = useState<LookupMode>('id');
  const [state, setState]     = useState<LookupState>('idle');
  const [matched, setMatched] = useState<CatalogFixture | null>(null);
  const [search, setSearch]   = useState('');

  const searchResults = search.trim()
    ? FIXTURE_CATALOG.filter(f => {
        const q = search.toLowerCase();
        return f.home_team.toLowerCase().includes(q) || f.away_team.toLowerCase().includes(q) ||
               f.competition.toLowerCase().includes(q) || f.opta_id.toLowerCase().includes(q);
      }).slice(0, 6)
    : [];

  const triggerIdLookup = () => {
    setState('searching'); setMatched(null);
    setTimeout(() => {
      const found = lookupFixture(optaId, 'id');
      if (found) { setMatched(found); setState('matched'); } else { setState('not_found'); }
    }, 350);
  };

  const stateChipClass: Record<LookupState, string> = { idle: 'bg-slate-100 text-slate-500', searching: 'bg-blue-100 text-blue-700', matched: 'bg-emerald-100 text-emerald-700', not_found: 'bg-red-100 text-red-700' };
  const stateChipLabel: Record<LookupState, string> = { idle: 'Idle', searching: 'Searching…', matched: 'Matched', not_found: 'Not found' };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">Opta Fixture ID</label>
        <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
          <button type="button" onClick={() => setMode('id')} className={`px-2.5 py-1 rounded ${mode === 'id' ? 'bg-white border border-slate-300 text-slate-900 font-medium' : 'text-slate-500'}`}>Enter ID</button>
          <button type="button" onClick={() => setMode('search')} className={`px-2.5 py-1 rounded ${mode === 'search' ? 'bg-white border border-slate-300 text-slate-900 font-medium' : 'text-slate-500'}`}>Search fixture</button>
        </div>
      </div>

      {mode === 'id' ? (
        <div className="flex gap-2">
          <input type="text" value={optaId} onChange={e => { onOptaIdChange(e.target.value); setState('idle'); setMatched(null); }}
            placeholder="e.g. g2412345"
            className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm font-mono" />
          <button type="button" onClick={triggerIdLookup} disabled={!optaId.trim() || state === 'searching'}
            className="px-3.5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-1.5">
            <Search size={14} /> Lookup
          </button>
          {state !== 'idle' && <span className={`px-2 py-1 rounded-md text-[10px] font-medium self-center ${stateChipClass[state]}`}>{stateChipLabel[state]}</span>}
        </div>
      ) : (
        <div className="relative">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by team, competition, or ID..."
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm" />
          {searchResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {searchResults.map(f => (
                <button key={f.opta_id} type="button"
                  onClick={() => { onOptaIdChange(f.opta_id); setMatched(f); setState('matched'); setSearch(''); }}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 text-sm border-b border-slate-100 last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">{f.home_team} v {f.away_team}</span>
                    <code className="text-[10px] text-slate-400 font-mono">{f.opta_id}</code>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {f.competition} · {new Date(f.kickoff_iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {f.venue}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {matched && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2.5">
          <Check size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-emerald-900">{matched.home_team} v {matched.away_team}</p>
            <p className="text-emerald-700 mt-0.5">
              {matched.competition} · {new Date(matched.kickoff_iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })} · {matched.venue}
            </p>
          </div>
          <button type="button" onClick={() => { onMatchApplied(matched); setMatched(null); setState('idle'); }}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-[11px] font-medium flex-shrink-0">
            Apply to form
          </button>
        </div>
      )}

      {state === 'not_found' && !matched && (
        <p className="text-[11px] text-red-700 flex items-center gap-1.5"><AlertCircle size={11} /> No fixture matched that Opta ID in the {initialStatsFeedSettings.provider.toUpperCase()} catalog.</p>
      )}

      {enableResync && optaId && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-[10px] text-slate-400">
            {lastPulledAt ? `Last synced ${new Date(lastPulledAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Not yet synced'}
          </p>
          <button type="button" onClick={() => { const found = lookupFixture(optaId, 'id'); if (found) onResyncCompared?.(found); }}
            className="px-2.5 py-1 text-[10px] font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-md hover:bg-violet-100 flex items-center gap-1">
            <RefreshCw size={10} /> Update from Opta
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CREATE EVENT PAGE ───────────────────────────────────────────────────────

interface CreateEventForm {
  event_name: string; description: string; event_date: string; event_start_time: string; kickoff_time: string; event_end_time: string;
  opta_id: string; external_id: string;
  image_16x9: { name: string; url: string } | null;
  home_team: string; away_team: string; competition: string; round: string; venue: string;
}

function CreateEventPage({ onBack, onSave, tenantId }: {
  onBack: () => void; onSave: (e: LiveEvent) => void; tenantId: string;
}) {
  const [form, setForm] = useState<CreateEventForm>({
    event_name: '', description: '', event_date: '', event_start_time: '', kickoff_time: '', event_end_time: '',
    opta_id: '', external_id: '',
    image_16x9: null,
    home_team: '', away_team: '', competition: '', round: '', venue: '',
  });
  const [includeMatchDetails, setIncludeMatchDetails] = useState(false);
  const [streams, setStreams]       = useState<StreamRow[]>([]);
  const [sourceMatch, setSourceMatch] = useState<SourceMatch | null>(null);

  const updateForm = (u: Partial<CreateEventForm>) => setForm(p => ({ ...p, ...u }));
  const handleImageUpload = (key: 'image_16x9') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) updateForm({ [key]: { name: f.name, url: URL.createObjectURL(f) } } as Partial<CreateEventForm>);
  };

  const applyPreset  = (preset: BroadcastPreset) => setStreams(streamsFromPreset(preset));
  const removeStream = (id: string) => setStreams(p => p.filter(s => s.id !== id));
  const updateStream = (id: string, row: StreamRow) => setStreams(p => p.map(s => s.id === id ? row : s));

  const hasVideoStream = streams.some(s => s.output.type === 'video');
  const vipOn = hasVideoStream && streams.some(s => s.vip);
  const formValid = useMemo(() => {
    const base = !!form.event_name && !!form.event_date && !!form.event_start_time && !!form.kickoff_time;
    if (includeMatchDetails) return base && !!form.home_team && !!form.away_team;
    return base;
  }, [form, includeMatchDetails]);

  const handleSave = () => {
    const id = `evt_${Date.now()}`;
    onSave({
      id, title: form.event_name, description: form.description,
      status: streams.length > 0 ? 'upcoming' : 'draft', channelState: 'idle',
      includeMatchDetails,
      homeTeam:    includeMatchDetails ? form.home_team   : '',
      awayTeam:    includeMatchDetails ? form.away_team   : '',
      competition: includeMatchDetails ? form.competition : '',
      round:       includeMatchDetails ? form.round       : '',
      venue:       includeMatchDetails ? form.venue       : '',
      event_start_time: `${form.event_date}T${form.event_start_time}:00`,
      kickoff_time:     `${form.event_date}T${form.kickoff_time}:00`,
      event_end_time:   form.event_end_time ? `${form.event_date}T${form.event_end_time}:00` : '',
      opta_id: form.opta_id, external_id: form.external_id,
      source_match: sourceMatch || undefined,
      visibility: 'visible',
      image_16x9: form.image_16x9,
      currentViewers: 0, peakViewers: 0,
      streams,
      vip_delivery: {
        enabled: vipOn,
        hosted_page_url:     vipOn ? `https://vip.yinzcam.com/${tenantId}/${id}` : undefined,
        distribution_status: vipOn ? 'pending' : undefined,
      },
      apiUrl: `https://api.example.com/v1/events/${id}`,
      isDraft: streams.length === 0,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-900 font-medium">← Back</button>
            <div className="h-5 w-px bg-slate-200" />
            <h1 className="text-lg font-bold text-slate-900">New Live Event</h1>
          </div>
          <button onClick={handleSave} disabled={!formValid}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium text-sm transition-colors flex items-center gap-2">
            <Check size={16} />Save &amp; Schedule
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              <h2 className="text-base font-bold text-slate-900">Event Information</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Event Name<span className="text-red-500 ml-0.5">*</span></label>
                <input type="text" value={form.event_name} onChange={e => updateForm({ event_name: e.target.value })}
                  placeholder="e.g. Burnley FC v Blackburn Rovers"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                <textarea rows={3} value={form.description} onChange={e => updateForm({ description: e.target.value })}
                  placeholder="Enter event description..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5"><Calendar size={14} className="inline mr-1 -mt-0.5" />Date<span className="text-red-500 ml-0.5">*</span></label>
                <input type="date" value={form.event_date} onChange={e => updateForm({ event_date: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5"><Clock size={14} className="inline mr-1 -mt-0.5" />Event Start<span className="text-red-500 ml-0.5">*</span></label>
                  <input type="time" value={form.event_start_time} onChange={e => updateForm({ event_start_time: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm" />
                  <p className="text-[10px] text-slate-400 mt-1">Auto-starts 90 min before (or start manually)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5"><Activity size={14} className="inline mr-1 -mt-0.5" />{includeMatchDetails ? 'Kick-off' : 'Main Start'}<span className="text-red-500 ml-0.5">*</span></label>
                  <input type="time" value={form.kickoff_time} onChange={e => updateForm({ kickoff_time: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm" />
                  <p className="text-[10px] text-slate-400 mt-1">{includeMatchDetails ? 'Match kick-off time' : 'When the main content begins'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5"><Clock size={14} className="inline mr-1 -mt-0.5" />Event End</label>
                  <input type="time" value={form.event_end_time} onChange={e => updateForm({ event_end_time: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm" />
                  <p className="text-[10px] text-slate-400 mt-1">Estimated end (optional)</p>
                </div>
              </div>
              {form.event_date && form.event_start_time && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 flex items-start gap-3">
                  <Clock size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-blue-900">Channel auto-starts 90 min before Event Start (or start manually from the listing)</p>
                    <p className="text-xs text-blue-700 mt-0.5">Infrastructure activates at <strong>{calculateChannelStart(form.event_date, form.event_start_time)}</strong></p>
                  </div>
                </div>
              )}
              <div className="pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIncludeMatchDetails(!includeMatchDetails)} className="flex items-center gap-3 cursor-pointer w-full text-left">
                  <div className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${includeMatchDetails ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${includeMatchDetails ? 'left-5' : 'left-0.5'}`} />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-800">Include Match / Fixture Details</span>
                    <p className="text-[10px] text-slate-500">Add team, competition, and venue information</p>
                  </div>
                </button>
              </div>
              {includeMatchDetails && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <AutocompleteInput label="Home Team" value={form.home_team} onChange={v => updateForm({ home_team: v })} options={TEAMS} placeholder="Select home team" required />
                    <AutocompleteInput label="Away Team" value={form.away_team} onChange={v => updateForm({ away_team: v })} options={TEAMS} placeholder="Select away team" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <AutocompleteInput label="Competition" value={form.competition} onChange={v => updateForm({ competition: v })} options={COMPETITIONS} placeholder="e.g. EFL Championship" />
                    <AutocompleteInput label="Round" value={form.round} onChange={v => updateForm({ round: v })} options={ROUNDS} placeholder="e.g. Quarter-final" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <AutocompleteInput label="Venue" value={form.venue} onChange={v => updateForm({ venue: v })} options={VENUES} placeholder="e.g. Turf Moor" />
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Data ID</label>
                      <div className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-sm font-mono flex items-center min-h-[42px]">
                        {form.opta_id ? <span className="text-slate-700">{form.opta_id}</span> : <span className="text-slate-400">Not linked</span>}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">From Data Integration (Opta or similar)</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Data Integration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <OptaLookupField optaId={form.opta_id} onOptaIdChange={id => updateForm({ opta_id: id })}
                    onMatchApplied={f => {
                      const ko = new Date(f.kickoff_iso);
                      updateForm({ opta_id: f.opta_id, home_team: f.home_team, away_team: f.away_team, competition: f.competition, round: f.round, venue: f.venue,
                        event_date:   `${ko.getUTCFullYear()}-${String(ko.getUTCMonth()+1).padStart(2,'0')}-${String(ko.getUTCDate()).padStart(2,'0')}`,
                        kickoff_time: `${String(ko.getUTCHours()).padStart(2,'0')}:${String(ko.getUTCMinutes()).padStart(2,'0')}`,
                      });
                      setIncludeMatchDetails(true);
                      setSourceMatch({ provider: initialStatsFeedSettings.provider, source_id: f.opta_id, pulled_at: new Date().toISOString(), raw_snapshot: { home_team: f.home_team, away_team: f.away_team, competition: f.competition, venue: f.venue, kickoff_iso: f.kickoff_iso } });
                    }} />
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">External Reference</label>
                    <input type="text" value={form.external_id} onChange={e => updateForm({ external_id: e.target.value })}
                      placeholder="Optional third-party ref" className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm font-mono" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-base font-bold text-slate-900 mb-1">Event Artwork</h2>
              <p className="text-xs text-slate-500 mb-4">Used across schedules, programme guides, notifications, and social assets</p>
              <ImageUploadZone label="Landscape" aspectLabel="16:9 – 1920×1080" image={form.image_16x9} onUpload={handleImageUpload('image_16x9')} onRemove={() => updateForm({ image_16x9: null })} aspectClass="aspect-video" />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-bold text-slate-900">Streams</h2>
                {streams.length > 0 && <button onClick={() => setStreams([])} className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1"><RefreshCw size={12} /> Change preset</button>}
              </div>
              <p className="text-xs text-slate-500 mb-5">Pick a Broadcast Preset — its outputs become Live Streams ready for Rights &amp; Restrictions. No preset → saved as a Draft.</p>
              {streams.length === 0 ? (
                <PresetPicker onConfirm={applyPreset} />
              ) : (
                <div className="space-y-3">
                  {streams.map((row, i) => (
                    <StreamRowCard key={row.id} row={row} index={i} onUpdate={r => updateStream(row.id, r)} onRemove={() => removeStream(row.id)} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 sticky top-20">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Required</h3>
              <div className="space-y-2">
                {[
                  { done: !!form.event_name, label: 'Event name' },
                  { done: !!form.event_date, label: 'Event date' },
                  { done: !!form.event_start_time && !!form.kickoff_time, label: 'Event start & kick-off times' },
                  ...(includeMatchDetails ? [{ done: !!form.home_team, label: 'Home team' }, { done: !!form.away_team, label: 'Away team' }] : []),
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${item.done ? 'bg-emerald-500' : 'border-2 border-slate-300'}`}>{item.done && <Check size={10} className="text-white" />}</div>
                    <span className={`text-xs ${item.done ? 'text-slate-700' : 'text-slate-400'}`}>{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${streams.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{streams.length > 0 ? 'Ready' : 'Draft'}</span>
                <span className="text-[10px] text-slate-400">{streams.length > 0 ? `${streams.length} live stream${streams.length !== 1 ? 's' : ''} configured` : 'Add a preset to make this event Ready'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── EDIT EVENT PAGE ─────────────────────────────────────────────────────────

function EditEventPage({ event, onBack, onSave, tenantId }: {
  event: LiveEvent; onBack: () => void; onSave: (e: LiveEvent) => void; tenantId: string;
}) {
  const [form, setForm] = useState({
    title: event.title || '', description: event.description || '',
    includeMatchDetails: event.includeMatchDetails || false,
    homeTeam: event.homeTeam || '', awayTeam: event.awayTeam || '',
    competition: event.competition || '', round: event.round || '', venue: event.venue || '',
    event_start_time: event.event_start_time || '', kickoff_time: event.kickoff_time || '', event_end_time: event.event_end_time || '',
    opta_id: event.opta_id || '', external_id: event.external_id || '',
    image_16x9: event.image_16x9,
  });
  const [streams, setStreams] = useState<StreamRow[]>(event.streams || []);
  const [sourceMatch, setSourceMatch] = useState<SourceMatch | null>(event.source_match || null);
  const [pendingResync, setPendingResync] = useState<{ fixture: CatalogFixture; deltas: { field: string; from: string; to: string; apply: () => void }[] } | null>(null);
  const [resyncToast, setResyncToast] = useState<string | null>(null);

  const applyPreset  = (preset: BroadcastPreset) => setStreams(streamsFromPreset(preset));
  const removeStream = (id: string) => setStreams(p => p.filter(s => s.id !== id));
  const updateStream = (id: string, row: StreamRow) => setStreams(p => p.map(s => s.id === id ? row : s));
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hasVideoStream = streams.some(s => s.output.type === 'video');
  const vipOn = hasVideoStream && streams.some(s => s.vip);

  const handleSave = () => {
    const nextVip: VipDelivery = vipOn
      ? { enabled: true, hosted_page_url: event.vip_delivery?.hosted_page_url || `https://vip.yinzcam.com/${tenantId}/${event.id}`, distribution_status: event.vip_delivery?.distribution_status || 'pending', last_email_sent_at: event.vip_delivery?.last_email_sent_at }
      : { enabled: false };
    const nextStatus: EventStatus = (event.status === 'live' || event.status === 'ended') ? event.status : (streams.length > 0 ? 'upcoming' : 'draft');
    onSave({ ...event, ...form, status: nextStatus, isDraft: streams.length === 0, streams, source_match: sourceMatch || undefined, vip_delivery: nextVip });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {resyncToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
          <Check size={14} /> {resyncToast}
        </div>
      )}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-900 font-medium">← Back</button>
            <div className="h-5 w-px bg-slate-200" />
            <h1 className="text-lg font-bold text-slate-900">Edit Live Event</h1>
          </div>
          <div className="flex gap-3">
            <button onClick={onBack} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
            <button onClick={handleSave} className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-medium"><Check size={16} /> Save Changes</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
          <Clock size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-900"><strong>Timezone:</strong> {userTimezone}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <h2 className="text-base font-bold text-slate-900">Event Information</h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Event Title <span className="text-red-500">*</span></label>
            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm" placeholder="Event title" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm" placeholder="Enter event description..." />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Event Start', field: 'event_start_time' as const, help: 'Auto-starts 90 min before (or start manually)', icon: Clock },
              { label: form.includeMatchDetails ? 'Kick-off' : 'Main Start', field: 'kickoff_time' as const, help: form.includeMatchDetails ? 'Match kick-off time' : 'When the main content begins', icon: Activity },
              { label: 'Event End', field: 'event_end_time' as const, help: 'Estimated end (optional)', icon: Clock },
            ].map(({ label, field, help, icon: Icon }) => (
              <div key={field}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5"><Icon size={14} className="inline mr-1 -mt-0.5" />{label}{field !== 'event_end_time' && <span className="text-red-500 ml-0.5"> *</span>}</label>
                <input type="datetime-local" value={form[field] ? form[field].slice(0, 16) : ''} onChange={e => setForm({ ...form, [field]: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm" />
                <p className="text-[10px] text-slate-400 mt-1">{help}</p>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setForm({ ...form, includeMatchDetails: !form.includeMatchDetails })} className="flex items-center gap-3 cursor-pointer w-full text-left">
              <div className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${form.includeMatchDetails ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.includeMatchDetails ? 'left-5' : 'left-0.5'}`} />
              </div>
              <div>
                <span className="text-sm font-semibold text-slate-800">Include Match / Fixture Details</span>
                <p className="text-[10px] text-slate-500">Add team, competition, and venue information</p>
              </div>
            </button>
          </div>

          {form.includeMatchDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Home Team <span className="text-red-500">*</span></label><input type="text" value={form.homeTeam} onChange={e => setForm({ ...form, homeTeam: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Away Team <span className="text-red-500">*</span></label><input type="text" value={form.awayTeam} onChange={e => setForm({ ...form, awayTeam: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Competition</label><input type="text" value={form.competition} onChange={e => setForm({ ...form, competition: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Round</label><input type="text" value={form.round} onChange={e => setForm({ ...form, round: e.target.value })} placeholder="e.g. Quarter-final" className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Venue</label><input type="text" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm" /></div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Data ID</label>
                  <div className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-sm font-mono flex items-center min-h-[42px]">
                    {form.opta_id ? <span className="text-slate-700">{form.opta_id}</span> : <span className="text-slate-400">Not linked</span>}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">From Data Integration (Opta or similar)</p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Data Integration</h3>
            {pendingResync && (
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2.5 mb-3">
                  <RefreshCw size={16} className="text-violet-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-violet-900">
                      {pendingResync.deltas.length === 0 ? `No changes since last sync (${pendingResync.fixture.opta_id})` : `${pendingResync.deltas.length} change${pendingResync.deltas.length === 1 ? '' : 's'} found in Opta`}
                    </p>
                    <p className="text-[11px] text-violet-700 mt-0.5">{pendingResync.fixture.home_team} v {pendingResync.fixture.away_team}</p>
                  </div>
                  <button onClick={() => setPendingResync(null)} className="p-1 text-violet-500 hover:text-violet-700"><X size={14} /></button>
                </div>
                {pendingResync.deltas.length > 0 && (
                  <>
                    <div className="space-y-1.5 mb-3">
                      {pendingResync.deltas.map((d, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 bg-white border border-violet-200 rounded-md px-3 py-1.5 text-xs">
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">{d.field}</span>
                            <p className="text-slate-700 truncate"><span className="line-through text-slate-400">{d.from}</span> → <strong>{d.to}</strong></p>
                          </div>
                          <button onClick={() => { d.apply(); setPendingResync(prev => prev ? { ...prev, deltas: prev.deltas.filter((_, j) => j !== i) } : null); }}
                            className="px-2 py-1 text-[10px] font-medium text-violet-700 bg-violet-50 border border-violet-300 rounded hover:bg-violet-100 flex-shrink-0">Apply</button>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { pendingResync.deltas.forEach(d => d.apply()); setSourceMatch(prev => prev ? { ...prev, pulled_at: new Date().toISOString() } : prev); setPendingResync(null); }}
                        className="px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded hover:bg-violet-700">Apply all</button>
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <OptaLookupField optaId={form.opta_id} onOptaIdChange={id => setForm({ ...form, opta_id: id })}
                onMatchApplied={f => {
                  setForm({ ...form, opta_id: f.opta_id, homeTeam: f.home_team, awayTeam: f.away_team, competition: f.competition, round: f.round, venue: f.venue, kickoff_time: f.kickoff_iso, includeMatchDetails: true });
                  setSourceMatch({ provider: initialStatsFeedSettings.provider, source_id: f.opta_id, pulled_at: new Date().toISOString(), raw_snapshot: { home_team: f.home_team, away_team: f.away_team, competition: f.competition, venue: f.venue, kickoff_iso: f.kickoff_iso } });
                }}
                enableResync={!!sourceMatch && sourceMatch.provider !== 'manual'}
                lastPulledAt={sourceMatch?.pulled_at}
                onResyncCompared={f => {
                  const deltas: { field: string; from: string; to: string; apply: () => void }[] = [];
                  if (f.home_team  !== form.homeTeam)    deltas.push({ field: 'Home team',   from: form.homeTeam || '—',    to: f.home_team,   apply: () => setForm(p => ({ ...p, homeTeam: f.home_team })) });
                  if (f.away_team  !== form.awayTeam)    deltas.push({ field: 'Away team',   from: form.awayTeam || '—',    to: f.away_team,   apply: () => setForm(p => ({ ...p, awayTeam: f.away_team })) });
                  if (f.competition !== form.competition) deltas.push({ field: 'Competition', from: form.competition || '—', to: f.competition, apply: () => setForm(p => ({ ...p, competition: f.competition })) });
                  if (f.round       !== form.round)       deltas.push({ field: 'Round',       from: form.round || '—',       to: f.round,       apply: () => setForm(p => ({ ...p, round: f.round })) });
                  if (f.venue       !== form.venue)       deltas.push({ field: 'Venue',       from: form.venue || '—',       to: f.venue,       apply: () => setForm(p => ({ ...p, venue: f.venue })) });
                  if (deltas.length === 0) { setResyncToast('No changes since last sync'); setSourceMatch(prev => prev ? { ...prev, pulled_at: new Date().toISOString() } : prev); setTimeout(() => setResyncToast(null), 2500); }
                  setPendingResync({ fixture: f, deltas });
                }} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">External Reference</label>
                <input type="text" value={form.external_id} onChange={e => setForm({ ...form, external_id: e.target.value })}
                  placeholder="Optional third-party ref" className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm font-mono" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-slate-900">Streams</h2>
            {streams.length > 0 && <button onClick={() => setStreams([])} className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1"><RefreshCw size={12} /> Change preset</button>}
          </div>
          <p className="text-xs text-slate-500 mb-5">Pick a Broadcast Preset — its outputs become Live Streams ready for Rights &amp; Restrictions.</p>
          {streams.length === 0 ? (
            <PresetPicker onConfirm={applyPreset} />
          ) : (
            <div className="space-y-3">
              {streams.map((row, i) => (
                <StreamRowCard key={row.id} row={row} index={i} onUpdate={r => updateStream(row.id, r)} onRemove={() => removeStream(row.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── EVENT DETAILS MODAL ─────────────────────────────────────────────────────

function EventDetailsModal({ event, onClose, onEdit }: {
  event: LiveEvent; onClose: () => void; onEdit: (e: LiveEvent) => void;
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'streams' | 'preview'>('details');
  const [previewStreamIndex, setPreviewStreamIndex] = useState(0);
  const [isMuted,   setIsMuted]   = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const tabClass = (tab: string) => `px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-600 hover:text-slate-900'}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{event.title}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(event.status)}`}>{event.status.toUpperCase()}</span>
              {event.includeMatchDetails && <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-medium">Match Details</span>}
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">{event.streams.length} Stream{event.streams.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><X size={24} /></button>
        </div>
        <div className="border-b border-slate-200">
          <div className="flex gap-1 px-6">
            <button onClick={() => setActiveTab('details')} className={tabClass('details')}>Details</button>
            <button onClick={() => setActiveTab('streams')} className={tabClass('streams')}>Streams ({event.streams.length})</button>
            <button onClick={() => setActiveTab('preview')} className={tabClass('preview')}>
              <span className="flex items-center gap-1.5"><Monitor size={14} /> Preview{event.channelState === 'running' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div><label className="block text-sm font-medium text-slate-900 mb-2">Description</label><p className="text-slate-700">{event.description || 'No description provided'}</p></div>
              {event.includeMatchDetails && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-900 mb-1">Home Team</label><p className="text-slate-700">{event.homeTeam}</p></div>
                    <div><label className="block text-sm font-medium text-slate-900 mb-1">Away Team</label><p className="text-slate-700">{event.awayTeam}</p></div>
                  </div>
                  {event.competition && <div><label className="block text-sm font-medium text-slate-900 mb-1">Competition</label><p className="text-slate-700">{event.competition}</p></div>}
                  {event.round && <div><label className="block text-sm font-medium text-slate-900 mb-1">Round</label><p className="text-slate-700">{event.round}</p></div>}
                  {event.venue && <div><label className="block text-sm font-medium text-slate-900 mb-1">Venue</label><p className="text-slate-700 flex items-center gap-2"><MapPin size={16} /> {event.venue}</p></div>}
                </>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-slate-900 mb-1">Event Start</label><p className="text-slate-700 text-sm">{formatDateTime(event.event_start_time)}</p></div>
                <div><label className="block text-sm font-medium text-slate-900 mb-1">{event.includeMatchDetails ? 'Kick-off' : 'Main Start'}</label><p className="text-slate-700 text-sm">{formatDateTime(event.kickoff_time)}</p></div>
                {event.event_end_time && <div><label className="block text-sm font-medium text-slate-900 mb-1">Event End</label><p className="text-slate-700 text-sm">{formatDateTime(event.event_end_time)}</p></div>}
              </div>
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Source</label>
                {event.source_match ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-2.5">
                    <RefreshCw size={14} className="text-slate-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 text-xs">
                      <p className="font-medium text-slate-800">Pulled from {event.source_match.provider.toUpperCase()}</p>
                      <p className="text-slate-500 mt-0.5">{new Date(event.source_match.pulled_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}{event.source_match.source_id && <> · <code className="font-mono text-slate-600">{event.source_match.source_id}</code></>}</p>
                    </div>
                  </div>
                ) : <p className="text-xs text-slate-500">Manual entry</p>}
                {event.external_id && <p className="text-[11px] text-slate-500 mt-2">External ref: <code className="font-mono text-slate-700">{event.external_id}</code></p>}
              </div>
              {event.vip_delivery?.enabled && (
                <div className="pt-4 border-t border-slate-100">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center"><Crown size={16} className="text-amber-700" /></div>
                        <div>
                          <p className="text-sm font-semibold text-amber-900">VIP Delivery enabled</p>
                          <p className="text-[11px] text-amber-700">Mirrored to the VIP roster</p>
                        </div>
                      </div>
                    </div>
                    {event.vip_delivery.hosted_page_url && (
                      <div className="mt-3 pt-3 border-t border-amber-200">
                        <p className="text-[10px] text-amber-700 uppercase tracking-wider font-semibold mb-1">Hosted page</p>
                        <code className="text-[10px] text-amber-800 font-mono bg-white border border-amber-200 px-2 py-1 rounded block break-all">{event.vip_delivery.hosted_page_url}</code>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'streams' && (
            <div className="space-y-4">
              {event.streams.length === 0 ? (
                <div className="text-center py-12"><Video size={48} className="mx-auto text-slate-300 mb-4" /><h3 className="text-lg font-semibold text-slate-900 mb-2">No streams configured</h3></div>
              ) : event.streams.map(stream => {
                const si        = STREAM_ICONS.find(ic => ic.id === stream.output.type);
                const StreamIconComp = si ? si.Icon : Video;
                const hasRights = !!stream.rights.geo_profile || stream.rights.geo_countries.length > 0 || stream.rights.subscription_plans.length > 0 || stream.rights.segment_ids.length > 0;
                return (
                  <div key={stream.id} className="border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><StreamIconComp size={16} className="text-emerald-700" /></div>
                      <div className="flex-1"><h4 className="font-semibold text-slate-900">{stream.output.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-400">{stream.preset_name}</span>
                          {stream.live2vod && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1"><Archive size={9} /> Live2VOD</span>}
                          {stream.captions && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1"><Captions size={9} /> Captions</span>}
                          {stream.vip && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-700 flex items-center gap-1"><Crown size={9} /> VIP</span>}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Broadcast Input</p>
                        <p className="text-sm font-medium text-slate-900">{stream.input.protocol_label}</p>
                        <code className="text-[10px] text-slate-600 font-mono break-all block mt-1">{stream.input.endpoint_url}</code>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Stream Output</p>
                        <p className="text-sm font-medium text-slate-900">{stream.output.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{stream.output.codec}{stream.output.resolution !== '—' ? ` · ${stream.output.resolution}` : ''}{stream.output.bitrate !== '—' ? ` · ${stream.output.bitrate}` : ''}</p>
                      </div>
                    </div>
                    {hasRights && (
                      <div className="border-t border-slate-200 pt-3">
                        <div className="flex items-center gap-2 mb-2"><Shield size={14} className="text-violet-600" /><span className="text-xs font-semibold text-violet-800">Rights & Restrictions</span></div>
                        <div className="flex flex-wrap gap-2">
                          {stream.rights.geo_profile && <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-violet-100 text-violet-800 flex items-center gap-1"><Globe size={10} /> {stream.rights.geo_profile}</span>}
                          {stream.rights.geo_countries.length > 0 && <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700 flex items-center gap-1"><MapPin size={10} /> {stream.rights.geo_countries.length} countries blocked</span>}
                          {stream.rights.subscription_plans.map(pId => { const plan = SUBSCRIPTION_PLANS.find(p => p.id === pId); return <span key={pId} className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-violet-100 text-violet-800">{plan?.name || pId}</span>; })}
                          {stream.rights.subscription_plans.length > 0 && stream.rights.segment_ids.length > 0 && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-200 text-slate-700">{stream.rights.combine_mode}</span>}
                          {stream.rights.segment_ids.map(sId => { const seg = SEGMENT_LIBRARY.find(s => s.id === sId); return <span key={sId} className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 flex items-center gap-1"><Users size={10} /> {seg?.display_name || sId}</span>; })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-5">
              {event.channelState !== 'running' ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4"><Monitor size={36} className="text-slate-300" /></div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Preview Unavailable</h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto">The preview player is available once the MediaLive channel is <strong>running</strong>.</p>
                </div>
              ) : (
                <>
                  {event.streams.length > 1 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Select Output Stream</p>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setPreviewStreamIndex(Math.max(0, previewStreamIndex - 1))} disabled={previewStreamIndex === 0} className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 transition-colors"><ChevronLeft size={18} className="text-slate-600" /></button>
                        <div className="flex-1 flex gap-2">
                          {event.streams.map((stream, idx) => {
                            const si = STREAM_ICONS.find(ic => ic.id === stream.output.type);
                            const StreamIcon = si ? si.Icon : Video;
                            const isActive = idx === previewStreamIndex;
                            return (
                              <button key={stream.id} onClick={() => setPreviewStreamIndex(idx)}
                                className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all text-left ${isActive ? 'border-emerald-500 bg-white shadow-sm' : 'border-transparent bg-white/60 hover:bg-white hover:border-slate-300'}`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-emerald-100' : 'bg-slate-100'}`}><StreamIcon size={16} className={isActive ? 'text-emerald-700' : 'text-slate-400'} /></div>
                                <div className="min-w-0"><p className={`text-sm font-medium truncate ${isActive ? 'text-emerald-700' : 'text-slate-600'}`}>{stream.output.name}</p></div>
                                {isActive && <div className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                        <button onClick={() => setPreviewStreamIndex(Math.min(event.streams.length - 1, previewStreamIndex + 1))} disabled={previewStreamIndex === event.streams.length - 1} className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 transition-colors"><ChevronRight size={18} className="text-slate-600" /></button>
                      </div>
                    </div>
                  )}
                  {(() => {
                    const activeStream = event.streams[previewStreamIndex] || event.streams[0];
                    if (!activeStream) return null;
                    const isAudio  = activeStream.output.type === 'radio';
                    return (
                      <div className="rounded-xl overflow-hidden border border-slate-200 bg-black">
                        {isAudio ? (
                          <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-8 py-12 flex flex-col items-center justify-center">
                            <div className="w-20 h-20 rounded-full bg-emerald-600/20 flex items-center justify-center mb-4 ring-4 ring-emerald-600/10"><Radio size={36} className="text-emerald-400" /></div>
                            <p className="text-white font-semibold text-lg">{activeStream.output.name}</p>
                            <div className="flex items-end gap-1 mt-6 h-10">
                              {Array.from({ length: 20 }).map((_, i) => (
                                <div key={i} className="w-1.5 bg-emerald-500 rounded-full animate-pulse" style={{ height: `${12 + Math.random() * 28}px`, animationDelay: `${i * 0.08}s` }} />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
                            <div className="absolute inset-0 bg-gradient-to-b from-slate-800/40 via-transparent to-slate-900/60 flex flex-col items-center justify-center">
                              <div className="text-center">
                                <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mb-3 mx-auto border border-white/20"><Play size={28} className="text-white ml-1" /></div>
                                <p className="text-white font-semibold text-lg drop-shadow-lg">{activeStream.output.name}</p>
                              </div>
                            </div>
                            <div className="absolute top-4 left-4 flex items-center gap-2">
                              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600 text-white text-xs font-bold rounded shadow-lg"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE</span>
                            </div>
                          </div>
                        )}
                        <div className="bg-slate-900 px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button onClick={() => setIsPlaying(!isPlaying)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">{isPlaying ? <Pause size={18} className="text-white" /> : <Play size={18} className="text-white ml-0.5" />}</button>
                            <button onClick={() => setIsMuted(!isMuted)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">{isMuted ? <VolumeX size={18} className="text-white" /> : <Volume2 size={18} className="text-white" />}</button>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5 text-xs text-white/80 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE</span>
                            <button className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><Maximize2 size={16} className="text-white" /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 p-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">Close</button>
          <button onClick={() => { onClose(); onEdit(event); }} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"><Edit2 size={18} /> Edit Event</button>
        </div>
      </div>
    </div>
  );
}


// ─── DELETE CONFIRM MODAL ────────────────────────────────────────────────────

function DeleteConfirmModal({ event, onConfirm, onCancel }: { event: LiveEvent; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center"><Trash2 size={24} className="text-red-600" /></div>
          <div><h3 className="text-lg font-bold text-slate-900">Delete Event</h3><p className="text-sm text-slate-500">This action cannot be undone</p></div>
        </div>
        <p className="text-slate-700 mb-6">Are you sure you want to delete "<strong>{event.title}</strong>"? It will be permanently deleted.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"><Trash2 size={18} /> Delete Event</button>
        </div>
      </div>
    </div>
  );
}

// ─── CHANNEL ACTION CONFIRM MODAL ────────────────────────────────────────────

function ChannelActionConfirmModal({ event, action, onCancel, onConfirm }: {
  event: LiveEvent; action: 'start' | 'stop'; onCancel: () => void; onConfirm: () => void;
}) {
  const isStart = action === 'start';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className={`px-6 py-4 ${isStart ? 'bg-emerald-50 border-b border-emerald-100' : 'bg-red-50 border-b border-red-100'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isStart ? 'bg-emerald-600' : 'bg-red-600'}`}>
              {isStart ? <Power size={20} className="text-white" /> : <Square size={20} className="text-white" />}
            </div>
            <div><h3 className="text-lg font-bold text-slate-900">{isStart ? 'Start MediaLive Channel?' : 'End Event & Stop Channel?'}</h3><p className="text-sm text-slate-600">{event.title}</p></div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-3">
          {isStart ? (
            <>
              <div className="flex items-start gap-2.5"><Zap size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" /><p className="text-sm text-slate-700">This will manually start the AWS MediaLive channel <strong>before</strong> the 90-minute auto-start window.</p></div>
              <div className="flex items-start gap-2.5"><Clock size={16} className="text-slate-400 flex-shrink-0 mt-0.5" /><p className="text-sm text-slate-700">The channel typically takes <strong>30–60 seconds</strong> to transition to a running state.</p></div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><p className="text-xs text-amber-800"><strong>Note:</strong> Starting the channel early will incur additional MediaLive running costs.</p></div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2.5"><Square size={16} className="text-red-600 flex-shrink-0 mt-0.5" /><p className="text-sm text-slate-700">This will <strong>immediately stop</strong> the live broadcast and shut down the MediaLive channel.</p></div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-xs text-red-800"><strong>Warning:</strong> Active viewers ({event.currentViewers.toLocaleString()}) will lose their connection immediately.</p></div>
            </>
          )}
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} className={`px-5 py-2.5 text-sm font-medium text-white rounded-lg flex items-center gap-2 ${isStart ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {isStart ? <><Power size={14} /> Start Channel</> : <><Square size={14} /> End &amp; Stop</>}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── VIP MEMBERS PAGE ────────────────────────────────────────────────────────

function VipMembersPage({ roster, setRoster, events, tenantId, onBack }: {
  roster: VipRosterEntry[]; setRoster: React.Dispatch<React.SetStateAction<VipRosterEntry[]>>;
  events: LiveEvent[]; tenantId: string; onBack: () => void;
}) {
  const [newEmail, setNewEmail]   = useState('');
  const [newName, setNewName]     = useState('');
  const [showRevoked, setShowRevoked] = useState(false);
  const [copiedId, setCopiedId]   = useState<string | null>(null);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);

  const activeRoster   = roster.filter(r => !r.revoked);
  const revokedRoster  = roster.filter(r => r.revoked);
  const remainingSlots = VIP_ROSTER_CAP - activeRoster.length;
  const atCap          = activeRoster.length >= VIP_ROSTER_CAP;
  const nearCap        = activeRoster.length >= VIP_ROSTER_SOFT_WARN;

  const nextVipEvent = useMemo(() => {
    const candidates = events
      .filter(e => e.vip_delivery?.enabled && (e.status === 'live' || e.status === 'upcoming'))
      .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());
    return candidates[0] || events.find(e => e.vip_delivery?.enabled) || null;
  }, [events]);

  const handleAdd = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || atCap || roster.some(r => r.email.toLowerCase() === email && !r.revoked)) return;
    setRoster(prev => [...prev, { id: `vip_${Date.now().toString(36)}`, email, name: newName.trim() || undefined, added_at: new Date().toISOString(), added_by: 'james.teague@yinzcam.com', revoked: false }]);
    setNewEmail(''); setNewName('');
  };

  const handleRevoke  = (id: string) => { setRoster(prev => prev.map(r => r.id === id ? { ...r, revoked: true, revoked_at: new Date().toISOString() } : r)); setRevokeConfirmId(null); };
  const handleRestore = (id: string) => { setRoster(prev => prev.map(r => r.id === id ? { ...r, revoked: false, revoked_at: undefined } : r)); };

  const personalUrl = (event: LiveEvent, entry: VipRosterEntry) => {
    const base  = event.vip_delivery?.hosted_page_url || `https://vip.yinzcam.com/${tenantId}/${event.id}`;
    const token = `jwt_${tenantId}_${event.id}_${entry.id}`.replace(/[^a-z0-9_]/gi, '');
    return `${base}?token=${token}`;
  };

  const copyToClipboard = (text: string, id: string) => { navigator.clipboard?.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-900 font-medium">← Back to Live Events</button>
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2"><Crown size={18} className="text-amber-600" /><h1 className="text-lg font-bold text-slate-900">VIP Members</h1></div>
          </div>
          <div className="text-xs text-slate-500">
            <strong className="text-slate-800">{activeRoster.length}</strong> / {VIP_ROSTER_CAP} active
            {nearCap && !atCap && <span className="ml-2 text-amber-600">· approaching cap</span>}
            {atCap && <span className="ml-2 text-red-600 font-semibold">· cap reached</span>}
          </div>
        </div>
      </div>


      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3"><UserPlus size={16} className="text-emerald-600" /><h2 className="text-sm font-bold text-slate-900">Add VIP Member</h2></div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com" disabled={atCap}
                className="px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm disabled:bg-slate-100" />
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Display name (optional)" disabled={atCap}
                className="px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm disabled:bg-slate-100" />
              <button onClick={handleAdd} disabled={atCap || !newEmail.trim()}
                className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium text-sm flex items-center gap-1.5"><Plus size={14} /> Add</button>
            </div>
            {atCap   && <p className="text-[11px] text-red-600 mt-2 flex items-center gap-1.5"><AlertCircle size={12} /> Roster is full ({VIP_ROSTER_CAP}/{VIP_ROSTER_CAP}). Revoke an existing member to add a new one.</p>}
            {nearCap && !atCap && <p className="text-[11px] text-amber-700 mt-2 flex items-center gap-1.5"><AlertCircle size={12} /> {remainingSlots} slot{remainingSlots === 1 ? '' : 's'} remaining of {VIP_ROSTER_CAP}.</p>}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900">Roster</h2>
              <div className="flex gap-1 text-xs">
                <button onClick={() => setShowRevoked(false)} className={`px-2.5 py-1 rounded-md font-medium ${!showRevoked ? 'bg-white border border-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Active ({activeRoster.length})</button>
                <button onClick={() => setShowRevoked(true)}  className={`px-2.5 py-1 rounded-md font-medium ${showRevoked  ? 'bg-white border border-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Revoked ({revokedRoster.length})</button>
              </div>
            </div>
            {(showRevoked ? revokedRoster : activeRoster).length === 0 ? (
              <div className="text-center py-10"><Crown size={32} className="mx-auto text-slate-300 mb-3" /><p className="text-sm text-slate-500">{showRevoked ? 'No revoked members.' : 'No VIP members yet. Add one above.'}</p></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {(showRevoked ? revokedRoster : activeRoster).map(entry => {
                  return (
                    <div key={entry.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50">
                      <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0"><Mail size={14} className="text-amber-700" /></div>
                      <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900 truncate">{entry.name || entry.email}</p><p className="text-[11px] text-slate-500 truncate">{entry.email}</p></div>
                      <div className="text-[10px] text-slate-400 text-right hidden sm:block">
                        <p>Added {new Date(entry.added_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        {entry.revoked && entry.revoked_at && <p>Revoked {new Date(entry.revoked_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                      </div>
                      {entry.revoked
                        ? <button onClick={() => handleRestore(entry.id)} disabled={atCap} className="px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 disabled:opacity-40">Restore</button>
                        : <button onClick={() => setRevokeConfirmId(entry.id)} className="px-2.5 py-1.5 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 flex items-center gap-1"><UserX size={11} /> Revoke</button>
                      }
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 sticky top-20">
            <div className="flex items-center gap-2 mb-3"><RefreshCw size={15} className="text-violet-600" /><h2 className="text-sm font-bold text-slate-900">Generate URL for Event</h2></div>
            {!nextVipEvent ? (
              <div className="text-center py-6"><Calendar size={28} className="mx-auto text-slate-300 mb-2" /><p className="text-xs text-slate-500">No event with VIP delivery enabled. Toggle VIP delivery on in an event's settings to use this tool.</p></div>
            ) : (
              <>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Event</p>
                  <p className="text-sm font-semibold text-slate-900 leading-tight">{nextVipEvent.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{formatDateTime(nextVipEvent.kickoff_time)}</p>
                </div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {activeRoster.map(entry => {
                    const url = personalUrl(nextVipEvent, entry);
                    const cid = `${nextVipEvent.id}-${entry.id}`;
                    return (
                      <div key={entry.id} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-[11px] font-semibold text-slate-800 truncate">{entry.name || entry.email}</p>
                          <button onClick={() => copyToClipboard(url, cid)} className="text-[10px] font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-md px-2 py-0.5 hover:bg-violet-100 flex items-center gap-1 flex-shrink-0">
                            {copiedId === cid ? <><Check size={9} /> Copied</> : <><Copy size={9} /> Copy</>}
                          </button>
                        </div>
                        <code className="text-[9.5px] text-slate-500 font-mono break-all leading-tight block">{url}</code>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>


      {revokeConfirmId && (() => {
        const entry = roster.find(r => r.id === revokeConfirmId);
        if (!entry) return null;
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center"><UserX size={22} className="text-red-600" /></div>
                <div><h3 className="text-lg font-bold text-slate-900">Revoke VIP Access</h3><p className="text-sm text-slate-500">{entry.name || entry.email}</p></div>
              </div>
              <p className="text-sm text-slate-700 mb-6">This will immediately invalidate any active VIP session for <strong>{entry.email}</strong>.</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setRevokeConfirmId(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">Cancel</button>
                <button onClick={() => handleRevoke(entry.id)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"><UserX size={16} /> Revoke Access</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}


// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function EventManager() {
  const TENANT_ID = 'burnley';

  const [view, setView]           = useState<ViewMode>('listing');
  const [editingEvent, setEditingEvent] = useState<LiveEvent | null>(null);
  const [activeEvents, setActiveEvents]   = useState<LiveEvent[]>(initialEvents);
  const [vipRoster, setVipRoster]   = useState<VipRosterEntry[]>(initialVipRoster);
  const rosterActiveCount = activeVipCount(vipRoster);

  const [searchQuery, setSearchQuery]         = useState('');
  const [statusFilter, setStatusFilter]       = useState<'all' | EventStatus>('all');
  const [streamLabelFilters, setStreamLabelFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters]         = useState(false);
  const [selectedEvent, setSelectedEvent]     = useState<LiveEvent | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [channelActionConfirm, setChannelActionConfirm] = useState<{ eventId: string; action: 'start' | 'stop' } | null>(null);
  const [showPrevious, setShowPrevious] = useState(false);

  const handleDeleteEvent = (eventId: string) => {
    setActiveEvents(activeEvents.filter(e => e.id !== eventId));
    setDeleteConfirmId(null);
  };

  const handleChannelStart = (eventId: string) => {
    setActiveEvents(prev => prev.map(e => e.id === eventId ? { ...e, channelState: 'starting' } : e));
    setChannelActionConfirm(null);
    setTimeout(() => setActiveEvents(prev => prev.map(e => e.id === eventId ? { ...e, channelState: 'running' } : e)), 3000);
  };

  const handleChannelStop = (eventId: string) => {
    const now = new Date().toISOString();
    setActiveEvents(prev => prev.map(e => e.id === eventId
      ? { ...e, channelState: 'stopping', event_end_time: now, status: 'ended', currentViewers: 0 }
      : e));
    setChannelActionConfirm(null);
    setTimeout(() => setActiveEvents(prev => prev.map(e => e.id === eventId ? { ...e, channelState: 'idle' } : e)), 3000);
  };

  const toggleVisibility = (eventId: string) => {
    setActiveEvents(prev => prev.map(e => e.id === eventId ? { ...e, visibility: e.visibility === 'visible' ? 'hidden' : 'visible' } : e));
  };

  if (view === 'create') return <CreateEventPage tenantId={TENANT_ID} onBack={() => setView('listing')} onSave={e => { setActiveEvents([e, ...activeEvents]); setView('listing'); }} />;
  if (view === 'edit' && editingEvent) return <EditEventPage event={editingEvent} tenantId={TENANT_ID} onBack={() => { setEditingEvent(null); setView('listing'); }} onSave={updated => { setActiveEvents(activeEvents.map(e => e.id === updated.id ? updated : e)); setEditingEvent(null); setView('listing'); }} />;
  if (view === 'vip-members') return <VipMembersPage roster={vipRoster} setRoster={setVipRoster} events={activeEvents} tenantId={TENANT_ID} onBack={() => setView('listing')} />;

  const STREAM_TYPE_LABELS: { type: 'video' | 'radio'; display: string; icon: 'video' | 'radio' }[] = [
    { type: 'video', display: 'Video', icon: 'video' },
    { type: 'radio', display: 'Radio', icon: 'radio' },
  ];

  const filteredEvents = activeEvents.filter(event => {
    const matchesSearch  = event.title.toLowerCase().includes(searchQuery.toLowerCase()) || (event.description || '').toLowerCase().includes(searchQuery.toLowerCase()) || (event.homeTeam && event.homeTeam.toLowerCase().includes(searchQuery.toLowerCase())) || (event.awayTeam && event.awayTeam.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus  = statusFilter === 'all' || event.status === statusFilter;
    const matchesStreams  = streamLabelFilters.length === 0 || streamLabelFilters.every(t => (event.streams || []).some(s => s.output.type === t));
    return matchesSearch && matchesStatus && matchesStreams;
  });

  const activeFilteredEvents = filteredEvents;

  // Sort to "today's events or the first upcoming" at the top; past/ended events sit behind the Previous Events bar.
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const eventMs = (e: LiveEvent) => new Date(e.kickoff_time).getTime();
  const isPrevious = (e: LiveEvent) => e.status === 'ended' || eventMs(e) < todayStart.getTime();
  const previousEvents = activeFilteredEvents.filter(isPrevious).sort((a, b) => eventMs(b) - eventMs(a)); // most-recent first
  const upcomingEvents = activeFilteredEvents.filter(e => !isPrevious(e)).sort((a, b) => eventMs(a) - eventMs(b)); // ascending
  const onEndedFilter = statusFilter === 'ended';
  const revealPrevious = showPrevious || onEndedFilter;
  const shownPrevious = previousEvents.slice(0, onEndedFilter ? previousEvents.length : 5); // last 5 (all when Ended-filtered)
  const orderedEvents = [...(revealPrevious ? shownPrevious : []), ...upcomingEvents];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div><h1 className="text-2xl font-bold text-slate-900">Live Events</h1><p className="text-sm text-slate-500 mt-1">Manage and monitor all live events</p></div>
            <div className="flex gap-3">
              <button onClick={() => setView('vip-members')} className="px-4 py-2 border border-amber-300 bg-amber-50 text-amber-800 rounded-lg hover:bg-amber-100 flex items-center gap-2 text-sm font-medium">
                <Crown size={16} /> VIP Members <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900">{rosterActiveCount}</span>
              </button>
              <button onClick={() => setView('create')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-medium">
                <Video size={18} /> Create Event
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="p-6 border-b border-slate-200">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search events by title, team, or description..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>
              <button onClick={() => setShowFilters(!showFilters)} className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${streamLabelFilters.length > 0 || statusFilter !== 'all' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                <Filter size={18} /> Filters
                {(streamLabelFilters.length > 0 || statusFilter !== 'all') && <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">{streamLabelFilters.length + (statusFilter !== 'all' ? 1 : 0)}</span>}
                <ChevronDown size={16} className={`transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">Status</label>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | EventStatus)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                      <option value="all">All Statuses</option>
                      <option value="live">Live</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="ended">Ended</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">Stream Type</label>
                    <div className="flex gap-2">
                      {STREAM_TYPE_LABELS.map(label => {
                        const isActive  = streamLabelFilters.includes(label.type);
                        const IconComp  = label.icon === 'video' ? Video : Radio;
                        return (
                          <button key={label.type}
                            onClick={() => isActive ? setStreamLabelFilters(streamLabelFilters.filter(f => f !== label.type)) : setStreamLabelFilters([...streamLabelFilters, label.type])}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${isActive ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50'}`}>
                            <IconComp size={16} />{label.display}{isActive && <Check size={14} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">Showing {upcomingEvents.length} upcoming · {previousEvents.length} previous of {activeEvents.length} events</p>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 text-sm"><span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" /><span className="font-medium text-slate-900">{activeEvents.filter(e => e.status === 'live').length} Live</span></span>
                <span className="text-slate-300">|</span>
                <span className="text-sm text-slate-500">{activeEvents.filter(e => e.status === 'upcoming').length} Upcoming</span>
              </div>
            </div>

            {upcomingEvents.length === 0 && previousEvents.length === 0 ? (
              <div className="text-center py-12"><Search size={48} className="mx-auto text-slate-300 mb-4" /><h3 className="text-lg font-semibold text-slate-900 mb-2">No events found</h3><p className="text-slate-500">Try adjusting your search or filters</p></div>
            ) : (
              <div className="space-y-4">
                {previousEvents.length > 0 && (
                  <div>
                    <button onClick={() => setShowPrevious(s => !s)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-left">
                      <div className="flex items-center gap-2">
                        <Archive size={16} className="text-violet-600" />
                        <span className="text-sm font-semibold text-slate-800">Previous Events</span>
                        <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-medium rounded-full">{previousEvents.length}</span>
                        <span className="text-xs text-slate-400">{revealPrevious ? 'showing recent' : 'click to load the last 5'}</span>
                      </div>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform duration-150 ${revealPrevious ? 'rotate-180' : ''}`} />
                    </button>
                    {revealPrevious && !onEndedFilter && previousEvents.length > 5 && (
                      <p className="text-[11px] text-slate-400 mt-1.5 px-1">Showing the 5 most recent — filter Status → Ended to see all {previousEvents.length}.</p>
                    )}
                  </div>
                )}
                {orderedEvents.map(event => {
                  const missingFields  = getMissingFields(event);

                  return (
                    <div key={event.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                      <div className="flex items-start gap-4">
                        <div className="w-48 h-28 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 relative">
                          <Video size={32} className="text-slate-300" />
                          {event.status === 'live' && <div className="absolute top-2 left-2"><span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded flex items-center gap-1"><span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE</span></div>}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-lg font-semibold text-slate-900 truncate">{event.title}</h3>
                                {missingFields.length > 0 && (
                                  <div className="relative group">
                                    <AlertCircle size={20} className="text-amber-500 cursor-help flex-shrink-0" />
                                    <div className="absolute left-0 top-8 bg-slate-900 text-white text-xs rounded-lg p-3 w-64 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                                      <p className="font-semibold mb-1">Missing / Incomplete:</p>
                                      <ul className="space-y-0.5">{missingFields.map(f => <li key={f}>• {f}</li>)}</ul>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <p className="text-sm text-slate-500 line-clamp-1 mb-2">{event.description || 'No description provided'}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(event.status)}`}>{event.status.toUpperCase()}</span>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getReadiness(event) === 'Ready' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{getReadiness(event)}</span>
                              <button onClick={() => toggleVisibility(event.id)} title={event.visibility === 'visible' ? 'Visible — click to hide' : 'Hidden — click to show'}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1 transition-colors ${event.visibility === 'visible' ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}>
                                {event.visibility === 'visible' ? <><Eye size={11} /> Visible</> : <><EyeOff size={11} /> Hidden</>}
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-3">
                            {event.includeMatchDetails && event.homeTeam && event.awayTeam && <span className="flex items-center gap-1"><Users size={16} /> {event.homeTeam} vs {event.awayTeam}</span>}
                            {event.includeMatchDetails && event.venue && <span className="flex items-center gap-1"><MapPin size={16} /> {event.venue}</span>}
                            <span className="flex items-center gap-1"><Calendar size={16} /> {formatShortDate(event.kickoff_time)}</span>
                          </div>


                          {event.status !== 'draft' && (
                            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                              {(() => { const cs = getChannelStateDisplay(event.channelState); return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cs.color}`}><span className={`w-1.5 h-1.5 rounded-full ${cs.dot}`} />{cs.label}</span>; })()}
                              {event.status === 'upcoming' && event.channelState === 'idle' && event.streams.length > 0 && (
                                <button onClick={() => setChannelActionConfirm({ eventId: event.id, action: 'start' })} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors shadow-sm"><Power size={12} /> Start Channel Now</button>
                              )}
                              {event.status === 'live' && event.channelState === 'running' && (
                                <button onClick={() => setChannelActionConfirm({ eventId: event.id, action: 'stop' })} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors shadow-sm"><Square size={12} /> End &amp; Stop Channel</button>
                              )}
                              {(event.channelState === 'starting' || event.channelState === 'stopping') && <span className="text-xs text-slate-400 italic">Please wait…</span>}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <button onClick={() => setSelectedEvent(event)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="View Details"><Eye size={20} /></button>
                          <button onClick={() => { setEditingEvent(event); setView('edit'); }} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Edit Event"><Edit2 size={20} /></button>
                          <button onClick={() => setDeleteConfirmId(event.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Event"><Trash2 size={20} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedEvent && <EventDetailsModal event={selectedEvent} onClose={() => setSelectedEvent(null)} onEdit={evt => { setEditingEvent(evt); setView('edit'); }} />}
      {deleteConfirmId && (() => { const evt = activeEvents.find(e => e.id === deleteConfirmId); if (!evt) return null; return <DeleteConfirmModal event={evt} onConfirm={() => handleDeleteEvent(deleteConfirmId)} onCancel={() => setDeleteConfirmId(null)} />; })()}
      {channelActionConfirm && (() => { const evt = activeEvents.find(e => e.id === channelActionConfirm.eventId); if (!evt) return null; return <ChannelActionConfirmModal event={evt} action={channelActionConfirm.action} onCancel={() => setChannelActionConfirm(null)} onConfirm={() => channelActionConfirm.action === 'start' ? handleChannelStart(evt.id) : handleChannelStop(evt.id)} />; })()}
    </div>
  );
}
