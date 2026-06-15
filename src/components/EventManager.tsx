import React, { useState, useMemo } from 'react';
import {
  Search, Filter, Radio, Video, Calendar, MapPin, Users, Globe, Eye, Edit2,
  Trash2, Copy, Check, ChevronDown, ChevronUp, X, Clock, Upload,
  Sparkles, AlertCircle, FileText, Plus, Archive, Shield, CreditCard, Image,
  Power, Square, Zap, Activity, Play, Volume2, VolumeX, Monitor,
  ChevronLeft, ChevronRight, Pause, Maximize2, Share2, Link, Key, Edit3,
  Crown, Mail, UserPlus, UserX, Send, RefreshCw, AtSign, Palette,
} from 'lucide-react';

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────

type BroadcastStatus = 'ACTIVE' | 'INACTIVE' | 'IN_USE' | 'MAINTENANCE';
type InputType = 'RTMP_PUSH' | 'SRT_CALLER' | 'RTP_PUSH' | 'HLS_PULL' | 'MEDIACONNECT';
type EventStatus = 'live' | 'upcoming' | 'ended' | 'draft';
type ChannelState = 'idle' | 'starting' | 'running' | 'stopping';
type ViewMode = 'listing' | 'create' | 'create-previous' | 'edit' | 'vip-members';
type VipDistributionStatus = 'pending' | 'queued' | 'sent' | 'failed';

type VodAssetType = 'highlights' | 'full_replay' | 'extended_highlights' | 'press_conference';

interface VodAsset {
  id: string;
  title: string;
  opta_id: string;
  type: VodAssetType;
  duration_seconds: number;
  published_at: string;
}

interface VodLink {
  asset_id: string;
  asset_title: string;
  asset_type: VodAssetType;
  duration_seconds: number;
  published_at: string;
  confirmed: boolean;
}

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

type StatsFeedProvider = 'opta' | 'statsperform' | 'genius' | 'sportradar';
type SourceProvider = StatsFeedProvider | 'document_extraction' | 'manual';

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
  extraction_review_required?: boolean;
  extraction_source_filename?: string;
}

interface CatalogFixture {
  opta_id: string;
  home_team: string;
  away_team: string;
  competition: string;
  venue: string;
  kickoff_iso: string;
}

interface SocialTarget {
  platform_id: string;
  url: string;
  key: string;
}

interface StreamRow {
  id: string;
  title: string;
  icon: string;
  thumbnail?: { name: string; url: string } | null;
  broadcast_id: string;
  stream_template_id: string;
  live2vod: boolean;
  syndicate_social: boolean;
  social_targets: SocialTarget[];
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

type DmarcPolicy      = 'none' | 'quarantine' | 'reject';
type DomainVerifyStatus = 'unverified' | 'pending' | 'verified' | 'failed';

interface VipEmailDomain {
  from_name: string;
  from_address: string;
  reply_to: string;
  sending_domain: string;
  dkim_selector: string;
  dmarc_policy: DmarcPolicy;
  verification_status: DomainVerifyStatus;
}

interface VipEmailBranding {
  logo_url: string;
  primary_colour: string;
  subject_template: string;
  footer_text: string;
}

type AuditAction =
  | 'member_added' | 'member_revoked' | 'member_restored'
  | 'email_sent' | 'email_resent' | 'email_delivered' | 'email_opened' | 'email_bounced'
  | 'link_opened' | 'stream_viewed'
  | 'settings_updated' | 'vip_toggled_on' | 'vip_toggled_off'
  | 'url_generated';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: AuditAction;
  member_email?: string;
  member_name?: string;
  event_title?: string;
  detail?: string;
}

interface VipSettings {
  lead_time_minutes: number;
  access_model: 'email_bound_passwordless';
  rights_bypass: { geo: true; subscription: true; segments: true };
  hosted_page_host: string;
  email_domain: VipEmailDomain;
  email_branding: VipEmailBranding;
}

const initialVipSettings: VipSettings = {
  lead_time_minutes: 1440,
  access_model: 'email_bound_passwordless',
  rights_bypass: { geo: true, subscription: true, segments: true },
  hosted_page_host: 'vip.yinzcam.com',
  email_domain: {
    from_name: 'Burnley FC',
    from_address: 'noreply@burnleyfc.com',
    reply_to: '',
    sending_domain: 'burnleyfc.com',
    dkim_selector: 'yinzcam',
    dmarc_policy: 'none',
    verification_status: 'unverified',
  },
  email_branding: {
    logo_url: '',
    primary_colour: '#6d28d9',
    subject_template: 'Your VIP access for {{event_name}} is ready',
    footer_text: '',
  },
};

const initialStatsFeedSettings: StatsFeedSettings = {
  provider: 'opta',
  primary_team_display: 'Burnley FC',
  credentials_configured: true,
  competitions_in_scope: ['EFL Championship', 'FA Cup', 'EFL Cup'],
  default_pull_count: 10,
};

const FIXTURE_CATALOG: CatalogFixture[] = [
  { opta_id: 'g2412345', home_team: 'Burnley FC',      away_team: 'Blackburn Rovers',  competition: 'EFL Championship', venue: 'Turf Moor',          kickoff_iso: '2026-03-15T15:00:00+00:00' },
  { opta_id: 'g2412401', home_team: 'Birmingham City', away_team: 'Burnley FC',        competition: 'EFL Championship', venue: "St Andrew's",        kickoff_iso: '2026-03-22T15:00:00+00:00' },
  { opta_id: 'g2412458', home_team: 'Burnley FC',      away_team: 'Leicester City',    competition: 'EFL Championship', venue: 'Turf Moor',          kickoff_iso: '2026-03-29T13:30:00+00:00' },
  { opta_id: 'g2412513', home_team: 'Sheffield United', away_team: 'Burnley FC',       competition: 'EFL Championship', venue: 'Bramall Lane',       kickoff_iso: '2026-04-04T17:30:00+00:00' },
  { opta_id: 'g2412571', home_team: 'Burnley FC',      away_team: 'Leeds United',      competition: 'EFL Championship', venue: 'Turf Moor',          kickoff_iso: '2026-04-12T12:00:00+00:00' },
  { opta_id: 'g2412628', home_team: 'Sunderland',      away_team: 'Burnley FC',        competition: 'EFL Championship', venue: 'Stadium of Light',   kickoff_iso: '2026-04-18T15:00:00+00:00' },
  { opta_id: 'g2412684', home_team: 'Burnley FC',      away_team: 'Middlesbrough',     competition: 'EFL Championship', venue: 'Turf Moor',          kickoff_iso: '2026-04-26T15:00:00+00:00' },
  { opta_id: 'g2412741', home_team: 'Burnley FC',      away_team: 'West Brom',         competition: 'EFL Championship', venue: 'Turf Moor',          kickoff_iso: '2026-05-03T15:00:00+00:00' },
  { opta_id: 'g2412798', home_team: 'Norwich City',    away_team: 'Burnley FC',        competition: 'EFL Championship', venue: 'Carrow Road',        kickoff_iso: '2026-05-09T12:30:00+00:00' },
  { opta_id: 'g2412855', home_team: 'Burnley FC',      away_team: 'Coventry City',     competition: 'EFL Championship', venue: 'Turf Moor',          kickoff_iso: '2026-05-17T15:00:00+00:00' },
  { opta_id: 'fc2400988', home_team: 'Burnley FC',     away_team: 'Watford',           competition: 'FA Cup',           venue: 'Turf Moor',          kickoff_iso: '2026-03-25T19:45:00+00:00' },
  { opta_id: 'fc2401012', home_team: 'Burnley FC',     away_team: 'Bolton Wanderers',  competition: 'FA Cup',           venue: 'Turf Moor',          kickoff_iso: '2026-04-08T19:45:00+00:00' },
  { opta_id: 'lc2400677', home_team: 'Burnley FC',     away_team: 'Wigan Athletic',    competition: 'EFL Cup',          venue: 'Turf Moor',          kickoff_iso: '2026-03-19T19:45:00+00:00' },
  { opta_id: 'g2412912', home_team: 'Burnley FC',      away_team: 'Birmingham City',   competition: 'EFL Championship', venue: 'Turf Moor',          kickoff_iso: '2026-05-24T15:00:00+00:00' },
  { opta_id: 'g2412969', home_team: 'Leicester City',  away_team: 'Burnley FC',        competition: 'EFL Championship', venue: 'King Power Stadium', kickoff_iso: '2026-05-31T16:30:00+00:00' },
];

const VOD_CATALOGUE: VodAsset[] = [
  { id: 'vod_001', opta_id: 'g8898765', title: 'San Diego Wave vs OL Reign – Highlights',          type: 'highlights',           duration_seconds: 390,  published_at: '2026-01-25T23:00:00Z' },
  { id: 'vod_002', opta_id: 'g8898765', title: 'San Diego Wave vs OL Reign – Full Replay',          type: 'full_replay',          duration_seconds: 6315, published_at: '2026-01-26T02:00:00Z' },
  { id: 'vod_003', opta_id: 'g8898765', title: 'San Diego Wave vs OL Reign – Post-Match Press Conf', type: 'press_conference',     duration_seconds: 1125, published_at: '2026-01-25T22:15:00Z' },
  { id: 'vod_004', opta_id: 'g8812345', title: 'KC Current vs Portland Thorns – Highlights',        type: 'highlights',           duration_seconds: 345,  published_at: '2026-01-27T00:00:00Z' },
  { id: 'vod_005', opta_id: 'g8812345', title: 'KC Current vs Portland Thorns – Extended Highlights', type: 'extended_highlights', duration_seconds: 920,  published_at: '2026-01-27T01:30:00Z' },
  { id: 'vod_006', opta_id: 'g2412345', title: 'Burnley FC vs Blackburn Rovers – Highlights',       type: 'highlights',           duration_seconds: 370,  published_at: '2026-03-15T18:00:00Z' },
  { id: 'vod_007', opta_id: 'g2412345', title: 'Burnley FC vs Blackburn Rovers – Press Conference',  type: 'press_conference',     duration_seconds: 750,  published_at: '2026-03-15T18:30:00Z' },
  { id: 'vod_008', opta_id: 'g2412401', title: 'Birmingham City vs Burnley FC – Highlights',        type: 'highlights',           duration_seconds: 355,  published_at: '2026-03-22T18:00:00Z' },
  { id: 'vod_009', opta_id: 'fc2400988', title: 'Burnley FC vs Watford (FA Cup) – Highlights',      type: 'highlights',           duration_seconds: 440,  published_at: '2026-03-25T22:30:00Z' },
  { id: 'vod_010', opta_id: 'fc2400988', title: 'Burnley FC vs Watford (FA Cup) – Full Replay',     type: 'full_replay',          duration_seconds: 5560, published_at: '2026-03-26T01:00:00Z' },
];

const formatDuration = (s: number): string => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
};

const findVodSuggestions = (opta_id: string): VodLink[] =>
  VOD_CATALOGUE
    .filter(v => v.opta_id === opta_id)
    .map(v => ({ asset_id: v.id, asset_title: v.title, asset_type: v.type, duration_seconds: v.duration_seconds, published_at: v.published_at, confirmed: false }));

const VOD_TYPE_LABELS: Record<VodAssetType, string> = {
  highlights: 'Highlights', full_replay: 'Full Replay',
  extended_highlights: 'Extended', press_conference: 'Press Conf',
};
const VOD_TYPE_COLORS: Record<VodAssetType, string> = {
  highlights: 'bg-amber-100 text-amber-800',  full_replay: 'bg-blue-100 text-blue-800',
  extended_highlights: 'bg-violet-100 text-violet-800', press_conference: 'bg-slate-100 text-slate-700',
};

const VIP_ROSTER_CAP = 50;
const VIP_ROSTER_SOFT_WARN = 40;

const VIP_LEAD_TIME_PRESETS: { label: string; minutes: number }[] = [
  { label: '7 days before',        minutes: 60 * 24 * 7 },
  { label: '24 hours before',      minutes: 60 * 24 },
  { label: '2 hours before',       minutes: 60 * 2 },
  { label: 'At channel start (T-90)', minutes: 90 },
];

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
  opta_id: string;
  external_id: string;
  image_16x9: { name: string; url: string } | null;
  image_9x16: { name: string; url: string } | null;
  currentViewers: number;
  peakViewers: number;
  streams: StreamRow[];
  vip_delivery: VipDelivery;
  source_match?: SourceMatch;
  rights?: StreamRights;
  apiUrl: string;
  isDraft: boolean;
  deletedAt?: string;
  event_type?: 'live' | 'previous';
  vod_items?: VodLink[];
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
const SOCIAL_SPEC  = { description: 'Syndicate live stream to social media or clipping services', specs: ['H.264 AVC', '1920×1080 @ 8Mbps', 'AAC-LC 128kbps'], note: 'URL uses system default if left blank (event-only override, not saved to tenant DB)' };

const SOCIAL_PLATFORMS = [
  { id: 'facebook',  name: 'Facebook Live',  category: 'Social Media' },
  { id: 'youtube',   name: 'YouTube Live',   category: 'Social Media' },
  { id: 'twitter',   name: 'X (Twitter)',    category: 'Social Media' },
  { id: 'instagram', name: 'Instagram Live', category: 'Social Media' },
  { id: 'twitch',    name: 'Twitch',         category: 'Social Media' },
  { id: 'tiktok',    name: 'TikTok Live',    category: 'Social Media' },
  { id: 'wsc',       name: 'WSC Sports',     category: 'Clipping Service' },
  { id: 'grabyo',    name: 'Grabyo',         category: 'Clipping Service' },
];

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

// formatTime kept for potential reuse
const _formatTime = (t: string): string => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
};
void _formatTime;

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

let rowCounter = 100;
const createStreamRow = (overrides: Partial<StreamRow> = {}): StreamRow => ({
  id: `sr-${++rowCounter}`,
  title: `Stream ${rowCounter - 100}`,
  icon: 'video',
  thumbnail: null,
  broadcast_id: '',
  stream_template_id: '',
  live2vod: false,
  syndicate_social: false,
  social_targets: [],
  rights: { geo_profile: '', geo_countries: [], subscription_plans: [], segment_ids: [], combine_mode: 'AND' },
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
    opta_id: 'g8812345', external_id: '', image_16x9: null, image_9x16: null, currentViewers: 12453, peakViewers: 15782,
    streams: [
      { id: 'sr-001a', title: 'Main Broadcast', icon: 'video', thumbnail: null, broadcast_id: 'BC-001', stream_template_id: 'stream_video_1080', live2vod: true, syndicate_social: true, social_targets: [{ platform_id: 'youtube', url: '', key: 'yt-kc-current-2026' }, { platform_id: 'facebook', url: '', key: 'fb-kc-current-2026' }], rights: { geo_profile: 'Domestic Only', geo_countries: [], subscription_plans: ['plan_season', 'plan_premium'], segment_ids: [], combine_mode: 'AND' }, expanded: false },
      { id: 'sr-001b', title: 'Audio Commentary', icon: 'radio', thumbnail: null, broadcast_id: 'BC-002', stream_template_id: 'stream_audio_only', live2vod: false, syndicate_social: false, social_targets: [], rights: { geo_profile: 'Worldwide (No Restrictions)', geo_countries: [], subscription_plans: ['plan_free'], segment_ids: [], combine_mode: 'AND' }, expanded: false },
    ],
    vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_001', isDraft: false,
  },
  {
    id: 'evt_002', title: 'Season Launch Press Conference',
    description: 'Join us for the official 2026 season announcement with special guests',
    status: 'upcoming', channelState: 'idle', includeMatchDetails: false,
    homeTeam: '', awayTeam: '', competition: '', venue: '',
    event_start_time: '2026-01-28T13:45:00', kickoff_time: '2026-01-28T14:00:00', event_end_time: '2026-01-28T15:30:00',
    opta_id: '', external_id: 'PRESS-2026-001', image_16x9: null, image_9x16: null, currentViewers: 0, peakViewers: 0,
    streams: [
      { id: 'sr-002a', title: 'Main Feed', icon: 'video', thumbnail: null, broadcast_id: 'BC-003', stream_template_id: 'stream_video_1080', live2vod: true, syndicate_social: false, social_targets: [], rights: { geo_profile: 'Worldwide (No Restrictions)', geo_countries: [], subscription_plans: ['plan_free'], segment_ids: [], combine_mode: 'AND' }, expanded: false },
    ],
    vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_002', isDraft: false,
  },
  {
    id: 'evt_003', title: 'Orlando Pride vs Washington Spirit',
    description: '', status: 'draft', channelState: 'idle', includeMatchDetails: true,
    homeTeam: 'Orlando Pride', awayTeam: 'Washington Spirit', competition: 'NWSL Regular Season', venue: '',
    event_start_time: '2026-01-27T17:00:00', kickoff_time: '2026-01-27T17:30:00', event_end_time: '',
    opta_id: '', external_id: '', image_16x9: null, image_9x16: null, currentViewers: 0, peakViewers: 0,
    streams: [], vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_003', isDraft: true,
  },
  {
    id: 'evt_004', title: 'Player Q&A Session',
    description: 'Interactive session with star players answering fan questions',
    status: 'ended', channelState: 'idle', includeMatchDetails: false,
    homeTeam: '', awayTeam: '', competition: '', venue: '',
    event_start_time: '2026-01-25T15:45:00', kickoff_time: '2026-01-25T16:00:00', event_end_time: '2026-01-25T17:00:00',
    opta_id: '', external_id: '', image_16x9: null, image_9x16: null, currentViewers: 0, peakViewers: 8432,
    streams: [
      { id: 'sr-004a', title: 'Q&A Stream', icon: 'video', thumbnail: null, broadcast_id: 'BC-001', stream_template_id: 'stream_video_1080', live2vod: true, syndicate_social: false, social_targets: [], rights: { geo_profile: 'Worldwide (No Restrictions)', geo_countries: [], subscription_plans: ['plan_monthly', 'plan_annual'], segment_ids: ['seg_junior_members', 'seg_family_pass'], combine_mode: 'OR' }, expanded: false },
    ],
    vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_004', isDraft: false, event_type: 'previous',
  },
  {
    id: 'evt_005', title: 'San Diego Wave vs OL Reign',
    description: 'Western Conference battle for playoff positioning',
    status: 'ended', channelState: 'idle', includeMatchDetails: true,
    homeTeam: 'San Diego Wave', awayTeam: 'OL Reign', competition: 'NWSL Regular Season', venue: 'Snapdragon Stadium',
    event_start_time: '2026-01-24T19:30:00', kickoff_time: '2026-01-24T20:00:00', event_end_time: '2026-01-24T22:00:00',
    opta_id: 'g8898765', external_id: '', image_16x9: null, image_9x16: null, currentViewers: 0, peakViewers: 18942,
    streams: [
      { id: 'sr-005a', title: 'HD Broadcast', icon: 'video', thumbnail: null, broadcast_id: 'BC-001', stream_template_id: 'stream_video_1080', live2vod: true, syndicate_social: true, social_targets: [{ platform_id: 'twitter', url: '', key: 'x-sdw-2026' }], rights: { geo_profile: 'North America Only', geo_countries: [], subscription_plans: ['plan_season', 'plan_premium'], segment_ids: [], combine_mode: 'AND' }, expanded: false },
      { id: 'sr-005b', title: 'Radio Feed',   icon: 'radio', thumbnail: null, broadcast_id: 'BC-002', stream_template_id: 'stream_audio_only', live2vod: false, syndicate_social: false, social_targets: [], rights: { geo_profile: 'Worldwide (No Restrictions)', geo_countries: [], subscription_plans: ['plan_free'], segment_ids: [], combine_mode: 'AND' }, expanded: false },
    ],
    vip_delivery: { enabled: false }, apiUrl: 'https://api.example.com/v1/events/evt_005', isDraft: false, event_type: 'previous',
    vod_items: [
      { asset_id: 'vod_001', asset_title: 'San Diego Wave vs OL Reign – Highlights',           asset_type: 'highlights',       duration_seconds: 390,  published_at: '2026-01-25T23:00:00Z', confirmed: true },
      { asset_id: 'vod_002', asset_title: 'San Diego Wave vs OL Reign – Full Replay',           asset_type: 'full_replay',      duration_seconds: 6315, published_at: '2026-01-26T02:00:00Z', confirmed: true },
      { asset_id: 'vod_003', asset_title: 'San Diego Wave vs OL Reign – Post-Match Press Conf', asset_type: 'press_conference', duration_seconds: 1125, published_at: '2026-01-25T22:15:00Z', confirmed: true },
    ],
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

// ─── AUDIT LOG CONSTANTS ─────────────────────────────────────────────────────

const ACTION_LABELS: Record<AuditAction, string> = {
  member_added:    'Member added',
  member_revoked:  'Member revoked',
  member_restored: 'Member restored',
  email_sent:      'Email sent',
  email_resent:    'Email resent',
  email_delivered: 'Delivered',
  email_opened:    'Email opened',
  email_bounced:   'Bounced',
  link_opened:     'Link opened',
  stream_viewed:   'Stream viewed',
  settings_updated:'Settings updated',
  vip_toggled_on:  'VIP enabled',
  vip_toggled_off: 'VIP disabled',
  url_generated:   'URL generated',
};

const ACTION_BADGE_COLORS: Record<AuditAction, string> = {
  member_added:    'bg-emerald-100 text-emerald-800',
  member_revoked:  'bg-red-100 text-red-800',
  member_restored: 'bg-emerald-100 text-emerald-800',
  email_sent:      'bg-blue-100 text-blue-800',
  email_resent:    'bg-blue-100 text-blue-800',
  email_delivered: 'bg-sky-100 text-sky-800',
  email_opened:    'bg-violet-100 text-violet-800',
  email_bounced:   'bg-red-100 text-red-800',
  link_opened:     'bg-amber-100 text-amber-800',
  stream_viewed:   'bg-green-100 text-green-800',
  settings_updated:'bg-slate-100 text-slate-700',
  vip_toggled_on:  'bg-amber-100 text-amber-800',
  vip_toggled_off: 'bg-slate-100 text-slate-700',
  url_generated:   'bg-violet-100 text-violet-800',
};

const AUDIT_CATEGORY_MAP: Record<string, AuditAction[]> = {
  roster: ['member_added', 'member_revoked', 'member_restored'],
  email:  ['email_sent', 'email_resent', 'email_delivered', 'email_opened', 'email_bounced'],
  access: ['link_opened', 'stream_viewed'],
  config: ['settings_updated', 'vip_toggled_on', 'vip_toggled_off'],
  url:    ['url_generated'],
};

function actorLabel(actor: string): string {
  if (actor === 'system') return 'System';
  if (actor === 'media.manager@burnleyfc.com') return 'Media Manager';
  return actor;
}

const MOCK_AUDIT_LOG: AuditLogEntry[] = (() => {
  const entries: AuditLogEntry[] = [];
  let n = 0;
  const nid = () => `audit_${String(++n).padStart(4, '0')}`;
  const addMs = (iso: string, ms: number) => new Date(new Date(iso).getTime() + ms).toISOString();

  const members = [
    { email: 'chairman@burnleyfc.com',  name: 'Alan Pace' },
    { email: 'ceo@burnleyfc.com',       name: 'Neil Hart' },
    { email: 'directors@burnleyfc.com', name: 'Board Distribution' },
    { email: 'partners.exec@efl.com',   name: 'EFL Partner Comp' },
    { email: 'sponsor.lead@vbet.com',   name: 'vbet – Lead Sponsor' },
    { email: 'legacy@burnleyfc.com',    name: 'Legacy (deprecated)' },
  ];

  const pastEvents = [
    { title: 'Burnley FC vs Bristol City',              date: '2025-08-09T15:00:00Z' },
    { title: 'Watford vs Burnley FC',                   date: '2025-08-16T15:00:00Z' },
    { title: 'Burnley FC vs Hull City',                 date: '2025-08-23T15:00:00Z' },
    { title: 'Burnley FC vs Oxford United',             date: '2025-09-13T15:00:00Z' },
    { title: 'Plymouth Argyle vs Burnley FC',           date: '2025-09-27T15:00:00Z' },
    { title: 'Burnley FC vs Swansea City',              date: '2025-10-18T15:00:00Z' },
    { title: 'QPR vs Burnley FC',                       date: '2025-11-01T15:00:00Z' },
    { title: 'Burnley FC vs Derby County',              date: '2025-11-22T15:00:00Z' },
    { title: 'Burnley FC vs Preston North End',         date: '2025-12-06T15:00:00Z' },
    { title: 'Cardiff City vs Burnley FC',              date: '2025-12-20T15:00:00Z' },
    { title: 'Burnley FC vs Portsmouth',                date: '2026-01-10T15:00:00Z' },
    { title: 'Stoke City vs Burnley FC',                date: '2026-01-25T15:00:00Z' },
    { title: 'Burnley FC vs Millwall',                  date: '2026-02-08T15:00:00Z' },
    { title: 'Luton Town vs Burnley FC',                date: '2026-02-21T15:00:00Z' },
    { title: 'Burnley FC vs Blackburn Rovers (FA Cup)', date: '2026-03-08T14:00:00Z' },
  ];

  const SYS = 'system';
  const MGR = 'media.manager@burnleyfc.com';
  const REVOKED_TS = new Date('2025-09-30T17:00:00Z').getTime();

  // Roster additions
  members.forEach((m, mi) => {
    entries.push({ id: nid(), timestamp: addMs('2025-08-10T09:12:00Z', mi * 18000), actor: MGR, action: 'member_added', member_email: m.email, member_name: m.name });
  });

  // Legacy member revoked
  entries.push({ id: nid(), timestamp: '2025-09-30T17:00:00Z', actor: MGR, action: 'member_revoked', member_email: 'legacy@burnleyfc.com', member_name: 'Legacy (deprecated)', detail: 'No longer active' });

  // Occasional settings updates
  entries.push({ id: nid(), timestamp: '2025-08-10T10:00:00Z', actor: MGR, action: 'settings_updated', detail: 'Lead time set to 1440 min' });
  entries.push({ id: nid(), timestamp: '2025-09-05T14:30:00Z', actor: MGR, action: 'settings_updated', detail: 'Email branding: primary colour updated' });
  entries.push({ id: nid(), timestamp: '2025-11-12T11:00:00Z', actor: MGR, action: 'settings_updated', detail: 'DMARC policy set to quarantine' });

  pastEvents.forEach((evt, ei) => {
    const evtTime = new Date(evt.date).getTime();

    // VIP toggled on 24h before
    entries.push({ id: nid(), timestamp: addMs(evt.date, -24 * 3600000), actor: MGR, action: 'vip_toggled_on', event_title: evt.title });

    // URL batch generated 12h before
    entries.push({ id: nid(), timestamp: addMs(evt.date, -12 * 3600000), actor: MGR, action: 'url_generated', event_title: evt.title, detail: 'Batch URLs generated for active roster' });

    members.forEach((m, mi) => {
      // Legacy member was revoked 2025-09-30; skip for events after that date
      if (mi === 5 && evtTime > REVOKED_TS) return;

      const emailSentAt = addMs(evt.date, -24 * 3600000 + mi * 120000);
      const openOffset  = (mi * 3600000 + ei * 900000) % (8 * 3600000);
      const emailOpenAt = addMs(evt.date, -(60 * 60000) - openOffset);

      // email_sent + email_delivered
      entries.push({ id: nid(), timestamp: emailSentAt, actor: SYS, action: 'email_sent', member_email: m.email, member_name: m.name, event_title: evt.title });
      entries.push({ id: nid(), timestamp: addMs(emailSentAt, (mi + 2) * 60000), actor: SYS, action: 'email_delivered', member_email: m.email, member_name: m.name, event_title: evt.title });

      // Rare bounce: member 2 (directors) on event 7
      if (mi === 2 && ei === 7) {
        entries.push({ id: nid(), timestamp: addMs(emailSentAt, 300000), actor: SYS, action: 'email_bounced', member_email: m.email, member_name: m.name, event_title: evt.title, detail: 'Soft bounce: mailbox full' });
        entries.push({ id: nid(), timestamp: addMs(emailSentAt, 7200000), actor: MGR, action: 'email_resent', member_email: m.email, member_name: m.name, event_title: evt.title });
        return;
      }
      // Manual resend: member 1 (CEO) on event 3
      if (mi === 1 && ei === 3) {
        entries.push({ id: nid(), timestamp: addMs(evt.date, -18 * 3600000), actor: MGR, action: 'email_resent', member_email: m.email, member_name: m.name, event_title: evt.title });
      }

      // email_opened (~80% open rate)
      const skipOpen = (mi === 4 && ei % 2 === 0) || (mi === 3 && ei % 5 === 0);
      if (!skipOpen) {
        entries.push({ id: nid(), timestamp: emailOpenAt, actor: SYS, action: 'email_opened', member_email: m.email, member_name: m.name, event_title: evt.title });
      }

      // link_opened (~90% of openers)
      const skipLink = mi === 4 && ei % 3 === 0;
      if (!skipOpen && !skipLink) {
        const linkOffset = (mi * 600000 + ei * 300000) % (30 * 60000);
        entries.push({ id: nid(), timestamp: addMs(evt.date, -(30 * 60000) - linkOffset), actor: SYS, action: 'link_opened', member_email: m.email, member_name: m.name, event_title: evt.title });
      }

      // stream_viewed (~85% of openers)
      const skipView = (mi === 4 && ei % 3 === 0) || (mi === 0 && ei % 7 === 0);
      if (!skipOpen && !skipView) {
        const viewOffset = (mi * 480000 + ei * 240000) % (10 * 60000);
        entries.push({ id: nid(), timestamp: addMs(evt.date, 5 * 60000 + viewOffset), actor: SYS, action: 'stream_viewed', member_email: m.email, member_name: m.name, event_title: evt.title });
      }
    });

    // VIP toggled off 4h after kickoff
    entries.push({ id: nid(), timestamp: addMs(evt.date, 4 * 3600000), actor: MGR, action: 'vip_toggled_off', event_title: evt.title });
  });

  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
})();

const VIP_VIEW_COUNTS: Record<string, { count: number; lastEvent: string; lastViewed: string }> = (() => {
  const map: Record<string, { count: number; lastEvent: string; lastViewed: string }> = {};
  for (const e of MOCK_AUDIT_LOG) {
    if (e.action !== 'stream_viewed' || !e.member_email) continue;
    const cur = map[e.member_email];
    if (!cur) {
      map[e.member_email] = { count: 1, lastEvent: e.event_title ?? '', lastViewed: e.timestamp };
    } else {
      cur.count++;
    }
  }
  return map;
})();

// ─── UTILITY FUNCTIONS ───────────────────────────────────────────────────────

function _formatLeadTime(minutes: number): string {
  const preset = VIP_LEAD_TIME_PRESETS.find(p => p.minutes === minutes);
  if (preset) return preset.label;
  if (minutes >= 1440) return `${Math.round(minutes / 1440)} day${minutes >= 2880 ? 's' : ''} before`;
  if (minutes >= 60)   return `${Math.round(minutes / 60)} hours before`;
  return `${minutes} min before`;
}
void _formatLeadTime;

function computeScheduledSend(kickoffIso: string, leadMinutes: number): string {
  if (!kickoffIso) return '';
  const ko = new Date(kickoffIso);
  ko.setMinutes(ko.getMinutes() - leadMinutes);
  return ko.toISOString();
}

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
  const inputId = `img-${label.replace(/\s/g, '-')}-${Math.random().toString(36).slice(2, 6)}`;
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


function StreamRowCard({ row, index, onUpdate, onRemove, allStreams, vipEnabled, onVipEnabledChange, vipRosterCount }: {
  row: StreamRow; index: number; onUpdate: (r: StreamRow) => void; onRemove: () => void;
  allStreams: StreamRow[]; vipEnabled: boolean; onVipEnabledChange: (enabled: boolean) => void; vipRosterCount: number;
}) {
  const broadcast = CLIENT_BROADCASTS.find(b => b.broadcast_id === row.broadcast_id);
  const template  = STREAM_TEMPLATES.find(t => t.template_id === row.stream_template_id);
  const isConfigured = !!row.broadcast_id && !!row.stream_template_id;
  const hasRights = !!row.rights.geo_profile || row.rights.geo_countries.length > 0 || row.rights.subscription_plans.length > 0 || row.rights.segment_ids.length > 0;

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
            {hasRights && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 flex-shrink-0">Rights set</span>}
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

            {isFirstVideoForBroadcast && (
              <div className="mt-3">
                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:border-blue-300 transition-colors">
                  <input type="checkbox" checked={row.syndicate_social}
                    onChange={e => { const checked = e.target.checked; onUpdate({ ...row, syndicate_social: checked, social_targets: checked ? row.social_targets : [] }); }}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200" />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5"><Share2 size={12} className="text-blue-600" />Syndicate to Social</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">{SOCIAL_SPEC.description} – {SOCIAL_SPEC.specs[1]}, {SOCIAL_SPEC.specs[2]}</p>
                  </div>
                </label>

                {row.syndicate_social && (
                  <div className="mt-2 p-3 rounded-lg border border-blue-200 bg-blue-50/50 space-y-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Add Platform</label>
                      <select value="" onChange={e => { const pid = e.target.value; if (pid && !row.social_targets.find(t => t.platform_id === pid)) { onUpdate({ ...row, social_targets: [...row.social_targets, { platform_id: pid, url: '', key: '' }] }); } }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none text-sm">
                        <option value="">Select a platform...</option>
                        <optgroup label="Social Media">
                          {SOCIAL_PLATFORMS.filter(p => p.category === 'Social Media').map(p => (
                            <option key={p.id} value={p.id} disabled={!!row.social_targets.find(t => t.platform_id === p.id)}>{p.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Clipping Services">
                          {SOCIAL_PLATFORMS.filter(p => p.category === 'Clipping Service').map(p => (
                            <option key={p.id} value={p.id} disabled={!!row.social_targets.find(t => t.platform_id === p.id)}>{p.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    {row.social_targets.map((target, ti) => {
                      const plat = SOCIAL_PLATFORMS.find(p => p.id === target.platform_id);
                      return (
                        <div key={target.platform_id} className="bg-white rounded-lg border border-slate-200 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                              <Share2 size={11} className="text-blue-600" />{plat?.name || target.platform_id}
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{plat?.category}</span>
                            </span>
                            <button onClick={() => onUpdate({ ...row, social_targets: row.social_targets.filter((_, i) => i !== ti) })} className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"><X size={12} /></button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-medium text-slate-500 mb-0.5 flex items-center gap-1"><Link size={9} />URL <span className="text-slate-400">(optional)</span></label>
                              <input type="text" value={target.url}
                                onChange={e => { const updated = [...row.social_targets]; updated[ti] = { ...updated[ti], url: e.target.value }; onUpdate({ ...row, social_targets: updated }); }}
                                placeholder="Uses system default if blank"
                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-slate-500 mb-0.5 flex items-center gap-1"><Key size={9} />Stream Key <span className="text-red-500">*</span></label>
                              <input type="text" value={target.key}
                                onChange={e => { const updated = [...row.social_targets]; updated[ti] = { ...updated[ti], key: e.target.value }; onUpdate({ ...row, social_targets: updated }); }}
                                placeholder="Required"
                                className={`w-full px-2.5 py-1.5 border rounded-lg text-xs focus:ring-1 focus:outline-none ${target.key ? 'border-slate-300 focus:border-blue-500 focus:ring-blue-200' : 'border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50'}`} />
                              {!target.key && <p className="text-[9px] text-red-500 mt-0.5">Key is required</p>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {row.social_targets.length === 0 && <p className="text-[10px] text-slate-500 text-center py-2">Select a platform above to configure syndication</p>}
                  </div>
                )}
              </div>
            )}

            {isFirstVideoOverall && (
              <label className="flex items-start gap-2.5 mt-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:border-amber-300 transition-colors">
                <input type="checkbox" checked={vipEnabled} onChange={e => onVipEnabledChange(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-200" />
                <div>
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5"><Crown size={12} className="text-amber-600" />Enable VIP delivery</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Mirror all video streams to the {vipRosterCount}-member VIP roster with geo, subscription, and audience-segment restrictions all bypassed. Delivery details configured in <strong>VIP Members</strong>.
                  </p>
                </div>
              </label>
            )}
          </div>
        </div>
      </div>

      {isConfigured && (
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
      )}
    </div>
  );
}


// ─── OPTA LOOKUP FIELD ───────────────────────────────────────────────────────

type LookupMode  = 'id' | 'search';
type LookupState = 'idle' | 'searching' | 'matched' | 'not_found';

function lookupFixture(idOrSearch: string, mode: LookupMode): CatalogFixture | null {
  const q = idOrSearch.trim().toLowerCase();
  if (!q) return null;
  if (mode === 'id') return FIXTURE_CATALOG.find(f => f.opta_id.toLowerCase() === q) || null;
  return FIXTURE_CATALOG.find(f =>
    f.home_team.toLowerCase().includes(q) || f.away_team.toLowerCase().includes(q) || f.competition.toLowerCase().includes(q)
  ) || null;
}

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
  opta_id: string; external_id: string; image_16x9: { name: string; url: string } | null; image_9x16: { name: string; url: string } | null;
  home_team: string; away_team: string; competition: string; venue: string;
  rights: StreamRights;
}

const EMPTY_RIGHTS: StreamRights = { geo_profile: '', geo_countries: [], subscription_plans: [], segment_ids: [], combine_mode: 'OR' };

function CreateEventPage({ onBack, onSave, tenantId, rosterCount, onCreatePrevious }: {
  onBack: () => void; onSave: (e: LiveEvent) => void; tenantId: string; rosterCount: number; onCreatePrevious: () => void;
}) {
  const [showTypeSelector, setShowTypeSelector] = useState(true);
  const [form, setForm] = useState<CreateEventForm>({
    event_name: '', description: '', event_date: '', event_start_time: '', kickoff_time: '', event_end_time: '',
    opta_id: '', external_id: '', image_16x9: null, image_9x16: null,
    home_team: '', away_team: '', competition: '', venue: '',
    rights: { ...EMPTY_RIGHTS },
  });
  const [includeMatchDetails, setIncludeMatchDetails] = useState(false);
  const [streams, setStreams]       = useState<StreamRow[]>([]);
  const [vipEnabled, setVipEnabled] = useState(false);
  const [sourceMatch, setSourceMatch] = useState<SourceMatch | null>(null);
  const [rightsOpen, setRightsOpen] = useState(false);

  const updateForm = (u: Partial<CreateEventForm>) => setForm(p => ({ ...p, ...u }));
  const handleImageUpload = (key: 'image_16x9' | 'image_9x16') => (e: React.ChangeEvent<HTMLInputElement>) => {
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
      id, title: form.event_name, description: form.description, rights: form.rights, status: 'upcoming', channelState: 'idle',
      includeMatchDetails,
      homeTeam:    includeMatchDetails ? form.home_team   : '',
      awayTeam:    includeMatchDetails ? form.away_team   : '',
      competition: includeMatchDetails ? form.competition : '',
      venue:       includeMatchDetails ? form.venue       : '',
      event_start_time: `${form.event_date}T${form.event_start_time}:00`,
      kickoff_time:     `${form.event_date}T${form.kickoff_time}:00`,
      event_end_time:   form.event_end_time ? `${form.event_date}T${form.event_end_time}:00` : '',
      opta_id: form.opta_id, external_id: form.external_id,
      image_16x9: form.image_16x9, image_9x16: form.image_9x16,
      currentViewers: 0, peakViewers: 0,
      streams: configuredStreams,
      vip_delivery: {
        enabled: vipEnabled,
        hosted_page_url:     vipEnabled ? `https://vip.yinzcam.com/${tenantId}/${id}` : undefined,
        distribution_status: vipEnabled ? 'pending' : undefined,
      },
      source_match: sourceMatch || undefined,
      apiUrl: `https://api.example.com/v1/events/${id}`,
      isDraft: false,
    });
  };

  if (showTypeSelector) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-slate-200 px-6 py-5">
          <div className="max-w-xl mx-auto flex items-center gap-3">
            <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-900 font-medium">← Back</button>
            <div className="h-5 w-px bg-slate-200" />
            <div><h1 className="text-xl font-bold text-slate-900">Create Live Event</h1><p className="text-sm text-slate-500 mt-0.5">Set up a new live broadcast for your OTT platform</p></div>
          </div>
        </div>
        <div className="max-w-xl mx-auto px-6 py-10">
          <button onClick={() => setShowTypeSelector(false)} className="group w-full bg-white rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:shadow-lg transition-all p-8 text-left">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 transition-colors">
                <Video size={32} className="text-emerald-600 group-hover:text-white transition-colors" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Live Event</h3>
                <p className="text-sm text-slate-600">Match day fixture, press conference, training session, or any live broadcast – with optional team, competition, and fixture data integration</p>
              </div>
            </div>
          </button>
          <button onClick={onCreatePrevious} className="group w-full bg-white rounded-xl border-2 border-slate-200 hover:border-violet-500 hover:shadow-lg transition-all p-8 text-left mt-4">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-violet-600 transition-colors">
                <Archive size={32} className="text-violet-600 group-hover:text-white transition-colors" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Previous Match</h3>
                <p className="text-sm text-slate-600">Link historic match footage and VOD content – highlights, full replays, press conferences – identified by Opta ID</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowTypeSelector(true)} className="text-sm text-slate-500 hover:text-slate-900 font-medium">← Back</button>
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
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Data Integration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <OptaLookupField optaId={form.opta_id} onOptaIdChange={id => updateForm({ opta_id: id })}
                    onMatchApplied={f => {
                      const ko = new Date(f.kickoff_iso);
                      updateForm({ opta_id: f.opta_id, home_team: f.home_team, away_team: f.away_team, competition: f.competition, venue: f.venue,
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
              <div className="grid grid-cols-2 gap-5">
                <ImageUploadZone label="Landscape" aspectLabel="16:9 – 1920×1080" image={form.image_16x9} onUpload={handleImageUpload('image_16x9')} onRemove={() => updateForm({ image_16x9: null })} aspectClass="aspect-video" />
                <ImageUploadZone label="Portrait"  aspectLabel="9:16 – 1080×1920" image={form.image_9x16} onUpload={handleImageUpload('image_9x16')} onRemove={() => updateForm({ image_9x16: null })} aspectClass="aspect-[9/16] max-h-44" />
              </div>
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

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button type="button" onClick={() => setRightsOpen(o => !o)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Rights &amp; Restrictions</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Event-wide access controls — applied across all streams. Stream-level rules stack on top.</p>
                </div>
                <ChevronDown size={16} className={`text-slate-400 flex-shrink-0 ml-4 transition-transform duration-150 ${rightsOpen ? 'rotate-180' : ''}`} />
              </button>
              {rightsOpen && <RightsPanel rights={form.rights} onChange={r => updateForm({ rights: r })} />}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 sticky top-20">
              <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2"><Eye size={15} />Preview</h3>
              <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden relative mb-3">
                {form.image_16x9 ? <img src={form.image_16x9.url} alt="Preview" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Image size={32} className="text-slate-300" /></div>}
                <div className="absolute top-2 left-2"><span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded flex items-center gap-1"><Radio size={8} />LIVE</span></div>
              </div>
              <p className="font-semibold text-slate-900 text-sm mb-0.5">{form.event_name || 'Event name'}</p>
              {form.description && <p className="text-xs text-slate-500 mb-0.5">{form.description}</p>}
              {includeMatchDetails && form.home_team && form.away_team && <p className="text-xs text-slate-600">{form.home_team} v {form.away_team}</p>}
              {form.event_date && form.kickoff_time && (
                <p className="text-[10px] text-slate-500 mt-1.5">
                  {new Date(`${form.event_date}T${form.kickoff_time}`).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                </p>
              )}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
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
    opta_id: event.opta_id || '', external_id: event.external_id || '',
    image_16x9: event.image_16x9, image_9x16: event.image_9x16,
  });
  const [streams, setStreams] = useState<StreamRow[]>(event.streams || []);
  const [eventRights, setEventRights] = useState<StreamRights>(event.rights || { ...EMPTY_RIGHTS });
  const [rightsOpen, setRightsOpen] = useState(false);
  const [vipEnabled, setVipEnabled] = useState<boolean>(event.vip_delivery?.enabled ?? false);
  const [sourceMatch, setSourceMatch] = useState<SourceMatch | null>(event.source_match || null);
  const [pendingResync, setPendingResync] = useState<{ fixture: CatalogFixture; deltas: { field: string; from: string; to: string; apply: () => void }[] } | null>(null);
  const [resyncToast, setResyncToast] = useState<string | null>(null);
  const [vodItems, setVodItems] = useState<VodLink[]>(event.vod_items || []);
  const [vodSearch, setVodSearch] = useState('');
  const [vodSearchOpen, setVodSearchOpen] = useState(false);

  const isPreviousMatch = event.event_type === 'previous';

  const addStream    = () => setStreams(p => [...p, createStreamRow({ title: `Stream ${p.length + 1}` })]);
  const removeStream = (id: string) => setStreams(p => p.filter(s => s.id !== id));
  const updateStream = (id: string, row: StreamRow) => setStreams(p => p.map(s => s.id === id ? row : s));
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleSave = () => {
    const nextVip: VipDelivery = vipEnabled
      ? { enabled: true, hosted_page_url: event.vip_delivery?.hosted_page_url || `https://vip.yinzcam.com/${tenantId}/${event.id}`, distribution_status: event.vip_delivery?.distribution_status || 'pending', last_email_sent_at: event.vip_delivery?.last_email_sent_at }
      : { enabled: false };
    onSave({ ...event, ...form, streams, rights: eventRights, vip_delivery: nextVip, source_match: sourceMatch ? { ...sourceMatch, extraction_review_required: false } : undefined, vod_items: isPreviousMatch ? vodItems : event.vod_items });
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
            <h1 className="text-lg font-bold text-slate-900">{isPreviousMatch ? 'Edit Previous Match' : 'Edit Live Event'}</h1>
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

        {sourceMatch?.extraction_review_required && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">Extracted from {sourceMatch.extraction_source_filename || 'uploaded document'}</p>
              <p className="text-xs text-amber-800 mt-0.5">Review and confirm the fields below before saving.</p>
            </div>
            <button onClick={() => setSourceMatch(prev => prev ? { ...prev, extraction_review_required: false } : prev)}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-xs font-medium flex-shrink-0 flex items-center gap-1.5"><Check size={12} /> Confirm extraction</button>
          </div>
        )}

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
                  setForm({ ...form, opta_id: f.opta_id, homeTeam: f.home_team, awayTeam: f.away_team, competition: f.competition, venue: f.venue, kickoff_time: f.kickoff_iso, includeMatchDetails: true });
                  setSourceMatch({ provider: initialStatsFeedSettings.provider, source_id: f.opta_id, pulled_at: new Date().toISOString(), raw_snapshot: { home_team: f.home_team, away_team: f.away_team, competition: f.competition, venue: f.venue, kickoff_iso: f.kickoff_iso } });
                }}
                enableResync={!!sourceMatch && sourceMatch.provider !== 'manual' && sourceMatch.provider !== 'document_extraction'}
                lastPulledAt={sourceMatch?.pulled_at}
                onResyncCompared={f => {
                  const deltas: { field: string; from: string; to: string; apply: () => void }[] = [];
                  if (f.home_team  !== form.homeTeam)    deltas.push({ field: 'Home team',   from: form.homeTeam || '—',    to: f.home_team,   apply: () => setForm(p => ({ ...p, homeTeam: f.home_team })) });
                  if (f.away_team  !== form.awayTeam)    deltas.push({ field: 'Away team',   from: form.awayTeam || '—',    to: f.away_team,   apply: () => setForm(p => ({ ...p, awayTeam: f.away_team })) });
                  if (f.competition !== form.competition) deltas.push({ field: 'Competition', from: form.competition || '—', to: f.competition, apply: () => setForm(p => ({ ...p, competition: f.competition })) });
                  if (f.venue       !== form.venue)       deltas.push({ field: 'Venue',       from: form.venue || '—',       to: f.venue,       apply: () => setForm(p => ({ ...p, venue: f.venue })) });
                  if (f.kickoff_iso !== form.kickoff_time) {
                    const fromLabel = form.kickoff_time ? new Date(form.kickoff_time).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
                    const toLabel   = new Date(f.kickoff_iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                    deltas.push({ field: 'Kick-off', from: fromLabel, to: toLabel, apply: () => setForm(p => ({ ...p, kickoff_time: f.kickoff_iso })) });
                  }
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

        {!isPreviousMatch && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button type="button" onClick={() => setRightsOpen(o => !o)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left">
              <div>
                <h2 className="text-base font-bold text-slate-900">Rights &amp; Restrictions</h2>
                <p className="text-xs text-slate-500 mt-0.5">Event-wide access controls — applied across all streams. Stream-level rules stack on top.</p>
              </div>
              <ChevronDown size={16} className={`text-slate-400 flex-shrink-0 ml-4 transition-transform duration-150 ${rightsOpen ? 'rotate-180' : ''}`} />
            </button>
            {rightsOpen && <RightsPanel rights={eventRights} onChange={setEventRights} />}
          </div>
        )}

        {!isPreviousMatch && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-slate-900">Streams</h2>
              <button onClick={addStream} className="px-3.5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-medium flex items-center gap-1.5"><Plus size={14} /> Add Stream</button>
            </div>
            <p className="text-xs text-slate-500 mb-5">Each stream pairs a broadcast input with an output template. Configure rights per stream.</p>
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
        )}

        {isPreviousMatch && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">VOD Content</h2>
                <p className="text-xs text-slate-500 mt-0.5">Manage linked VOD assets for this previous match.</p>
              </div>
              <div className="flex items-center gap-2">
                {form.opta_id && (
                  <button onClick={() => {
                    const fresh = findVodSuggestions(form.opta_id);
                    const existingIds = new Set(vodItems.map(v => v.asset_id));
                    const newItems = fresh.filter(v => !existingIds.has(v.asset_id));
                    setVodItems(p => [...p, ...newItems]);
                  }} className="px-3.5 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm flex items-center gap-1.5">
                    <RefreshCw size={13} /> Re-scan for VOD
                  </button>
                )}
                <button onClick={() => { setVodSearchOpen(o => !o); setVodSearch(''); }}
                  className={`px-3.5 py-2 border rounded-lg text-sm flex items-center gap-1.5 transition-colors ${vodSearchOpen ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                  <Search size={13} /> Search
                </button>
              </div>
            </div>

            {vodSearchOpen && (() => {
              const query = vodSearch.trim().toLowerCase();
              const existingIds = new Set(vodItems.map(v => v.asset_id));
              const results = VOD_CATALOGUE.filter(v =>
                !existingIds.has(v.id) && (query === '' || v.title.toLowerCase().includes(query) || v.opta_id.toLowerCase().includes(query))
              );
              return (
                <div className="border border-violet-200 rounded-xl bg-violet-50/40 p-4 space-y-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input autoFocus type="text" value={vodSearch} onChange={e => setVodSearch(e.target.value)}
                      placeholder="Search by title or Opta ID…"
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:border-violet-500 focus:ring-1 focus:ring-violet-200 focus:outline-none text-sm bg-white" />
                  </div>
                  {results.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-3">
                      {query ? `No results for "${vodSearch}"` : 'All catalogue assets are already linked.'}
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {results.map(vod => (
                        <div key={vod.id} className="flex items-center gap-3 px-3 py-2.5 bg-white rounded-lg border border-slate-200">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{vod.title}</p>
                            <p className="text-[11px] text-slate-500">{vod.opta_id} · {formatDuration(vod.duration_seconds)}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${VOD_TYPE_COLORS[vod.type]}`}>{VOD_TYPE_LABELS[vod.type]}</span>
                          <button onClick={() => {
                            setVodItems(p => [...p, { asset_id: vod.id, asset_title: vod.title, asset_type: vod.type, duration_seconds: vod.duration_seconds, published_at: vod.published_at, confirmed: true }]);
                          }} className="px-2.5 py-1.5 bg-violet-600 text-white rounded-md hover:bg-violet-700 text-xs font-medium flex items-center gap-1 flex-shrink-0">
                            <Plus size={11} /> Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {vodItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Archive size={32} className="text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">{form.opta_id ? 'No VOD assets linked. Click Re-scan to find matching assets.' : 'No VOD assets linked to this match.'}</p>
              </div>
            ) : (
              <>
                {vodItems.some(v => !v.confirmed) && (
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AlertCircle size={12} /> Suggested — awaiting confirmation
                    </p>
                    <div className="space-y-2">
                      {vodItems.filter(v => !v.confirmed).map(vod => (
                        <div key={vod.asset_id} className="flex items-center gap-3 p-3 rounded-lg border-2 border-amber-300 bg-amber-50">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{vod.asset_title}</p>
                            <p className="text-[11px] text-slate-500">{formatDuration(vod.duration_seconds)} · {new Date(vod.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${VOD_TYPE_COLORS[vod.asset_type]}`}>{VOD_TYPE_LABELS[vod.asset_type]}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button onClick={() => setVodItems(p => p.map(v => v.asset_id === vod.asset_id ? { ...v, confirmed: true } : v))}
                              className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-xs font-medium flex items-center gap-1"><Check size={11} /> Confirm</button>
                            <button onClick={() => setVodItems(p => p.filter(v => v.asset_id !== vod.asset_id))}
                              className="px-2.5 py-1.5 border border-slate-300 text-slate-600 rounded-md hover:bg-slate-100 text-xs font-medium flex items-center gap-1"><X size={11} /> Dismiss</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {vodItems.some(v => v.confirmed) && (
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Check size={12} /> Confirmed
                    </p>
                    <div className="space-y-2">
                      {vodItems.filter(v => v.confirmed).map(vod => (
                        <div key={vod.asset_id} className="flex items-center gap-3 p-3 rounded-lg border-2 border-emerald-300 bg-emerald-50">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{vod.asset_title}</p>
                            <p className="text-[11px] text-slate-500">{formatDuration(vod.duration_seconds)} · {new Date(vod.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${VOD_TYPE_COLORS[vod.asset_type]}`}>{VOD_TYPE_LABELS[vod.asset_type]}</span>
                          <button onClick={() => setVodItems(p => p.filter(v => v.asset_id !== vod.asset_id))}
                            className="px-2.5 py-1.5 border border-slate-300 text-slate-600 rounded-md hover:bg-slate-100 text-xs font-medium flex items-center gap-1 flex-shrink-0"><X size={11} /> Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// ─── EVENT DETAILS MODAL ─────────────────────────────────────────────────────

function EventDetailsModal({ event, onClose, onEdit, vipSettings }: {
  event: LiveEvent; onClose: () => void; onEdit: (e: LiveEvent) => void; vipSettings: VipSettings;
}) {
  const vipScheduledIso = event.vip_delivery?.enabled ? computeScheduledSend(event.kickoff_time, vipSettings.lead_time_minutes) : '';
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
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Source</label>
                {event.source_match ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-2.5">
                    {event.source_match.provider === 'document_extraction' ? <FileText size={14} className="text-purple-600 flex-shrink-0 mt-0.5" /> : <RefreshCw size={14} className="text-slate-500 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1 text-xs">
                      <p className="font-medium text-slate-800">{event.source_match.provider === 'document_extraction' ? `Extracted from ${event.source_match.extraction_source_filename || 'uploaded document'}` : `Pulled from ${event.source_match.provider.toUpperCase()}`}</p>
                      <p className="text-slate-500 mt-0.5">{new Date(event.source_match.pulled_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}{event.source_match.source_id && <> · <code className="font-mono text-slate-600">{event.source_match.source_id}</code></>}</p>
                    </div>
                  </div>
                ) : <p className="text-xs text-slate-500">Manual entry</p>}
              </div>
              {event.vip_delivery?.enabled && (
                <div className="pt-4 border-t border-slate-100">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center"><Crown size={16} className="text-amber-700" /></div>
                        <div>
                          <p className="text-sm font-semibold text-amber-900">VIP Delivery enabled</p>
                          <p className="text-[11px] text-amber-700">{vipScheduledIso && <>Send at {formatDateTime(vipScheduledIso)}</>}</p>
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
                const hasRights = !!stream.rights.geo_profile || stream.rights.geo_countries.length > 0 || stream.rights.subscription_plans.length > 0 || stream.rights.segment_ids.length > 0;
                return (
                  <div key={stream.id} className="border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><StreamIconComp size={16} className="text-emerald-700" /></div>
                      <div className="flex-1"><h4 className="font-semibold text-slate-900">{stream.title}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          {stream.live2vod && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1"><Archive size={9} /> Live2VOD</span>}
                          {stream.syndicate_social && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1"><Share2 size={9} /> Social</span>}
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


// ─── AI CREATE MODAL ─────────────────────────────────────────────────────────

function AiCreateModal({ onClose, onUpload, onGenerateFixtures, isProcessing, isGenerating, statsFeed }: {
  onClose: () => void; onUpload: (f: File) => void;
  onGenerateFixtures: () => void;
  isProcessing: boolean; isGenerating: boolean; statsFeed: StatsFeedSettings;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-emerald-500 rounded-full flex items-center justify-center"><Sparkles size={24} className="text-white" /></div>
            <div><h3 className="text-lg font-bold text-slate-900">Fetch Fixtures</h3><p className="text-sm text-slate-500">Pull from stats feed or extract from a document</p></div>
          </div>
          <button onClick={onClose} disabled={isProcessing || isGenerating} className="p-1 hover:bg-slate-100 rounded-lg disabled:opacity-50"><X size={20} /></button>
        </div>

        <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2 text-[11px]">
          <span className={`w-1.5 h-1.5 rounded-full ${statsFeed.credentials_configured ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          <span className="text-slate-600"><strong className="text-slate-800">Source:</strong> {statsFeed.provider.toUpperCase()} · {statsFeed.primary_team_display} · {statsFeed.competitions_in_scope.length} competitions in scope</span>
        </div>

        <div className="mb-6">
          <div className="bg-gradient-to-r from-blue-50 to-emerald-50 border-2 border-emerald-300 rounded-lg p-5">
            <div className="flex items-start gap-3">
              <Calendar size={22} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900 mb-1">Import All Upcoming Fixtures</h4>
                <p className="text-xs text-slate-600 mb-3">
                  Pulls all upcoming fixtures for {statsFeed.primary_team_display} from {statsFeed.provider.toUpperCase()} and creates bare-metadata draft events ready to configure.
                </p>
                <button onClick={onGenerateFixtures} disabled={isProcessing || isGenerating}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium">
                  <Sparkles size={16} /> Fetch all fixtures
                </button>
              </div>
            </div>
            {isGenerating && <div className="mt-4 bg-emerald-100 border border-emerald-300 rounded-lg p-3 flex items-center gap-3"><div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /><p className="text-sm font-medium text-emerald-900">Pulling fixtures from {statsFeed.provider.toUpperCase()}…</p></div>}
          </div>
        </div>

        <div className="relative mb-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-300" /></div><div className="relative flex justify-center text-sm"><span className="px-3 bg-white text-slate-500 font-medium">OR</span></div></div>

        <div className="mb-6">
          <div className="flex items-start gap-3 mb-3"><FileText size={22} className="text-purple-600 flex-shrink-0 mt-0.5" /><div><h4 className="font-semibold text-slate-900 mb-1">Upload Event Document</h4><p className="text-xs text-slate-600">AI extracts fixture details from a PDF, Word, or text file. Created drafts are flagged for review.</p></div></div>
          <div className="bg-gradient-to-r from-purple-50 to-emerald-50 border-2 border-dashed border-purple-300 rounded-lg p-6 text-center">
            <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={e => { const file = e.target.files?.[0]; if (file) onUpload(file); }} className="hidden" id="ai-create-upload" disabled={isProcessing || isGenerating} />
            <label htmlFor="ai-create-upload" className={`cursor-pointer ${(isProcessing || isGenerating) ? 'cursor-not-allowed opacity-50' : ''}`}>
              <Upload size={40} className="text-purple-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-900 mb-1">Click to upload</p>
              <p className="text-xs text-slate-500">PDF, Word, or text files</p>
            </label>
          </div>
          {isProcessing && <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center gap-3"><div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" /><p className="text-sm font-medium text-purple-900">AI is extracting event details…</p></div>}
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
          <div><h3 className="text-lg font-bold text-slate-900">Delete Event</h3><p className="text-sm text-slate-500">This action can be undone</p></div>
        </div>
        <p className="text-slate-700 mb-6">Are you sure you want to delete "<strong>{event.title}</strong>"? It will be moved to the deleted section.</p>
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

function VipMembersPage({ roster, setRoster, events, tenantId, onBack, settings, setSettings }: {
  roster: VipRosterEntry[]; setRoster: React.Dispatch<React.SetStateAction<VipRosterEntry[]>>;
  events: LiveEvent[]; tenantId: string; onBack: () => void;
  settings: VipSettings; setSettings: React.Dispatch<React.SetStateAction<VipSettings>>;
}) {
  const isCustomLead = !VIP_LEAD_TIME_PRESETS.some(p => p.minutes === settings.lead_time_minutes);
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

  const [cardOpen, setCardOpen] = useState({ delivery: true, domain: true, branding: true });
  const [domainSections, setDomainSections] = useState({ identity: true, auth: false });
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentId, setSentId]       = useState<string | null>(null);
  const handleResendEmail = (id: string) => {
    setSendingId(id);
    setTimeout(() => { setSendingId(null); setSentId(id); setTimeout(() => setSentId(null), 2500); }, 1200);
  };
  const [copiedDnsKey, setCopiedDnsKey] = useState<string | null>(null);
  const copyDns = (text: string, key: string) => { navigator.clipboard?.writeText(text); setCopiedDnsKey(key); setTimeout(() => setCopiedDnsKey(null), 2000); };

  const d = settings.email_domain;
  const verifyBadge: Record<DomainVerifyStatus, { label: string; color: string }> = {
    unverified: { label: 'Not verified',       color: 'bg-slate-100 text-slate-600' },
    pending:    { label: 'Checking DNS…',       color: 'bg-blue-100 text-blue-700' },
    verified:   { label: 'Verified',            color: 'bg-emerald-100 text-emerald-700' },
    failed:     { label: 'Verification failed', color: 'bg-red-100 text-red-700' },
  };

  const [vipTab, setVipTab] = useState<'members' | 'settings' | 'audit'>('members');
  const [auditMemberFilter, setAuditMemberFilter] = useState('');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState('');
  const filteredLog = useMemo(() => MOCK_AUDIT_LOG.filter(e => {
    if (auditMemberFilter && e.member_email !== auditMemberFilter) return false;
    if (auditCategoryFilter && !AUDIT_CATEGORY_MAP[auditCategoryFilter]?.includes(e.action)) return false;
    return true;
  }), [auditMemberFilter, auditCategoryFilter]);

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

      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-1 py-2">
            {(['members', 'settings', 'audit'] as const).map(tab => (
              <button key={tab} onClick={() => setVipTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${vipTab === tab ? 'bg-amber-100 text-amber-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
                {tab === 'members' ? 'Members' : tab === 'settings' ? 'Settings' : 'Audit Log'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {vipTab === 'settings' && <>
      <div className="max-w-6xl mx-auto p-6 pb-0">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button type="button" onClick={() => setCardOpen(s => ({ ...s, delivery: !s.delivery }))}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0"><Send size={16} className="text-amber-700" /></div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-slate-900">Delivery Settings</h2>
              <p className="text-xs text-slate-500 mt-0.5">Tenant-wide configuration – applies to every event with VIP delivery enabled.</p>
            </div>
            <ChevronDown size={16} className={`text-slate-400 transition-transform duration-150 flex-shrink-0 ${cardOpen.delivery ? 'rotate-180' : ''}`} />
          </button>
          {cardOpen.delivery && (
            <div className="px-5 pb-5 pt-1 border-t border-slate-100">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Email lead time</label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {VIP_LEAD_TIME_PRESETS.map(p => (
                      <button key={p.minutes} type="button" onClick={() => setSettings(s => ({ ...s, lead_time_minutes: p.minutes }))}
                        className={`text-xs font-medium px-2.5 py-2 rounded-lg border-2 transition-colors ${settings.lead_time_minutes === p.minutes ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300'}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min={5} step={5} value={settings.lead_time_minutes}
                      onChange={e => setSettings(s => ({ ...s, lead_time_minutes: Math.max(5, Number(e.target.value) || 0) }))}
                      className={`w-28 px-3 py-2 border rounded-lg text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-200 focus:outline-none ${isCustomLead ? 'border-amber-400 bg-amber-50/50' : 'border-slate-300'}`} />
                    <span className="text-xs text-slate-500">minutes before kick-off {isCustomLead && <strong className="text-amber-700">(custom)</strong>}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Hosted page URL pattern</p>
                    <code className="text-[11px] text-slate-700 font-mono bg-slate-50 border border-slate-200 px-2 py-1.5 rounded block break-all">
                      https://{settings.hosted_page_host}/{tenantId}/&#123;event_id&#125;
                    </code>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Access model</p><p className="text-xs text-slate-800 font-medium flex items-center gap-1.5"><Key size={12} className="text-amber-600" /> Email-bound passwordless</p></div>
                    <div><p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Rights bypass</p><p className="text-xs text-slate-800 font-medium flex items-center gap-1.5"><Shield size={12} className="text-amber-600" /> Geo + Subscription + Segments</p></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-0 pt-4 space-y-5">
        {/* Email domain settings */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button type="button" onClick={() => setCardOpen(s => ({ ...s, domain: !s.domain }))}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0"><AtSign size={16} className="text-blue-700" /></div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-slate-900">Email Domain</h2>
              <p className="text-xs text-slate-500 mt-0.5">Sending identity, DNS authentication, and delivery tracking for VIP emails.</p>
            </div>
            <span className={`px-2.5 py-1 rounded-md text-[10px] font-semibold ${verifyBadge[d.verification_status].color}`}>{verifyBadge[d.verification_status].label}</span>
            <ChevronDown size={16} className={`text-slate-400 transition-transform duration-150 flex-shrink-0 ${cardOpen.domain ? 'rotate-180' : ''}`} />
          </button>

          {cardOpen.domain && <>
          {/* Section 1 – Sending Identity */}
          <div className="border-b border-slate-100">
            <button type="button" onClick={() => setDomainSections(s => ({ ...s, identity: !s.identity }))}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors text-left">
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Mail size={13} className="text-slate-400" />Sending Identity</span>
              <ChevronDown size={14} className={`text-slate-400 transition-transform duration-150 ${domainSections.identity ? 'rotate-180' : ''}`} />
            </button>
            {domainSections.identity && (
              <div className="px-5 pb-4 pt-1 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">From name</label>
                    <input type="text" value={d.from_name} onChange={e => setSettings(s => ({ ...s, email_domain: { ...s.email_domain, from_name: e.target.value } }))}
                      placeholder="e.g. Burnley FC" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">From address</label>
                    <input type="email" value={d.from_address} onChange={e => setSettings(s => ({ ...s, email_domain: { ...s.email_domain, from_address: e.target.value } }))}
                      placeholder="noreply@burnleyfc.com" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none text-sm font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Reply-to <span className="font-normal text-slate-400 normal-case">(optional)</span></label>
                  <input type="email" value={d.reply_to} onChange={e => setSettings(s => ({ ...s, email_domain: { ...s.email_domain, reply_to: e.target.value } }))}
                    placeholder="media@burnleyfc.com" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none text-sm font-mono" />
                </div>
              </div>
            )}
          </div>

          {/* Section 2 – Domain Authentication */}
          <div className="border-b border-slate-100">
            <button type="button" onClick={() => setDomainSections(s => ({ ...s, auth: !s.auth }))}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors text-left">
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Shield size={13} className="text-slate-400" />Domain Authentication <span className="font-normal text-slate-400">(SPF / DKIM / DMARC)</span></span>
              <ChevronDown size={14} className={`text-slate-400 transition-transform duration-150 ${domainSections.auth ? 'rotate-180' : ''}`} />
            </button>
            {domainSections.auth && (
              <div className="px-5 pb-4 pt-1 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Sending domain</label>
                    <input type="text" value={d.sending_domain} onChange={e => setSettings(s => ({ ...s, email_domain: { ...s.email_domain, sending_domain: e.target.value } }))}
                      placeholder="burnleyfc.com" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">DKIM selector</label>
                    <input type="text" value={d.dkim_selector} onChange={e => setSettings(s => ({ ...s, email_domain: { ...s.email_domain, dkim_selector: e.target.value } }))}
                      placeholder="yinzcam" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none text-sm font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-2">DMARC policy</label>
                  <div className="flex gap-2 mb-1">
                    {(['none', 'quarantine', 'reject'] as DmarcPolicy[]).map(p => (
                      <button key={p} type="button" onClick={() => setSettings(s => ({ ...s, email_domain: { ...s.email_domain, dmarc_policy: p } }))}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-colors capitalize ${d.dmarc_policy === p ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {d.dmarc_policy === 'none' ? 'Monitor only — no action taken on failing mail.' : d.dmarc_policy === 'quarantine' ? 'Route failing mail to spam/junk.' : 'Reject failing mail outright.'}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">DNS records to add</p>
                  {[
                    { label: 'SPF',   type: 'TXT',   host: d.sending_domain || 'your-domain.com',                                                        value: `v=spf1 include:spf.yinzcam.com ~all`,                                                                  key: 'spf'   },
                    { label: 'DKIM',  type: 'TXT',   host: `${d.dkim_selector || 'yinzcam'}._domainkey.${d.sending_domain || 'your-domain.com'}`,         value: `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2gZS+e5rVm3Q...`,                    key: 'dkim'  },
                    { label: 'DMARC', type: 'TXT',   host: `_dmarc.${d.sending_domain || 'your-domain.com'}`,                                            value: `v=DMARC1; p=${d.dmarc_policy}; rua=mailto:dmarc-rua@yinzcam.com`,                                      key: 'dmarc' },
                  ].map(rec => (
                    <div key={rec.key} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded font-mono">{rec.type}</span>
                          <span className="text-[11px] font-semibold text-slate-700">{rec.label}</span>
                        </div>
                        <button type="button" onClick={() => copyDns(rec.value, rec.key)}
                          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded hover:bg-slate-200 transition-colors">
                          {copiedDnsKey === rec.key ? <><Check size={10} className="text-emerald-600" />Copied</> : <><Copy size={10} />Copy value</>}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 mb-1.5">Host: <code className="font-mono text-slate-700 bg-white border border-slate-200 px-1 rounded">{rec.host}</code></p>
                      <code className="text-[10px] font-mono text-slate-700 break-all bg-white border border-slate-200 rounded px-2 py-1 block">{rec.value}</code>
                    </div>
                  ))}
                </div>
                <button type="button" disabled={d.verification_status === 'pending'}
                  onClick={() => {
                    setSettings(s => ({ ...s, email_domain: { ...s.email_domain, verification_status: 'pending' } }));
                    setTimeout(() => setSettings(s => ({ ...s, email_domain: { ...s.email_domain, verification_status: s.email_domain.sending_domain ? 'verified' : 'failed' } })), 2000);
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors">
                  {d.verification_status === 'pending'
                    ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Checking DNS…</>
                    : <><RefreshCw size={12} />Verify DNS records</>}
                </button>
              </div>
            )}
          </div>

          </>}
        </div>

        {/* Email branding */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button type="button" onClick={() => setCardOpen(s => ({ ...s, branding: !s.branding }))}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0"><Palette size={16} className="text-purple-700" /></div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-slate-900">Email Branding</h2>
              <p className="text-xs text-slate-500 mt-0.5">Visual identity and copy for the templated VIP email.</p>
            </div>
            <ChevronDown size={16} className={`text-slate-400 transition-transform duration-150 flex-shrink-0 ${cardOpen.branding ? 'rotate-180' : ''}`} />
          </button>
          {cardOpen.branding && (
            <div className="px-5 pb-5 pt-1 border-t border-slate-100 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Logo URL</label>
                <input type="url" value={settings.email_branding.logo_url}
                  onChange={e => setSettings(s => ({ ...s, email_branding: { ...s.email_branding, logo_url: e.target.value } }))}
                  placeholder="https://cdn.burnleyfc.com/logo.png"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-200 focus:outline-none text-sm font-mono" />
                {settings.email_branding.logo_url && (
                  <img src={settings.email_branding.logo_url} alt="Logo preview" onError={e => (e.currentTarget.style.display = 'none')}
                    className="mt-2 h-8 object-contain rounded" />
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Primary colour</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.email_branding.primary_colour}
                    onChange={e => setSettings(s => ({ ...s, email_branding: { ...s.email_branding, primary_colour: e.target.value } }))}
                    className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white" />
                  <input type="text" value={settings.email_branding.primary_colour}
                    onChange={e => setSettings(s => ({ ...s, email_branding: { ...s.email_branding, primary_colour: e.target.value } }))}
                    className="w-28 px-3 py-2 border border-slate-300 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-200 focus:outline-none text-sm font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Subject line template</label>
                <input type="text" value={settings.email_branding.subject_template}
                  onChange={e => setSettings(s => ({ ...s, email_branding: { ...s.email_branding, subject_template: e.target.value } }))}
                  placeholder="Your VIP access for {{event_name}} is ready"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-200 focus:outline-none text-sm" />
                <p className="text-[10px] text-slate-400 mt-1">Use <code className="font-mono">&#123;&#123;event_name&#125;&#125;</code> to insert the event title.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Footer text <span className="text-slate-400 font-normal normal-case">(optional)</span></label>
                <textarea rows={2} value={settings.email_branding.footer_text}
                  onChange={e => setSettings(s => ({ ...s, email_branding: { ...s.email_branding, footer_text: e.target.value } }))}
                  placeholder="e.g. © 2026 Burnley FC. All rights reserved."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-200 focus:outline-none text-sm resize-none" />
              </div>
            </div>
          )}
        </div>
      </div>
      </>}

      {vipTab === 'members' && (
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
                      {!entry.revoked && (
                        <button onClick={() => handleResendEmail(entry.id)}
                          disabled={sendingId === entry.id || sentId === entry.id}
                          className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md flex items-center gap-1 flex-shrink-0 border transition-colors disabled:cursor-not-allowed ${sentId === entry.id ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100'}`}>
                          {sendingId === entry.id
                            ? <><div className="w-2.5 h-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />Sending…</>
                            : sentId === entry.id
                            ? <><Check size={11} />Sent</>
                            : <><Send size={11} />Resend email</>}
                        </button>
                      )}
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
      )}

      {vipTab === 'audit' && (
        <div className="max-w-6xl mx-auto p-6 space-y-6">

          {/* Views per Member */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900">Views per Member</h2>
              <p className="text-xs text-slate-500 mt-0.5">Aggregate stream views across all past events.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-left">Member</th>
                    <th className="px-5 py-3 text-left">Email</th>
                    <th className="px-5 py-3 text-center">Views</th>
                    <th className="px-5 py-3 text-left">Last event</th>
                    <th className="px-5 py-3 text-left">Last viewed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {initialVipRoster.map(entry => {
                    const stats = VIP_VIEW_COUNTS[entry.email];
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 text-sm font-medium text-slate-900">{entry.name || entry.email}</td>
                        <td className="px-5 py-3 text-xs text-slate-500 font-mono">{entry.email}</td>
                        <td className="px-5 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                            {stats?.count ?? 0}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-600 max-w-[220px] truncate">{stats?.lastEvent || <span className="text-slate-400">—</span>}</td>
                        <td className="px-5 py-3 text-xs text-slate-500">
                          {stats?.lastViewed
                            ? new Date(stats.lastViewed).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : <span className="text-slate-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Full Audit Log */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Audit Log</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {filteredLog.length} entries{(auditMemberFilter || auditCategoryFilter) ? ' (filtered)' : ''}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <select value={auditMemberFilter} onChange={e => setAuditMemberFilter(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:border-amber-400 bg-white">
                  <option value="">All members</option>
                  {initialVipRoster.map(e => <option key={e.id} value={e.email}>{e.name || e.email}</option>)}
                </select>
                <select value={auditCategoryFilter} onChange={e => setAuditCategoryFilter(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:border-amber-400 bg-white">
                  <option value="">All categories</option>
                  <option value="roster">Roster</option>
                  <option value="email">Email</option>
                  <option value="access">Access</option>
                  <option value="config">Config</option>
                  <option value="url">URL</option>
                </select>
                {(auditMemberFilter || auditCategoryFilter) && (
                  <button onClick={() => { setAuditMemberFilter(''); setAuditCategoryFilter(''); }}
                    className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                    Clear filters
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left">Time</th>
                    <th className="px-5 py-3 text-left">Action</th>
                    <th className="px-5 py-3 text-left">Member</th>
                    <th className="px-5 py-3 text-left">Event</th>
                    <th className="px-5 py-3 text-left">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLog.slice(0, 200).map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5 text-[11px] text-slate-500 whitespace-nowrap font-mono">
                        {new Date(entry.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' '}{new Date(entry.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-5 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${ACTION_BADGE_COLORS[entry.action]}`}>
                          {ACTION_LABELS[entry.action]}
                        </span>
                      </td>
                      <td className="px-5 py-2.5">
                        {entry.member_email ? (
                          <div>
                            <p className="text-xs font-medium text-slate-800">{entry.member_name || entry.member_email}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{entry.member_email}</p>
                          </div>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-slate-600 max-w-[200px] truncate">{entry.event_title || <span className="text-slate-400">—</span>}</td>
                      <td className="px-5 py-2.5 text-[10px] text-slate-500 font-mono">{actorLabel(entry.actor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredLog.length > 200 && (
                <div className="px-5 py-3 text-center text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
                  Showing 200 of {filteredLog.length} entries
                </div>
              )}
            </div>
          </div>

        </div>
      )}

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

function CreatePreviousMatchPage({ onBack, onSave, tenantId }: {
  onBack: () => void; onSave: (e: LiveEvent) => void; tenantId: string;
}) {
  const [form, setForm] = useState({ title: '', description: '', match_date: '', kickoff_time: '', home_team: '', away_team: '', competition: '', venue: '', opta_id: '' });
  const [includeMatchDetails, setIncludeMatchDetails] = useState(true);
  const [vodSuggestions, setVodSuggestions] = useState<VodLink[]>([]);
  const updateForm = (u: Partial<typeof form>) => setForm(p => ({ ...p, ...u }));

  const handleOptaChange = (val: string) => {
    updateForm({ opta_id: val });
    setVodSuggestions(findVodSuggestions(val));
  };

  const formValid = !!form.title && !!form.match_date && !!form.kickoff_time;
  const confirmedVod = vodSuggestions.filter(v => v.confirmed);

  const handleSave = () => {
    const id = `evt_prev_${Date.now()}`;
    onSave({
      id,
      title: form.title,
      description: form.description,
      event_type: 'previous',
      status: 'ended',
      channelState: 'idle',
      includeMatchDetails,
      homeTeam:    includeMatchDetails ? form.home_team   : '',
      awayTeam:    includeMatchDetails ? form.away_team   : '',
      competition: includeMatchDetails ? form.competition : '',
      venue:       includeMatchDetails ? form.venue       : '',
      event_start_time: `${form.match_date}T${form.kickoff_time}:00`,
      kickoff_time:     `${form.match_date}T${form.kickoff_time}:00`,
      event_end_time:   '',
      opta_id: form.opta_id,
      external_id: '',
      image_16x9: null, image_9x16: null,
      currentViewers: 0, peakViewers: 0,
      streams: [],
      vod_items: confirmedVod,
      vip_delivery: { enabled: false },
      apiUrl: `https://api.example.com/v1/events/${id}`,
      isDraft: false,
    });
    void tenantId;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-900 font-medium">← Back</button>
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <Archive size={18} className="text-violet-600" />
              <h1 className="text-lg font-bold text-slate-900">New Previous Match</h1>
            </div>
          </div>
          <button onClick={handleSave} disabled={!formValid}
            className="px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium text-sm transition-colors flex items-center gap-2">
            <Check size={16} /> Save Match
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              <h2 className="text-base font-bold text-slate-900">Match Information</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Title <span className="text-red-500">*</span></label>
                <input type="text" value={form.title} onChange={e => updateForm({ title: e.target.value })}
                  placeholder="e.g. Burnley FC vs Blackburn Rovers"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-violet-500 focus:ring-1 focus:ring-violet-200 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                <textarea rows={2} value={form.description} onChange={e => updateForm({ description: e.target.value })}
                  placeholder="Optional match notes..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-violet-500 focus:ring-1 focus:ring-violet-200 focus:outline-none text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Match Date <span className="text-red-500">*</span></label>
                  <input type="date" value={form.match_date} onChange={e => updateForm({ match_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-violet-500 focus:ring-1 focus:ring-violet-200 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Kick-off Time <span className="text-red-500">*</span></label>
                  <input type="time" value={form.kickoff_time} onChange={e => updateForm({ kickoff_time: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-violet-500 focus:ring-1 focus:ring-violet-200 focus:outline-none text-sm" />
                </div>
              </div>
            </div>

            {/* Data Integration */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Data Integration</h2>
                <p className="text-xs text-slate-500 mt-0.5">Enter the Opta match ID to link match data and surface matching VOD assets.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Opta Match ID</label>
                <input type="text" value={form.opta_id} onChange={e => handleOptaChange(e.target.value)}
                  placeholder="e.g. g2412345"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:border-violet-500 focus:ring-1 focus:ring-violet-200 focus:outline-none text-sm font-mono" />
              </div>
              {form.opta_id && vodSuggestions.length > 0 && (
                <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                  <Check size={12} className="text-emerald-600" />
                  {vodSuggestions.length} VOD asset{vodSuggestions.length !== 1 ? 's' : ''} found in catalogue
                </p>
              )}
              {form.opta_id && vodSuggestions.length === 0 && (
                <p className="text-xs text-slate-400 italic">No Opta fixture found for &ldquo;{form.opta_id}&rdquo;.</p>
              )}
            </div>

            {/* VOD Content */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">VOD Content</h2>
                <p className="text-xs text-slate-500 mt-0.5">Select VOD assets to link to this previous match. Toggle each item to include it.</p>
              </div>
              {vodSuggestions.length > 0 ? (
                <>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    {vodSuggestions.filter(v => v.confirmed).length} of {vodSuggestions.length} selected
                  </p>
                  <div className="space-y-2">
                    {vodSuggestions.map(vod => (
                      <div key={vod.asset_id} className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors cursor-pointer ${vod.confirmed ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                        onClick={() => setVodSuggestions(p => p.map(v => v.asset_id === vod.asset_id ? { ...v, confirmed: !v.confirmed } : v))}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${vod.confirmed ? 'bg-violet-600' : 'bg-white border-2 border-slate-300'}`}>
                          {vod.confirmed && <Check size={12} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{vod.asset_title}</p>
                          <p className="text-[11px] text-slate-500">{formatDuration(vod.duration_seconds)} · {new Date(vod.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${VOD_TYPE_COLORS[vod.asset_type]}`}>{VOD_TYPE_LABELS[vod.asset_type]}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Archive size={28} className="text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">
                    {form.opta_id ? 'No VOD assets found for this Opta ID.' : 'Enter an Opta Match ID above to surface matching VOD assets.'}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Match Details</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Teams, competition, and venue information.</p>
                </div>
                <button type="button" onClick={() => setIncludeMatchDetails(p => !p)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${includeMatchDetails ? 'bg-violet-600' : 'bg-slate-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${includeMatchDetails ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {includeMatchDetails && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Home Team</label>
                      <input type="text" value={form.home_team} onChange={e => updateForm({ home_team: e.target.value })} placeholder="Home side" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-200 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Away Team</label>
                      <input type="text" value={form.away_team} onChange={e => updateForm({ away_team: e.target.value })} placeholder="Away side" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-200 focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Competition</label>
                      <input type="text" value={form.competition} onChange={e => updateForm({ competition: e.target.value })} placeholder="e.g. EFL Championship" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-200 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Venue</label>
                      <input type="text" value={form.venue} onChange={e => updateForm({ venue: e.target.value })} placeholder="e.g. Turf Moor" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-200 focus:outline-none" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 sticky top-20">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><Archive size={14} className="text-violet-600" /> Match Preview</h3>
              {form.title ? (
                <>
                  <p className="text-sm font-semibold text-slate-900 mb-1">{form.title}</p>
                  {form.description && <p className="text-xs text-slate-500 mb-2">{form.description}</p>}
                  {form.match_date && <p className="text-xs text-slate-500 flex items-center gap-1 mb-1"><Calendar size={11} /> {new Date(form.match_date + 'T' + (form.kickoff_time || '00:00')).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                  {includeMatchDetails && form.home_team && form.away_team && <p className="text-xs text-slate-600 flex items-center gap-1 mb-1"><Users size={11} /> {form.home_team} vs {form.away_team}</p>}
                  {includeMatchDetails && form.venue && <p className="text-xs text-slate-500 flex items-center gap-1 mb-1"><MapPin size={11} /> {form.venue}</p>}
                  {form.opta_id && <p className="text-xs text-slate-400 font-mono mt-2">Opta: {form.opta_id}</p>}
                  {confirmedVod.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">VOD ({confirmedVod.length})</p>
                      {confirmedVod.map(v => <p key={v.asset_id} className="text-xs text-violet-700 flex items-center gap-1 mb-1"><Play size={9} /> {v.asset_title}</p>)}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-400 italic">Fill in match details to see preview.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EventManager() {
  const TENANT_ID = 'burnley';

  const [view, setView]           = useState<ViewMode>('listing');
  const [editingEvent, setEditingEvent] = useState<LiveEvent | null>(null);
  const [activeEvents, setActiveEvents]   = useState<LiveEvent[]>(initialEvents);
  const [deletedEvents, setDeletedEvents] = useState<LiveEvent[]>([]);
  const [vipRoster, setVipRoster]   = useState<VipRosterEntry[]>(initialVipRoster);
  const [vipSettings, setVipSettings] = useState<VipSettings>(initialVipSettings);
  const [statsFeedSettings]         = useState<StatsFeedSettings>(initialStatsFeedSettings);
  const rosterActiveCount = activeVipCount(vipRoster);

  const [searchQuery, setSearchQuery]         = useState('');
  const [statusFilter, setStatusFilter]       = useState<'all' | EventStatus>('all');
  const [streamLabelFilters, setStreamLabelFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters]         = useState(false);
  const [selectedEvent, setSelectedEvent]     = useState<LiveEvent | null>(null);
  const [showDeletedTab, setShowDeletedTab]   = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showAiModal, setShowAiModal]         = useState(false);
  const [aiProcessing, setAiProcessing]       = useState(false);
  const [aiGeneratingFixtures, setAiGeneratingFixtures] = useState(false);
  const [channelActionConfirm, setChannelActionConfirm] = useState<{ eventId: string; action: 'start' | 'stop' } | null>(null);
  const [vodReviewEventId, setVodReviewEventId] = useState<string | null>(null);
  const [showPreviousMatches, setShowPreviousMatches] = useState(false);

  const handleVodConfirm = (eventId: string, assetId: string) => {
    setActiveEvents(prev => prev.map(e => e.id === eventId
      ? { ...e, vod_items: (e.vod_items || []).map(v => v.asset_id === assetId ? { ...v, confirmed: true } : v) }
      : e));
  };
  const handleVodDismiss = (eventId: string, assetId: string) => {
    setActiveEvents(prev => prev.map(e => e.id === eventId
      ? { ...e, vod_items: (e.vod_items || []).filter(v => v.asset_id !== assetId) }
      : e));
  };
  const handleVodRemove = (eventId: string, assetId: string) => {
    setActiveEvents(prev => prev.map(e => e.id === eventId
      ? { ...e, vod_items: (e.vod_items || []).filter(v => v.asset_id !== assetId) }
      : e));
  };

  const handleDeleteEvent = (eventId: string) => {
    const eventToDelete = activeEvents.find(e => e.id === eventId);
    if (eventToDelete) { setActiveEvents(activeEvents.filter(e => e.id !== eventId)); setDeletedEvents([...deletedEvents, { ...eventToDelete, deletedAt: new Date().toISOString() }]); setDeleteConfirmId(null); }
  };

  const handleReinstateEvent = (eventId: string) => {
    const eventToReinstate = deletedEvents.find(e => e.id === eventId);
    if (eventToReinstate) {
      const { deletedAt: _d, ...cleanEvent } = eventToReinstate;
      setDeletedEvents(deletedEvents.filter(e => e.id !== eventId));
      setActiveEvents([...activeEvents, cleanEvent]);
    }
  };

  const handleChannelStart = (eventId: string) => {
    setActiveEvents(prev => prev.map(e => e.id === eventId ? { ...e, channelState: 'starting' } : e));
    setChannelActionConfirm(null);
    setTimeout(() => setActiveEvents(prev => prev.map(e => e.id === eventId ? { ...e, channelState: 'running' } : e)), 3000);
  };

  const handleChannelStop = (eventId: string) => {
    const now = new Date().toISOString();
    const event = activeEvents.find(e => e.id === eventId);
    const vodSuggestions = event?.opta_id ? findVodSuggestions(event.opta_id) : [];
    setActiveEvents(prev => prev.map(e => e.id === eventId
      ? { ...e, channelState: 'stopping', event_end_time: now, status: 'ended', event_type: 'previous', currentViewers: 0, vod_items: vodSuggestions }
      : e));
    setChannelActionConfirm(null);
    setTimeout(() => setActiveEvents(prev => prev.map(e => e.id === eventId ? { ...e, channelState: 'idle' } : e)), 3000);
  };

  const handleAiCreateEvent = (file: File) => {
    setAiProcessing(true);
    setTimeout(() => {
      const id = `evt_ai_${Date.now()}`;
      const extracted = { home_team: 'Houston Dash', away_team: 'Chicago Red Stars', competition: 'NWSL Regular Season', venue: 'Shell Energy Stadium', kickoff_iso: '2026-02-15T19:30:00+00:00' };
      const newEvent: LiveEvent = {
        id, title: `${extracted.home_team} vs ${extracted.away_team}`, description: '', status: 'draft', channelState: 'idle',
        includeMatchDetails: true, homeTeam: extracted.home_team, awayTeam: extracted.away_team, competition: extracted.competition, venue: extracted.venue,
        event_start_time: '2026-02-15T19:00:00', kickoff_time: extracted.kickoff_iso, event_end_time: '2026-02-15T21:30:00',
        opta_id: '', external_id: '', image_16x9: null, image_9x16: null, currentViewers: 0, peakViewers: 0, streams: [],
        vip_delivery: { enabled: false },
        source_match: { provider: 'document_extraction', source_id: `doc_${id}`, pulled_at: new Date().toISOString(), raw_snapshot: extracted, extraction_review_required: true, extraction_source_filename: file.name },
        apiUrl: `https://api.example.com/v1/events/${id}`, isDraft: true,
      };
      setActiveEvents([newEvent, ...activeEvents]);
      setAiProcessing(false); setShowAiModal(false);
      setEditingEvent(newEvent); setView('edit');
    }, 2000);
  };

  const handleAiGenerateFixtures = () => {
    setAiGeneratingFixtures(true);
    setTimeout(() => {
      const now = Date.now();
      const pool = FIXTURE_CATALOG
        .filter(f => new Date(f.kickoff_iso).getTime() >= now)
        .sort((a, b) => new Date(a.kickoff_iso).getTime() - new Date(b.kickoff_iso).getTime());
      const ts = Date.now();
      const generatedFixtures: LiveEvent[] = pool.map((f, idx) => {
        const id = `evt_gen_${ts}_${idx + 1}`;
        const kickoffMs = new Date(f.kickoff_iso).getTime();
        return {
          id, title: `${f.home_team} v ${f.away_team}`, description: '', status: 'draft', channelState: 'idle',
          includeMatchDetails: true, homeTeam: f.home_team, awayTeam: f.away_team, competition: f.competition, venue: f.venue,
          event_start_time: new Date(kickoffMs - 30 * 60 * 1000).toISOString(),
          kickoff_time:     f.kickoff_iso,
          event_end_time:   new Date(kickoffMs + 2 * 60 * 60 * 1000).toISOString(),
          opta_id: f.opta_id, external_id: '', image_16x9: null, image_9x16: null, currentViewers: 0, peakViewers: 0, streams: [],
          vip_delivery: { enabled: false },
          source_match: { provider: statsFeedSettings.provider, source_id: f.opta_id, pulled_at: new Date().toISOString(), raw_snapshot: { home_team: f.home_team, away_team: f.away_team, competition: f.competition, venue: f.venue, kickoff_iso: f.kickoff_iso } },
          apiUrl: `https://api.example.com/v1/events/${id}`, isDraft: true,
        };
      });
      setActiveEvents([...generatedFixtures, ...activeEvents]);
      setAiGeneratingFixtures(false); setShowAiModal(false);
    }, 1500);
  };

  if (view === 'create') return <CreateEventPage tenantId={TENANT_ID} rosterCount={rosterActiveCount} onBack={() => setView('listing')} onCreatePrevious={() => setView('create-previous')} onSave={e => { setActiveEvents([e, ...activeEvents]); setView('listing'); }} />;
  if (view === 'create-previous') return <CreatePreviousMatchPage tenantId={TENANT_ID} onBack={() => setView('create')} onSave={e => { setActiveEvents([e, ...activeEvents]); setView('listing'); }} />;
  if (view === 'edit' && editingEvent) return <EditEventPage event={editingEvent} tenantId={TENANT_ID} rosterCount={rosterActiveCount} onBack={() => { setEditingEvent(null); setView('listing'); }} onSave={updated => { setActiveEvents(activeEvents.map(e => e.id === updated.id ? updated : e)); setEditingEvent(null); setView('listing'); }} />;
  if (view === 'vip-members') return <VipMembersPage roster={vipRoster} setRoster={setVipRoster} settings={vipSettings} setSettings={setVipSettings} events={activeEvents} tenantId={TENANT_ID} onBack={() => setView('listing')} />;

  const eventsToDisplay = showDeletedTab ? deletedEvents : activeEvents;
  const STREAM_TYPE_LABELS = STREAM_TEMPLATES.map(t => ({ template_id: t.template_id, display: t.display_name, icon: t.icon }));

  const filteredEvents = eventsToDisplay.filter(event => {
    const matchesSearch  = event.title.toLowerCase().includes(searchQuery.toLowerCase()) || (event.description || '').toLowerCase().includes(searchQuery.toLowerCase()) || (event.homeTeam && event.homeTeam.toLowerCase().includes(searchQuery.toLowerCase())) || (event.awayTeam && event.awayTeam.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus  = statusFilter === 'all' || event.status === statusFilter;
    const matchesStreams  = streamLabelFilters.length === 0 || streamLabelFilters.every(templateId => (event.streams || []).some(s => s.stream_template_id === templateId));
    return matchesSearch && matchesStatus && matchesStreams;
  });

  const previousMatchEvents = eventsToDisplay.filter(e => e.status === 'ended' || e.event_type === 'previous');
  const activeFilteredEvents = filteredEvents.filter(e => e.status !== 'ended' && e.event_type !== 'previous');
  const filteredPreviousEvents = previousMatchEvents.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) || (event.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

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
              <button onClick={() => setShowAiModal(true)} className="px-4 py-2 bg-gradient-to-r from-purple-600 to-emerald-600 text-white rounded-lg hover:from-purple-700 hover:to-emerald-700 flex items-center gap-2 text-sm font-medium">
                <Calendar size={18} /> Fetch fixtures
              </button>
              <button onClick={() => setView('create')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-medium">
                <Video size={18} /> Create Event
              </button>
            </div>
          </div>
          <div className="flex gap-2 border-b border-slate-200">
            <button onClick={() => setShowDeletedTab(false)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${!showDeletedTab ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>Active Events ({activeEvents.length})</button>
            <button onClick={() => setShowDeletedTab(true)}  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${showDeletedTab  ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>Deleted ({deletedEvents.length})</button>
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
              <p className="text-sm text-slate-500">Showing {activeFilteredEvents.length + filteredPreviousEvents.length} of {eventsToDisplay.length} events</p>
              {!showDeletedTab && (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-2 text-sm"><span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" /><span className="font-medium text-slate-900">{activeEvents.filter(e => e.status === 'live').length} Live</span></span>
                  <span className="text-slate-300">|</span>
                  <span className="text-sm text-slate-500">{activeEvents.filter(e => e.status === 'upcoming').length} Upcoming</span>
                </div>
              )}
            </div>

            {activeFilteredEvents.length === 0 && filteredPreviousEvents.length === 0 ? (
              <div className="text-center py-12"><Search size={48} className="mx-auto text-slate-300 mb-4" /><h3 className="text-lg font-semibold text-slate-900 mb-2">No events found</h3><p className="text-slate-500">Try adjusting your search or filters</p></div>
            ) : (
              <div className="space-y-4">
                {activeFilteredEvents.map(event => {
                  const configuredStreams = event.streams.filter(s => s.broadcast_id && s.stream_template_id);
                  const hasLive2VOD = event.streams.some(s => s.live2vod);
                  const hasSocial   = event.streams.some(s => s.syndicate_social);
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
                            {hasSocial   && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium flex items-center gap-1"><Share2 size={12} /> Social</span>}
                            {event.includeMatchDetails && <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">Match Details</span>}
                            {event.streams.some(s => s.rights.geo_profile || s.rights.subscription_plans.length > 0 || s.rights.segment_ids.length > 0) && <span className="px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs font-medium flex items-center gap-1"><Shield size={12} /> Rights</span>}
                            {event.vip_delivery?.enabled && <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-medium flex items-center gap-1 border border-amber-300"><Crown size={12} /> VIP · {rosterActiveCount}</span>}
                            {event.source_match?.extraction_review_required && <span className="px-2 py-1 bg-amber-50 text-amber-800 rounded text-xs font-medium flex items-center gap-1 border border-amber-300"><AlertCircle size={12} /> Needs review</span>}
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
                          {showDeletedTab ? (
                            <button onClick={() => handleReinstateEvent(event.id)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Reinstate"><Check size={20} /></button>
                          ) : (
                            <>
                              <button onClick={() => setSelectedEvent(event)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="View Details"><Eye size={20} /></button>
                              <button onClick={() => { setEditingEvent(event); setView('edit'); }} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Edit Event"><Edit2 size={20} /></button>
                              <button onClick={() => setDeleteConfirmId(event.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Event"><Trash2 size={20} /></button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Previous Matches section */}
                {filteredPreviousEvents.length > 0 && (
                  <div className="mt-6">
                    <button onClick={() => setShowPreviousMatches(p => !p)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-left mb-2">
                      <div className="flex items-center gap-2">
                        <Archive size={16} className="text-violet-600" />
                        <span className="text-sm font-semibold text-slate-800">Previous Matches</span>
                        <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-medium rounded-full">{filteredPreviousEvents.length}</span>
                      </div>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform duration-150 ${showPreviousMatches ? 'rotate-180' : ''}`} />
                    </button>
                    {showPreviousMatches && (
                      <div className="space-y-3">
                        {filteredPreviousEvents.map(event => {
                          const confirmed = (event.vod_items || []).filter(v => v.confirmed);
                          const pending   = (event.vod_items || []).filter(v => !v.confirmed);
                          return (
                            <div key={event.id} className="border border-slate-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
                              <div className="flex items-start gap-4">
                                <div className="w-14 h-14 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <Archive size={24} className="text-violet-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-3 mb-1">
                                    <h3 className="text-sm font-semibold text-slate-900">{event.title}</h3>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border bg-slate-100 text-slate-600 border-slate-200 flex-shrink-0">PREVIOUS</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-2">
                                    {event.includeMatchDetails && event.homeTeam && event.awayTeam && <span className="flex items-center gap-1"><Users size={12} /> {event.homeTeam} vs {event.awayTeam}</span>}
                                    {event.includeMatchDetails && event.venue && <span className="flex items-center gap-1"><MapPin size={12} /> {event.venue}</span>}
                                    <span className="flex items-center gap-1"><Calendar size={12} /> {formatShortDate(event.kickoff_time)}</span>
                                    {event.opta_id && <span className="font-mono text-slate-400">{event.opta_id}</span>}
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {confirmed.length > 0 && (
                                      <span className="px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs font-medium flex items-center gap-1">
                                        <Play size={10} /> {confirmed.length} VOD item{confirmed.length !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                    {pending.length > 0 && (
                                      <button onClick={() => setVodReviewEventId(event.id)}
                                        className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-medium flex items-center gap-1 border border-amber-200 hover:bg-amber-200 transition-colors">
                                        <AlertCircle size={10} /> {pending.length} suggested — Review
                                      </button>
                                    )}
                                    {pending.length === 0 && confirmed.length === 0 && (
                                      <span className="text-xs text-slate-400 italic">No VOD linked</span>
                                    )}
                                    {confirmed.length > 0 && (
                                      <button onClick={() => setVodReviewEventId(event.id)}
                                        className="px-2 py-1 bg-white text-slate-600 rounded text-xs font-medium border border-slate-200 hover:bg-slate-50 transition-colors">
                                        Manage VOD
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-2 flex-shrink-0">
                                  <button onClick={() => { setEditingEvent(event); setView('edit'); }} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Edit"><Edit2 size={18} /></button>
                                  <button onClick={() => setDeleteConfirmId(event.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={18} /></button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedEvent && <EventDetailsModal event={selectedEvent} onClose={() => setSelectedEvent(null)} onEdit={evt => { setEditingEvent(evt); setView('edit'); }} vipSettings={vipSettings} />}
      {vodReviewEventId && (() => {
        const event = activeEvents.find(e => e.id === vodReviewEventId);
        if (!event) return null;
        const confirmed = (event.vod_items || []).filter(v => v.confirmed);
        const pending   = (event.vod_items || []).filter(v => !v.confirmed);
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-base font-bold text-slate-900">VOD Management</h3>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{event.title}</p>
                </div>
                <button onClick={() => setVodReviewEventId(null)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
              </div>
              <div className="overflow-y-auto flex-1 p-5 space-y-4">
                {pending.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1"><AlertCircle size={11} /> {pending.length} Suggested — awaiting review</p>
                    <div className="space-y-2">
                      {pending.map(vod => (
                        <div key={vod.asset_id} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{vod.asset_title}</p>
                            <p className="text-[11px] text-slate-500">{formatDuration(vod.duration_seconds)} · {new Date(vod.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${VOD_TYPE_COLORS[vod.asset_type]}`}>{VOD_TYPE_LABELS[vod.asset_type]}</span>
                          <button onClick={() => handleVodConfirm(event.id, vod.asset_id)} className="px-2.5 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex-shrink-0">Confirm</button>
                          <button onClick={() => handleVodDismiss(event.id, vod.asset_id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0"><X size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {confirmed.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1"><Check size={11} /> {confirmed.length} Confirmed</p>
                    <div className="space-y-2">
                      {confirmed.map(vod => (
                        <div key={vod.asset_id} className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{vod.asset_title}</p>
                            <p className="text-[11px] text-slate-500">{formatDuration(vod.duration_seconds)} · {new Date(vod.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${VOD_TYPE_COLORS[vod.asset_type]}`}>{VOD_TYPE_LABELS[vod.asset_type]}</span>
                          <button onClick={() => handleVodRemove(event.id, vod.asset_id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0" title="Remove"><X size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {pending.length === 0 && confirmed.length === 0 && (
                  <div className="text-center py-8">
                    <Archive size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500">No VOD items linked to this match.</p>
                  </div>
                )}
              </div>
              <div className="px-6 py-3 border-t border-slate-200 flex justify-end flex-shrink-0">
                <button onClick={() => setVodReviewEventId(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Done</button>
              </div>
            </div>
          </div>
        );
      })()}
      {deleteConfirmId && (() => { const evt = activeEvents.find(e => e.id === deleteConfirmId); if (!evt) return null; return <DeleteConfirmModal event={evt} onConfirm={() => handleDeleteEvent(deleteConfirmId)} onCancel={() => setDeleteConfirmId(null)} />; })()}
      {showAiModal && <AiCreateModal onClose={() => setShowAiModal(false)} onUpload={handleAiCreateEvent} onGenerateFixtures={handleAiGenerateFixtures} isProcessing={aiProcessing} isGenerating={aiGeneratingFixtures} statsFeed={statsFeedSettings} />}
      {channelActionConfirm && (() => { const evt = activeEvents.find(e => e.id === channelActionConfirm.eventId); if (!evt) return null; return <ChannelActionConfirmModal event={evt} action={channelActionConfirm.action} onCancel={() => setChannelActionConfirm(null)} onConfirm={() => channelActionConfirm.action === 'start' ? handleChannelStart(evt.id) : handleChannelStop(evt.id)} />; })()}
    </div>
  );
}
