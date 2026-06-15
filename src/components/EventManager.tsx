import React, { useState, useMemo, useId } from 'react';
import {
  Search, Filter, Radio, Video, Calendar, MapPin, Users, Eye, Edit2,
  Trash2, Copy, Check, ChevronDown, X, Clock, Upload,
  AlertCircle, Plus, Archive,
  Power, Square, Zap, Activity, Play, Volume2, VolumeX, Monitor,
  ChevronLeft, ChevronRight, Pause, Maximize2, Edit3,
  Crown, Mail, UserPlus, UserX, RefreshCw,
} from 'lucide-react';

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────

type BroadcastStatus = 'ACTIVE' | 'INACTIVE' | 'IN_USE' | 'MAINTENANCE';
type InputType = 'RTMP_PUSH' | 'SRT_CALLER' | 'RTP_PUSH' | 'HLS_PULL' | 'MEDIACONNECT';
type EventStatus = 'live' | 'upcoming' | 'ended' | 'draft';
type ChannelState = 'idle' | 'starting' | 'running' | 'stopping';
type ViewMode = 'listing' | 'create' | 'edit' | 'vip-members';
type VipDistributionStatus = 'pending' | 'queued' | 'sent' | 'failed';

interface Broadcast {
  broadcast_id: string;
  broadcast_name: string;
  input_type: InputType;
  status: BroadcastStatus;
  protocol_label: string;
  description: string;
  endpoint_url: string;
  endpoint_port?: number;
  stream_key?: string;
}

interface StreamTemplate {
  template_id: string;
  display_name: string;
  description: string;
  icon: 'video' | 'radio';
  specs: string[];
  cdn_destination: string;
}

interface StreamRow {
  id: string;
  title: string;
  icon: string;
  thumbnail?: { name: string; url: string } | null;
  broadcast_id: string;
  stream_template_id: string;
  live2vod: boolean;
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
  venue: string;
  event_start_time: string;
  kickoff_time: string;
  event_end_time: string;
  image_16x9: { name: string; url: string } | null;
  currentViewers: number;
  peakViewers: number;
  streams: StreamRow[];
  vip_delivery: VipDelivery;
  apiUrl: string;
  isDraft: boolean;
}

// ─── SHARED CONSTANTS ────────────────────────────────────────────────────────

const CLIENT_BROADCASTS: Broadcast[] = [
  { broadcast_id: 'BC-001', broadcast_name: 'Primary RTMP Input',        input_type: 'RTMP_PUSH',    status: 'ACTIVE',   protocol_label: 'RTMP Push',    description: 'Main stadium encoder',              endpoint_url: 'rtmp://ingest.medialive.eu-west-2.amazonaws.com/live',                            stream_key: 'bc001-a1b2c3d4e5f6' },
  { broadcast_id: 'BC-002', broadcast_name: 'Stadium SRT Feed',          input_type: 'SRT_CALLER',   status: 'ACTIVE',   protocol_label: 'SRT Caller',   description: 'Low-latency encrypted feed',         endpoint_url: 'srt://ingest.medialive.eu-west-2.amazonaws.com',                                  endpoint_port: 9001 },
  { broadcast_id: 'BC-003', broadcast_name: 'Backup HLS Source',         input_type: 'HLS_PULL',     status: 'ACTIVE',   protocol_label: 'HLS Pull',     description: 'Pull from S3 or HTTP server',        endpoint_url: 'https://s3.eu-west-2.amazonaws.com/yc-live-backup/stream.m3u8' },
  { broadcast_id: 'BC-004', broadcast_name: 'Training Ground Camera',    input_type: 'RTMP_PUSH',    status: 'IN_USE',   protocol_label: 'RTMP Push',    description: 'Remote training facility encoder',   endpoint_url: 'rtmp://ingest.medialive.eu-west-2.amazonaws.com/training',                        stream_key: 'bc004-x7y8z9w0v1u2' },
  { broadcast_id: 'BC-005', broadcast_name: 'MediaConnect Contribution', input_type: 'MEDIACONNECT', status: 'ACTIVE',   protocol_label: 'MediaConnect', description: 'AWS MediaConnect flow',              endpoint_url: 'arn:aws:mediaconnect:eu-west-2:123456789:flow:bc005-main' },
];

const STREAM_TEMPLATES: StreamTemplate[] = [
  { template_id: 'stream_video_1080', display_name: 'Video', description: 'Full HD live video – HLS to Live', icon: 'video', specs: ['H.264 AVC', '1920×1080 @ 5Mbps', 'AAC-LC 128kbps'], cdn_destination: 'Live' },
  { template_id: 'stream_audio_only', display_name: 'Radio', description: 'Radio-style commentary – HLS to Live', icon: 'radio', specs: ['AAC-LC 128kbps', '48kHz Stereo'], cdn_destination: 'Live' },
];

const LIVE2VOD_SPEC = { description: 'Archive to S3 for on-demand replay', specs: ['H.264 AVC', '1920×1080 @ 8Mbps', 'AAC-LC 192kbps'], cdn_destination: 'S3 Archive' };
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
  return missing;
};

let rowCounter = 100;
const createStreamRow = (overrides: Partial<StreamRow> = {}): StreamRow => ({
  id: `sr-${++rowCounter}`,
  title: `Stream ${rowCounter - 100}`,
  icon: 'video',
  thumbnail: null,
  broadcast_id: '',
  stream_template_id: '',
  live2vod: false,
  expanded: false,
  ...overrides,
});

// ─── MOCK INITIAL EVENTS ─────────────────────────────────────────────────────

const initialEvents: LiveEvent[] = [
  {
    id: 'evt_001', title: 'KC Current vs Portland Thorns',
    description: 'Regular season match featuring two top teams in the league',
    status: 'live', channelState: 'running', includeMatchDetails: true,
    homeTeam: 'KC Current', awayTeam: 'Portland Thorns', competition: 'NWSL Regular Season', venue: 'CPKC Stadium',
    event_start_time: '2026-01-26T18:30:00', kickoff_time: '2026-01-26T19:00:00', event_end_time: '2026-01-26T21:00:00',
    image_16x9: null, currentViewers: 12453, peakViewers: 15782,
    streams: [
      { id: 'sr-001a', title: 'Main Broadcast', icon: 'video', thumbnail: null, broadcast_id: 'BC-001', stream_template_id: 'stream_video_1080', live2vod: true, expanded: false },
      { id: 'sr-001b', title: 'Audio Commentary', icon: 'radio', thumbnail: null, broadcast_id: 'BC-002', stream_template_id: 'stream_audio_only', live2vod: false, expanded: false },
    ],
    vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_001', isDraft: false,
  },
  {
    id: 'evt_002', title: 'Season Launch Press Conference',
    description: 'Join us for the official 2026 season announcement with special guests',
    status: 'upcoming', channelState: 'idle', includeMatchDetails: false,
    homeTeam: '', awayTeam: '', competition: '', venue: '',
    event_start_time: '2026-01-28T13:45:00', kickoff_time: '2026-01-28T14:00:00', event_end_time: '2026-01-28T15:30:00',
    image_16x9: null, currentViewers: 0, peakViewers: 0,
    streams: [
      { id: 'sr-002a', title: 'Main Feed', icon: 'video', thumbnail: null, broadcast_id: 'BC-003', stream_template_id: 'stream_video_1080', live2vod: true, expanded: false },
    ],
    vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_002', isDraft: false,
  },
  {
    id: 'evt_003', title: 'Orlando Pride vs Washington Spirit',
    description: '', status: 'draft', channelState: 'idle', includeMatchDetails: true,
    homeTeam: 'Orlando Pride', awayTeam: 'Washington Spirit', competition: 'NWSL Regular Season', venue: '',
    event_start_time: '2026-01-27T17:00:00', kickoff_time: '2026-01-27T17:30:00', event_end_time: '',
    image_16x9: null, currentViewers: 0, peakViewers: 0,
    streams: [], vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_003', isDraft: true,
  },
  {
    id: 'evt_004', title: 'Player Q&A Session',
    description: 'Interactive session with star players answering fan questions',
    status: 'ended', channelState: 'idle', includeMatchDetails: false,
    homeTeam: '', awayTeam: '', competition: '', venue: '',
    event_start_time: '2026-01-25T15:45:00', kickoff_time: '2026-01-25T16:00:00', event_end_time: '2026-01-25T17:00:00',
    image_16x9: null, currentViewers: 0, peakViewers: 8432,
    streams: [
      { id: 'sr-004a', title: 'Q&A Stream', icon: 'video', thumbnail: null, broadcast_id: 'BC-001', stream_template_id: 'stream_video_1080', live2vod: true, expanded: false },
    ],
    vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_004', isDraft: false,
  },
  {
    id: 'evt_005', title: 'San Diego Wave vs OL Reign',
    description: 'Western Conference battle for playoff positioning',
    status: 'ended', channelState: 'idle', includeMatchDetails: true,
    homeTeam: 'San Diego Wave', awayTeam: 'OL Reign', competition: 'NWSL Regular Season', venue: 'Snapdragon Stadium',
    event_start_time: '2026-01-24T19:30:00', kickoff_time: '2026-01-24T20:00:00', event_end_time: '2026-01-24T22:00:00',
    image_16x9: null, currentViewers: 0, peakViewers: 18942,
    streams: [
      { id: 'sr-005a', title: 'HD Broadcast', icon: 'video', thumbnail: null, broadcast_id: 'BC-001', stream_template_id: 'stream_video_1080', live2vod: true, expanded: false },
      { id: 'sr-005b', title: 'Radio Feed',   icon: 'radio', thumbnail: null, broadcast_id: 'BC-002', stream_template_id: 'stream_audio_only', live2vod: false, expanded: false },
    ],
    vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_005', isDraft: false,
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

function StreamRowCard({ row, index, onUpdate, onRemove, allStreams, vipEnabled, onVipEnabledChange, vipRosterCount }: {
  row: StreamRow; index: number; onUpdate: (r: StreamRow) => void; onRemove: () => void;
  allStreams: StreamRow[]; vipEnabled: boolean; onVipEnabledChange: (enabled: boolean) => void; vipRosterCount: number;
}) {
  const broadcast = CLIENT_BROADCASTS.find(b => b.broadcast_id === row.broadcast_id);
  const template  = STREAM_TEMPLATES.find(t => t.template_id === row.stream_template_id);
  const isConfigured = !!row.broadcast_id && !!row.stream_template_id;

  const isFirstVideoForBroadcast = useMemo(() => {
    if (!row.broadcast_id || !template || template.icon !== 'video') return false;
    const videoStreamsForBroadcast = allStreams.filter(s => {
      const t = STREAM_TEMPLATES.find(st => st.template_id === s.stream_template_id);
      return s.broadcast_id === row.broadcast_id && t && t.icon === 'video';
    });
    return videoStreamsForBroadcast.length > 0 && videoStreamsForBroadcast[0].id === row.id;
  }, [row.id, row.broadcast_id, template, allStreams]);

  const isFirstVideoOverall = useMemo(() => {
    if (!template || template.icon !== 'video' || !row.broadcast_id) return false;
    const firstVideo = allStreams.find(s => {
      const t = STREAM_TEMPLATES.find(st => st.template_id === s.stream_template_id);
      return s.broadcast_id && t && t.icon === 'video';
    });
    return firstVideo?.id === row.id;
  }, [row.id, template, row.broadcast_id, allStreams]);

  return (
    <div className={`rounded-xl border-2 overflow-hidden transition-all ${isConfigured ? 'border-emerald-300 bg-white shadow-sm' : 'border-slate-200 bg-white'}`}>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isConfigured ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
              {isConfigured ? <Check size={12} /> : index + 1}
            </span>
            <div className="relative flex-shrink-0">
              <select value={row.icon} onChange={e => onUpdate({ ...row, icon: e.target.value })}
                className="appearance-none w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer text-center text-transparent focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none" title="Stream icon">
                {STREAM_ICONS.map(si => <option key={si.id} value={si.id}>{si.label}</option>)}
              </select>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {(() => { const si = STREAM_ICONS.find(s => s.id === row.icon); const IconComp = si ? si.Icon : Video; return <IconComp size={16} className="text-slate-600" />; })()}
              </div>
            </div>
            <div className="relative flex-1 min-w-0 max-w-56">
              <input type="text" value={row.title} onChange={e => onUpdate({ ...row, title: e.target.value })}
                className="w-full text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg pl-3 pr-8 py-1.5 hover:border-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none transition-colors"
                placeholder="Enter stream name..." />
              <Edit3 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <button onClick={onRemove} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 ml-2" title="Remove stream">
            <Trash2 size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Broadcast Input</label>
            <select value={row.broadcast_id} onChange={e => onUpdate({ ...row, broadcast_id: e.target.value })}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm">
              <option value="">Select broadcast...</option>
              {CLIENT_BROADCASTS.map(b => (
                <option key={b.broadcast_id} value={b.broadcast_id} disabled={b.status === 'IN_USE' || b.status === 'INACTIVE'}>
                  {b.broadcast_name} ({b.protocol_label}){b.status === 'IN_USE' ? ' – In Use' : ''}
                </option>
              ))}
            </select>
            {broadcast && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${INPUT_TYPE_COLORS[broadcast.input_type]}`}>{broadcast.protocol_label}</span>
                  <span className="text-[10px] text-slate-500">{broadcast.description}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase w-14 flex-shrink-0">Endpoint</span>
                    <code className="text-[10px] text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded break-all">{broadcast.endpoint_url}</code>
                  </div>
                  {broadcast.endpoint_port && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase w-14 flex-shrink-0">Port</span>
                      <code className="text-[10px] text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{broadcast.endpoint_port}</code>
                    </div>
                  )}
                  {broadcast.stream_key && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase w-14 flex-shrink-0">Key</span>
                      <code className="text-[10px] text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{broadcast.stream_key}</code>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Stream Output</label>
            <select value={row.stream_template_id} onChange={e => onUpdate({ ...row, stream_template_id: e.target.value })}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm">
              <option value="">Select stream template...</option>
              {STREAM_TEMPLATES.map(t => <option key={t.template_id} value={t.template_id}>{t.display_name} – {t.cdn_destination}</option>)}
            </select>
            {template && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {template.specs.map((s, i) => <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">{s}</span>)}
              </div>
            )}

            {isFirstVideoForBroadcast && (
              <label className="flex items-start gap-2.5 mt-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:border-emerald-300 transition-colors">
                <input type="checkbox" checked={row.live2vod} onChange={e => onUpdate({ ...row, live2vod: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-200" />
                <div>
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5"><Archive size={12} className="text-amber-600" />Enable Live2VOD</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">{LIVE2VOD_SPEC.description} – {LIVE2VOD_SPEC.specs[1]} – {LIVE2VOD_SPEC.cdn_destination}</p>
                </div>
              </label>
            )}

            {isFirstVideoOverall && (
              <label className="flex items-start gap-2.5 mt-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:border-amber-300 transition-colors">
                <input type="checkbox" checked={vipEnabled} onChange={e => onVipEnabledChange(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-200" />
                <div>
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5"><Crown size={12} className="text-amber-600" />Enable VIP delivery</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Mirror all video streams to the {vipRosterCount}-member VIP roster. Delivery details configured in <strong>VIP Members</strong>.
                  </p>
                </div>
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── CREATE EVENT PAGE ───────────────────────────────────────────────────────

interface CreateEventForm {
  event_name: string; description: string; event_date: string; event_start_time: string; kickoff_time: string; event_end_time: string;
  image_16x9: { name: string; url: string } | null;
  home_team: string; away_team: string; competition: string; venue: string;
}

function CreateEventPage({ onBack, onSave, tenantId, rosterCount }: {
  onBack: () => void; onSave: (e: LiveEvent) => void; tenantId: string; rosterCount: number;
}) {
  const [form, setForm] = useState<CreateEventForm>({
    event_name: '', description: '', event_date: '', event_start_time: '', kickoff_time: '', event_end_time: '',
    image_16x9: null,
    home_team: '', away_team: '', competition: '', venue: '',
  });
  const [includeMatchDetails, setIncludeMatchDetails] = useState(false);
  const [streams, setStreams]       = useState<StreamRow[]>([]);
  const [vipEnabled, setVipEnabled] = useState(false);

  const updateForm = (u: Partial<CreateEventForm>) => setForm(p => ({ ...p, ...u }));
  const handleImageUpload = (key: 'image_16x9') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) updateForm({ [key]: { name: f.name, url: URL.createObjectURL(f) } } as Partial<CreateEventForm>);
  };

  const addStream    = () => setStreams(p => [...p, createStreamRow({ title: `Stream ${p.length + 1}` })]);
  const removeStream = (id: string) => setStreams(p => p.filter(s => s.id !== id));
  const updateStream = (id: string, row: StreamRow) => setStreams(p => p.map(s => s.id === id ? row : s));

  const configuredStreams = streams.filter(s => s.broadcast_id && s.stream_template_id);
  const formValid = useMemo(() => {
    const base = !!form.event_name && !!form.event_date && !!form.event_start_time && !!form.kickoff_time && configuredStreams.length > 0;
    if (includeMatchDetails) return base && !!form.home_team && !!form.away_team;
    return base;
  }, [form, includeMatchDetails, configuredStreams.length]);

  const handleSave = () => {
    const id = `evt_${Date.now()}`;
    onSave({
      id, title: form.event_name, description: form.description, status: 'upcoming', channelState: 'idle',
      includeMatchDetails,
      homeTeam:    includeMatchDetails ? form.home_team   : '',
      awayTeam:    includeMatchDetails ? form.away_team   : '',
      competition: includeMatchDetails ? form.competition : '',
      venue:       includeMatchDetails ? form.venue       : '',
      event_start_time: `${form.event_date}T${form.event_start_time}:00`,
      kickoff_time:     `${form.event_date}T${form.kickoff_time}:00`,
      event_end_time:   form.event_end_time ? `${form.event_date}T${form.event_end_time}:00` : '',
      image_16x9: form.image_16x9,
      currentViewers: 0, peakViewers: 0,
      streams: configuredStreams,
      vip_delivery: {
        enabled: vipEnabled,
        hosted_page_url:     vipEnabled ? `https://vip.yinzcam.com/${tenantId}/${id}` : undefined,
        distribution_status: vipEnabled ? 'pending' : undefined,
      },
      apiUrl: `https://api.example.com/v1/events/${id}`,
      isDraft: false,
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
                    <AutocompleteInput label="Venue" value={form.venue} onChange={v => updateForm({ venue: v })} options={VENUES} placeholder="e.g. Turf Moor" />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-base font-bold text-slate-900 mb-1">Event Artwork</h2>
              <p className="text-xs text-slate-500 mb-4">Used across schedules, programme guides, notifications, and social assets</p>
              <ImageUploadZone label="Landscape" aspectLabel="16:9 – 1920×1080" image={form.image_16x9} onUpload={handleImageUpload('image_16x9')} onRemove={() => updateForm({ image_16x9: null })} aspectClass="aspect-video" />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-bold text-slate-900">Streams</h2>
                <button onClick={addStream} className="px-3.5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-medium flex items-center gap-1.5"><Plus size={14} />Add Stream</button>
              </div>
              <p className="text-xs text-slate-500 mb-5">Each stream pairs a broadcast input with an output template.</p>
              {streams.length === 0 ? (
                <button onClick={addStream} className="w-full py-10 border-2 border-dashed border-slate-300 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all flex flex-col items-center gap-2 cursor-pointer">
                  <Plus size={24} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-600">Add your first stream</span>
                  <span className="text-xs text-slate-400">Pair a broadcast input with an output template</span>
                </button>
              ) : (
                <div className="space-y-3">
                  {streams.map((row, i) => (
                    <StreamRowCard key={row.id} row={row} index={i} onUpdate={r => updateStream(row.id, r)} onRemove={() => removeStream(row.id)}
                      allStreams={streams} vipEnabled={vipEnabled} onVipEnabledChange={setVipEnabled} vipRosterCount={rosterCount} />
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
                  { done: configuredStreams.length > 0, label: 'At least one configured stream' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${item.done ? 'bg-emerald-500' : 'border-2 border-slate-300'}`}>{item.done && <Check size={10} className="text-white" />}</div>
                    <span className={`text-xs ${item.done ? 'text-slate-700' : 'text-slate-400'}`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── EDIT EVENT PAGE ─────────────────────────────────────────────────────────

function EditEventPage({ event, onBack, onSave, tenantId, rosterCount }: {
  event: LiveEvent; onBack: () => void; onSave: (e: LiveEvent) => void; tenantId: string; rosterCount: number;
}) {
  const [form, setForm] = useState({
    title: event.title || '', description: event.description || '',
    includeMatchDetails: event.includeMatchDetails || false,
    homeTeam: event.homeTeam || '', awayTeam: event.awayTeam || '',
    competition: event.competition || '', venue: event.venue || '',
    event_start_time: event.event_start_time || '', kickoff_time: event.kickoff_time || '', event_end_time: event.event_end_time || '',
    image_16x9: event.image_16x9,
  });
  const [streams, setStreams] = useState<StreamRow[]>(event.streams || []);
  const [vipEnabled, setVipEnabled] = useState<boolean>(event.vip_delivery?.enabled ?? false);

  const addStream    = () => setStreams(p => [...p, createStreamRow({ title: `Stream ${p.length + 1}` })]);
  const removeStream = (id: string) => setStreams(p => p.filter(s => s.id !== id));
  const updateStream = (id: string, row: StreamRow) => setStreams(p => p.map(s => s.id === id ? row : s));
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleSave = () => {
    const nextVip: VipDelivery = vipEnabled
      ? { enabled: true, hosted_page_url: event.vip_delivery?.hosted_page_url || `https://vip.yinzcam.com/${tenantId}/${event.id}`, distribution_status: event.vip_delivery?.distribution_status || 'pending', last_email_sent_at: event.vip_delivery?.last_email_sent_at }
      : { enabled: false };
    onSave({ ...event, ...form, streams, vip_delivery: nextVip });
  };

  return (
    <div className="min-h-screen bg-slate-50">
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
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Venue</label><input type="text" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none text-sm" /></div>
              </div>
            </div>
          )}

        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-slate-900">Streams</h2>
            <button onClick={addStream} className="px-3.5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-medium flex items-center gap-1.5"><Plus size={14} /> Add Stream</button>
          </div>
          <p className="text-xs text-slate-500 mb-5">Each stream pairs a broadcast input with an output template.</p>
          {streams.length === 0 ? (
            <button onClick={addStream} className="w-full py-10 border-2 border-dashed border-slate-300 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all flex flex-col items-center gap-2 cursor-pointer">
              <Plus size={24} className="text-slate-400" /><span className="text-sm font-medium text-slate-600">Add your first stream</span>
            </button>
          ) : (
            <div className="space-y-3">
              {streams.map((row, i) => (
                <StreamRowCard key={row.id} row={row} index={i} onUpdate={r => updateStream(row.id, r)} onRemove={() => removeStream(row.id)}
                  allStreams={streams} vipEnabled={vipEnabled} onVipEnabledChange={setVipEnabled} vipRosterCount={rosterCount} />
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
                  {event.venue && <div><label className="block text-sm font-medium text-slate-900 mb-1">Venue</label><p className="text-slate-700 flex items-center gap-2"><MapPin size={16} /> {event.venue}</p></div>}
                </>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-slate-900 mb-1">Event Start</label><p className="text-slate-700 text-sm">{formatDateTime(event.event_start_time)}</p></div>
                <div><label className="block text-sm font-medium text-slate-900 mb-1">{event.includeMatchDetails ? 'Kick-off' : 'Main Start'}</label><p className="text-slate-700 text-sm">{formatDateTime(event.kickoff_time)}</p></div>
                {event.event_end_time && <div><label className="block text-sm font-medium text-slate-900 mb-1">Event End</label><p className="text-slate-700 text-sm">{formatDateTime(event.event_end_time)}</p></div>}
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div className="bg-slate-50 rounded-lg p-4"><p className="text-sm font-medium text-slate-900 mb-1">Current Viewers</p><p className="text-2xl font-bold text-slate-900">{event.currentViewers.toLocaleString()}</p></div>
                <div className="bg-slate-50 rounded-lg p-4"><p className="text-sm font-medium text-slate-900 mb-1">Peak Viewers</p><p className="text-2xl font-bold text-slate-900">{event.peakViewers.toLocaleString()}</p></div>
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
                const broadcast = CLIENT_BROADCASTS.find(b => b.broadcast_id === stream.broadcast_id);
                const template  = STREAM_TEMPLATES.find(t => t.template_id === stream.stream_template_id);
                const si        = STREAM_ICONS.find(ic => ic.id === stream.icon);
                const StreamIconComp = si ? si.Icon : Video;
                return (
                  <div key={stream.id} className="border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><StreamIconComp size={16} className="text-emerald-700" /></div>
                      <div className="flex-1"><h4 className="font-semibold text-slate-900">{stream.title}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          {stream.live2vod && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1"><Archive size={9} /> Live2VOD</span>}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Broadcast Input</p>
                        {broadcast ? <><p className="text-sm font-medium text-slate-900">{broadcast.broadcast_name}</p><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${INPUT_TYPE_COLORS[broadcast.input_type]}`}>{broadcast.protocol_label}</span></> : <p className="text-sm text-slate-400">Not assigned</p>}
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Stream Output</p>
                        {template ? <><p className="text-sm font-medium text-slate-900">{template.display_name}</p><p className="text-[10px] text-slate-500 mt-0.5">{template.description}</p></> : <p className="text-sm text-slate-400">Not assigned</p>}
                      </div>
                    </div>
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
                            const si = STREAM_ICONS.find(ic => ic.id === stream.icon);
                            const StreamIcon = si ? si.Icon : Video;
                            const isActive = idx === previewStreamIndex;
                            return (
                              <button key={stream.id} onClick={() => setPreviewStreamIndex(idx)}
                                className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all text-left ${isActive ? 'border-emerald-500 bg-white shadow-sm' : 'border-transparent bg-white/60 hover:bg-white hover:border-slate-300'}`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-emerald-100' : 'bg-slate-100'}`}><StreamIcon size={16} className={isActive ? 'text-emerald-700' : 'text-slate-400'} /></div>
                                <div className="min-w-0"><p className={`text-sm font-medium truncate ${isActive ? 'text-emerald-700' : 'text-slate-600'}`}>{stream.title}</p></div>
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
                    const template = STREAM_TEMPLATES.find(t => t.template_id === activeStream.stream_template_id);
                    const isAudio  = template?.icon === 'radio' || activeStream.icon === 'radio';
                    return (
                      <div className="rounded-xl overflow-hidden border border-slate-200 bg-black">
                        {isAudio ? (
                          <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-8 py-12 flex flex-col items-center justify-center">
                            <div className="w-20 h-20 rounded-full bg-emerald-600/20 flex items-center justify-center mb-4 ring-4 ring-emerald-600/10"><Radio size={36} className="text-emerald-400" /></div>
                            <p className="text-white font-semibold text-lg">{activeStream.title}</p>
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
                                <p className="text-white font-semibold text-lg drop-shadow-lg">{activeStream.title}</p>
                              </div>
                            </div>
                            <div className="absolute top-4 left-4 flex items-center gap-2">
                              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600 text-white text-xs font-bold rounded shadow-lg"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE</span>
                              <span className="px-2.5 py-1 bg-black/50 backdrop-blur text-white text-xs font-medium rounded">{event.currentViewers.toLocaleString()} viewers</span>
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

  if (view === 'create') return <CreateEventPage tenantId={TENANT_ID} rosterCount={rosterActiveCount} onBack={() => setView('listing')} onSave={e => { setActiveEvents([e, ...activeEvents]); setView('listing'); }} />;
  if (view === 'edit' && editingEvent) return <EditEventPage event={editingEvent} tenantId={TENANT_ID} rosterCount={rosterActiveCount} onBack={() => { setEditingEvent(null); setView('listing'); }} onSave={updated => { setActiveEvents(activeEvents.map(e => e.id === updated.id ? updated : e)); setEditingEvent(null); setView('listing'); }} />;
  if (view === 'vip-members') return <VipMembersPage roster={vipRoster} setRoster={setVipRoster} events={activeEvents} tenantId={TENANT_ID} onBack={() => setView('listing')} />;

  const STREAM_TYPE_LABELS = STREAM_TEMPLATES.map(t => ({ template_id: t.template_id, display: t.display_name, icon: t.icon }));

  const filteredEvents = activeEvents.filter(event => {
    const matchesSearch  = event.title.toLowerCase().includes(searchQuery.toLowerCase()) || (event.description || '').toLowerCase().includes(searchQuery.toLowerCase()) || (event.homeTeam && event.homeTeam.toLowerCase().includes(searchQuery.toLowerCase())) || (event.awayTeam && event.awayTeam.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus  = statusFilter === 'all' || event.status === statusFilter;
    const matchesStreams  = streamLabelFilters.length === 0 || streamLabelFilters.every(templateId => (event.streams || []).some(s => s.stream_template_id === templateId));
    return matchesSearch && matchesStatus && matchesStreams;
  });

  const activeFilteredEvents = filteredEvents;

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
                        const isActive  = streamLabelFilters.includes(label.template_id);
                        const IconComp  = label.icon === 'video' ? Video : Radio;
                        return (
                          <button key={label.template_id}
                            onClick={() => isActive ? setStreamLabelFilters(streamLabelFilters.filter(f => f !== label.template_id)) : setStreamLabelFilters([...streamLabelFilters, label.template_id])}
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
              <p className="text-sm text-slate-500">Showing {activeFilteredEvents.length} of {activeEvents.length} events</p>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 text-sm"><span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" /><span className="font-medium text-slate-900">{activeEvents.filter(e => e.status === 'live').length} Live</span></span>
                <span className="text-slate-300">|</span>
                <span className="text-sm text-slate-500">{activeEvents.filter(e => e.status === 'upcoming').length} Upcoming</span>
              </div>
            </div>

            {activeFilteredEvents.length === 0 ? (
              <div className="text-center py-12"><Search size={48} className="mx-auto text-slate-300 mb-4" /><h3 className="text-lg font-semibold text-slate-900 mb-2">No events found</h3><p className="text-slate-500">Try adjusting your search or filters</p></div>
            ) : (
              <div className="space-y-4">
                {activeFilteredEvents.map(event => {
                  const configuredStreams = event.streams.filter(s => s.broadcast_id && s.stream_template_id);
                  const hasLive2VOD = event.streams.some(s => s.live2vod);
                  const broadcastTypes = Array.from(new Set(event.streams.map(s => CLIENT_BROADCASTS.find(bc => bc.broadcast_id === s.broadcast_id)?.protocol_label).filter(Boolean) as string[]));
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
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${getStatusColor(event.status)}`}>{event.status.toUpperCase()}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-3">
                            {event.includeMatchDetails && event.homeTeam && event.awayTeam && <span className="flex items-center gap-1"><Users size={16} /> {event.homeTeam} vs {event.awayTeam}</span>}
                            {event.includeMatchDetails && event.venue && <span className="flex items-center gap-1"><MapPin size={16} /> {event.venue}</span>}
                            <span className="flex items-center gap-1"><Calendar size={16} /> {formatShortDate(event.kickoff_time)}</span>
                            <span className="flex items-center gap-1"><Eye size={16} />{event.status === 'live' ? `${event.currentViewers.toLocaleString()} watching` : `${event.peakViewers.toLocaleString()} peak`}</span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium flex items-center gap-1"><Video size={12} /> {configuredStreams.length} Stream{configuredStreams.length !== 1 ? 's' : ''}</span>
                            {broadcastTypes.map(bt => { const inputType = CLIENT_BROADCASTS.find(b => b.protocol_label === bt)?.input_type; return <span key={bt} className={`px-2 py-1 rounded text-xs font-medium ${inputType ? INPUT_TYPE_COLORS[inputType] : 'bg-slate-100 text-slate-600'}`}>{bt}</span>; })}
                            {hasLive2VOD && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium flex items-center gap-1"><Archive size={12} /> Live2VOD</span>}
                            {event.includeMatchDetails && <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">Match Details</span>}
                            {event.vip_delivery?.enabled && <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-medium flex items-center gap-1 border border-amber-300"><Crown size={12} /> VIP · {rosterActiveCount}</span>}
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
