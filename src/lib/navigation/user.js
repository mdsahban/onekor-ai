import {
  UserCircle, SlidersHorizontal, Scale, ShieldCheck, Factory, Radar, ScanSearch,
  Plug, History, Boxes, LayoutGrid, Shapes, Signal, FileText, Eye, GitBranch,
  Network, Crosshair, Library, Rocket, FileBarChart, Ruler, FileSearch,
  ClipboardCheck, Bug, ScanLine, Play, ScrollText, ListChecks, FlaskConical,
  LayoutDashboard, PieChart, Gauge, Activity, FileCheck2, ShieldAlert,
  TrendingUp, Wrench, ListTodo, BadgeCheck, Gavel, UserCheck, Repeat, Shield,
  ToggleLeft, Monitor, Radio, Bell, Siren, Hammer, FolderKanban, Wand2,
  Settings2, TestTube, Upload, KeyRound, AlertTriangle,
} from 'lucide-react';

const feature = (id, name, icon, desc, status = 'soon') => ({ id, name, icon, desc, status });
const mod = (id, name, icon, features) => ({ id, name, icon, features });
const area = (id, name, icon, modules) => ({ id, name, icon, modules });

export default {
  id: 'user',
  name: 'User',
  short: 'User',
  icon: UserCircle,
  tagline: 'Discover, assess, secure and build AI across the organization',
  areas: [
    area('setup', 'Setup', SlidersHorizontal, [
      mod('ai-discovery', 'AI Discovery', Radar, [
        feature('connectors', 'Connectors', Plug, 'Browse and configure connectors for AI discovery.', 'live'),
        feature('ai-sources', 'AI Sources', Boxes, 'Manage configured discovery sources.', 'live'),
        feature('ai-detection', 'AI Detection', ScanSearch, 'Run detection and review detected AI signals, evidence and job status.', 'live'),
        feature('ai-enrichment', 'AI Enrichment', Wand2, 'Enrich discovered AI assets with metadata from sources, providers and AI analysis.', 'live'),
        feature('ai-inventory', 'AI Inventory', LayoutGrid, 'The canonical catalog of every discovered AI asset with full traceability.', 'live'),
        feature('ai-profile', 'AI Profile', FileText, 'A full 360° view of a single AI asset — identity, evidence, relationships and history.', 'live'),
      ]),
      mod('ai-attack', 'AI Attack', Crosshair, [
        feature('attack-library', 'Attack Library', Library, 'A library of attack scenarios for testing AI.'),
        feature('run-attack', 'Run Attack', Rocket, 'Launch a simulated attack against an AI asset.'),
        feature('attack-results', 'Attack Results', FileBarChart, 'Review outcomes from completed attack tests.'),
      ]),
      mod('ai-posture', 'AI Posture', ShieldCheck, [
        feature('posture-rules', 'Posture Rules', Ruler, 'Rules that define the expected security posture for AI.'),
        feature('posture-findings', 'Posture Findings', FileSearch, 'Gaps found when checking AI against posture rules.'),
        feature('posture-results', 'Posture Results', ClipboardCheck, 'Summary of posture checks across all AI assets.'),
      ]),
      mod('ai-vulnerability-assessment', 'AI Vulnerability Assessment', Bug, [
        feature('vulnerability-library', 'Vulnerability Library', Library, 'A library of known AI vulnerabilities to test for.'),
        feature('run-vulnerability-assessment', 'Run Assessment', ScanLine, 'Run a vulnerability assessment against an AI asset.'),
        feature('vulnerability-assessment-results', 'Assessment Results', FileBarChart, 'Review outcomes from vulnerability assessments.'),
      ]),
      mod('ai-assessment', 'AI Assessment', ClipboardCheck, [
        feature('assessment-library', 'Assessment Library', Library, 'A library of assessment templates for evaluating AI.'),
        feature('run-assessment', 'Run Assessment', Play, 'Launch an assessment against an AI asset.'),
        feature('assessment-results', 'Assessment Results', FileBarChart, 'Review outcomes from completed assessments.'),
      ]),
      mod('ai-policies', 'AI Policies', ScrollText, [
        feature('policy-library', 'Policy Library', Library, 'A central library of all AI policies.'),
        feature('policy-rules', 'Policy Rules', ListChecks, 'Individual rules that make up each policy.'),
        feature('policy-testing', 'Policy Testing', FlaskConical, 'Test policies against AI to check they are followed.'),
      ]),
    ]),
    area('ai-governance', 'AI Governance', Scale, [
      mod('dashboard', 'Dashboard', LayoutDashboard, [
        feature('governance-overview', 'Governance Overview', PieChart, 'A single view of your AI governance posture.'),
        feature('risk-overview', 'Risk Overview', Gauge, 'Current risk levels across every AI asset.'),
        feature('governance-activity', 'Governance Activity', Activity, 'Latest governance actions and changes.'),
      ]),
      mod('assess', 'Assess', FileCheck2, [
        feature('ai-risk', 'AI Risk', ShieldAlert, 'Overall risk score for each AI asset.'),
        feature('ai-impact', 'AI Impact', TrendingUp, 'Business and operational impact of each AI asset.'),
        feature('assessment-results', 'Assessment Results', FileBarChart, 'Outcomes from all governance assessments.'),
      ]),
      mod('remediate', 'Remediate', Wrench, [
        feature('findings', 'Findings', FileSearch, 'Issues found during assessments and monitoring.'),
        feature('remediation-actions', 'Remediation Actions', ListTodo, 'Steps taken to fix identified issues.'),
        feature('verification', 'Verification', BadgeCheck, 'Confirm that fixes resolved the original issues.'),
      ]),
      mod('govern', 'Govern', Gavel, [
        feature('ai-policies', 'AI Policies', ScrollText, 'Policies that guide acceptable AI use.'),
        feature('ai-ownership', 'AI Ownership', UserCheck, 'Who owns and is accountable for each AI asset.'),
        feature('ai-lifecycle', 'AI Lifecycle', Repeat, 'Track AI from idea through deployment to retirement.'),
      ]),
    ]),
    area('ai-security', 'AI Security', ShieldCheck, [
      mod('dashboard', 'Dashboard', LayoutDashboard, [
        feature('security-overview', 'Security Overview', ShieldCheck, 'A single view of your AI security posture.'),
        feature('threat-overview', 'Threat Overview', AlertTriangle, 'Active threats targeting your AI.'),
        feature('security-activity', 'Security Activity', Activity, 'Recent security events in real time.'),
      ]),
      mod('protect', 'Protect', Shield, [
        feature('ai-protection', 'AI Protection', ShieldCheck, 'Runtime protection for your AI in real time.'),
        feature('protection-policies', 'Protection Policies', ScrollText, 'Policies that decide what AI actions to allow or block.'),
        feature('protection-controls', 'Protection Controls', ToggleLeft, 'Toggle and configure individual protection controls.'),
      ]),
      mod('monitor', 'Monitor', Monitor, [
        feature('live-activity', 'Live Activity', Radio, 'Real-time view of what your AI is doing right now.'),
        feature('alerts', 'Alerts', Bell, 'Security alerts that need your attention.'),
        feature('incidents', 'Incidents', Siren, 'Active security incidents and their status.'),
      ]),
    ]),
    area('ai-factory', 'AI Factory', Factory, [
      mod('dashboard', 'Dashboard', LayoutDashboard, [
        feature('factory-overview', 'Factory Overview', PieChart, 'A single view of your AI factory.'),
        feature('ai-projects', 'AI Projects', FolderKanban, 'All AI build projects in one place.'),
        feature('factory-activity', 'Factory Activity', Activity, 'Latest factory actions and changes.'),
      ]),
      mod('build', 'Build', Hammer, [
        feature('ai-projects', 'AI Projects', FolderKanban, 'Create and manage AI build projects.'),
        feature('ai-builder', 'AI Builder', Wand2, 'Generate AI applications, agents and models.'),
        feature('ai-configuration', 'AI Configuration', Settings2, 'Configure settings for the AI you build.'),
      ]),
      mod('test', 'Test', FlaskConical, [
        feature('ai-testing', 'AI Testing', TestTube, 'Run functional and behavioral tests on your AI.'),
        feature('ai-security-testing', 'AI Security Testing', Bug, 'Test your AI against attacks and vulnerabilities.'),
        feature('ai-validation', 'AI Validation', BadgeCheck, 'Final checks before AI is approved for deployment.'),
      ]),
      mod('deploy', 'Deploy', Rocket, [
        feature('deployment', 'Deployment', Upload, 'Send your AI to a live environment.'),
        feature('ai-access', 'AI Access', KeyRound, 'Control who can reach and use your deployed AI.'),
        feature('deployment-history', 'Deployment History', History, 'Past deployments and their outcomes.'),
      ]),
    ]),
  ],
};