import {
  Settings, Building2, KeyRound, Layers, Activity, Info, Database, Palette,
  Paintbrush, Image, AppWindow, Users, UserCog, UserCheck, History,
  ShieldCheck, BadgeCheck, Lock, UserPlus, Fingerprint, Settings2, Timer,
  ToggleLeft, SlidersHorizontal, Puzzle, Plug, Cloud, Signal, ScrollText,
  FileText, BarChart3, HeartPulse, Gauge, Server, ListTodo, Terminal,
  FileSearch, Monitor, Radio, Brain,
} from 'lucide-react';

const feature = (id, name, icon, desc, status = 'soon') => ({ id, name, icon, desc, status });
const mod = (id, name, icon, features) => ({ id, name, icon, features });
const area = (id, name, icon, modules) => ({ id, name, icon, modules });

export default {
  id: 'admin',
  name: 'Admin',
  short: 'Admin',
  icon: Settings,
  tagline: 'Manage organization, access, platform and operations',
  areas: [
    area('organization', 'Organization', Building2, [
      mod('organization', 'Organization', Building2, [
        feature('organization-details', 'Organization Details', Info, 'Your organization name, contact and identity.', 'live'),
        feature('tenant-details', 'Tenant Details', Database, 'Tenant configuration and multi-tenant settings.'),
      ]),
      mod('branding', 'Branding', Palette, [
        feature('site-branding', 'Site Branding', Paintbrush, 'Colors, fonts and overall workspace look.'),
        feature('logos', 'Logos', Image, 'Upload and manage your organization logos.'),
        feature('favicon', 'Favicon', AppWindow, 'The icon shown in browser tabs and bookmarks.'),
      ]),
    ]),
    area('access', 'Access', KeyRound, [
      mod('users', 'Users', Users, [
        feature('user-management', 'User Management', UserCog, 'Manage people who use this platform.'),
        feature('user-status', 'User Status', UserCheck, 'Active, suspended and pending user accounts.'),
        feature('user-activity', 'User Activity', History, 'Recent actions taken by each user.'),
      ]),
      mod('roles', 'Roles', ShieldCheck, [
        feature('roles', 'Roles', BadgeCheck, 'Define roles and what each role can do.'),
        feature('permissions', 'Permissions', Lock, 'Granular permissions for each role.'),
        feature('role-assignment', 'Role Assignment', UserPlus, 'Assign roles to individual users.'),
      ]),
      mod('authentication', 'Authentication', Fingerprint, [
        feature('sso', 'SSO', KeyRound, 'Single sign-on provider configuration.'),
        feature('authentication-settings', 'Authentication Settings', Settings2, 'How users sign in and verify their identity.'),
        feature('session-settings', 'Session Settings', Timer, 'Session length, timeout and renewal rules.'),
      ]),
    ]),
    area('platform', 'Platform', Layers, [
      mod('configuration', 'Configuration', Settings2, [
        feature('platform-settings', 'Platform Settings', Settings, 'General platform-wide settings.'),
        feature('feature-settings', 'Feature Settings', ToggleLeft, 'Enable or disable individual platform features.'),
        feature('system-defaults', 'System Defaults', SlidersHorizontal, 'Default values applied across the platform.'),
      ]),
      mod('integrations', 'Integrations', Puzzle, [
        feature('connectors', 'Connectors', Plug, 'Connect external data sources and services.'),
        feature('external-services', 'External Services', Cloud, 'Manage connections to outside platforms.'),
        feature('integration-status', 'Integration Status', Signal, 'Health and status of every integration.'),
        feature('llm-engines', 'LLM Engines', Brain, 'Configure and manage LLM engines for AI detection, classification, and analysis.', 'live'),
      ]),
      mod('licensing', 'Licensing', ScrollText, [
        feature('license-information', 'License Information', FileText, 'Your current license and plan details.'),
        feature('usage', 'Usage', BarChart3, 'How much of your licensed capacity is in use.'),
        feature('entitlements', 'Entitlements', BadgeCheck, 'Features and limits included in your plan.'),
      ]),
    ]),
    area('operations', 'Operations', Activity, [
      mod('system-health', 'System Health', HeartPulse, [
        feature('health-overview', 'Health Overview', Gauge, 'Overall health of the platform at a glance.'),
        feature('services', 'Services', Server, 'Status of each platform service.'),
        feature('jobs', 'Jobs', ListTodo, 'Background jobs and their run status.'),
      ]),
      mod('logs', 'Logs', Terminal, [
        feature('system-logs', 'System Logs', Terminal, 'Technical logs from platform services.'),
        feature('audit-logs', 'Audit Logs', FileSearch, 'A record of every important administrative action.'),
        feature('activity-logs', 'Activity Logs', Activity, 'User and system activity over time.'),
      ]),
      mod('sessions', 'Sessions', Monitor, [
        feature('active-sessions', 'Active Sessions', Radio, 'Users currently signed in to the platform.'),
        feature('session-history', 'Session History', History, 'Past user sessions and their outcomes.'),
        feature('session-controls', 'Session Controls', SlidersHorizontal, 'Rules for managing and ending sessions.'),
      ]),
    ]),
  ],
};