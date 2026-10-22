import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, RefreshCw, Loader2, ExternalLink, ShieldAlert,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Deterministic diagnostic fallback database
function getDeterministicAdvice(errorMsg = '', stage = '', connectorId = '') {
  const err = (errorMsg || '').toLowerCase();
  
  if (err.includes('no authentication method selected') || err.includes('unsupported authentication method')) {
    return {
      failedStage: stage || 'Configuration Validation',
      error: errorMsg || 'No authentication method selected.',
      likelyCause: 'The connection test request did not identify an authentication strategy.',
      confidence: 'High (~95%)',
      requiredPermission: 'Select a valid authentication method (Personal Access Token or GitHub App).',
      remediation: 'Ensure the Authentication option is chosen and required fields are populated before running the test.',
      docsUrl: connectorId === 'github' ? 'https://docs.github.com/en/authentication' : null,
      docsLabel: 'GitHub Authentication Documentation',
    };
  }

  if (err.includes('no personal access token') || err.includes('empty or too short') || err.includes('no api key')) {
    return {
      failedStage: stage || 'Authentication',
      error: errorMsg,
      likelyCause: 'Credential value is empty or missing.',
      confidence: 'High (~99%)',
      requiredPermission: connectorId === 'github' ? 'A valid GitHub Personal Access Token' : 'A valid API key',
      remediation: connectorId === 'github' ? 'Generate a token at github.com/settings/tokens and paste it into the token field.' : 'Paste your API key into the credential field.',
      docsUrl: connectorId === 'github' ? 'https://github.com/settings/tokens' : null,
      docsLabel: 'Generate GitHub Token',
    };
  }

  if (err.includes('401') || err.includes('invalid') || err.includes('expired') || err.includes('authentication failed')) {
    return {
      failedStage: stage || 'Authentication',
      error: errorMsg,
      likelyCause: 'The token was rejected by the provider. It is either invalid, expired, or was revoked.',
      confidence: 'High (~90%)',
      requiredPermission: 'Active, unexpired credentials with read permissions.',
      remediation: connectorId === 'github' 
        ? 'Generate a new personal access token with "repo" scope (classic) or "Contents: Read" (fine-grained), then update your connection.'
        : 'Generate a new API key in the provider developer console.',
      docsUrl: connectorId === 'github' ? 'https://github.com/settings/tokens' : null,
      docsLabel: 'GitHub Token Settings',
    };
  }

  if (err.includes('403') || err.includes('forbidden') || err.includes('permission') || err.includes('denied')) {
    return {
      failedStage: stage || 'Permissions / Access',
      error: errorMsg,
      likelyCause: 'Credentials are valid, but the account or token lacks authorization for the requested repository or organization.',
      confidence: 'High (~85%)',
      requiredPermission: connectorId === 'github' ? 'Repository read ("repo") and Organization membership ("read:org") scopes.' : 'Read access to models endpoint.',
      remediation: connectorId === 'github'
        ? 'Ensure your token has "repo" scope for private repositories. If accessing an enterprise organization, authorize the token for SAML SSO in GitHub.'
        : 'Verify that your API key has read permissions for the models API.',
      docsUrl: connectorId === 'github' ? 'https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-saml-single-sign-on/authorizing-a-personal-access-token-for-use-with-saml-single-sign-on' : null,
      docsLabel: 'Authorizing PAT for SAML SSO',
    };
  }

  if (err.includes('404') || err.includes('not found')) {
    return {
      failedStage: stage || 'Resource Visibility',
      error: errorMsg,
      likelyCause: 'The specified account, organization, or repository was not found or is invisible to your token.',
      confidence: 'Medium-High (~80%)',
      requiredPermission: 'Read access to the specified target organization or repository.',
      remediation: 'Double-check the organization name. If you only want to scan your personal repositories, leave the Organization field blank.',
      docsUrl: null,
      docsLabel: null,
    };
  }

  if (err.includes('rate limit') || err.includes('429')) {
    return {
      failedStage: stage || 'Rate Limit',
      error: errorMsg,
      likelyCause: 'The provider rate limit for this account or IP address has been reached.',
      confidence: 'High (~95%)',
      requiredPermission: 'Higher rate limit quota or waiting for reset window.',
      remediation: connectorId === 'github'
        ? 'Wait 15-60 minutes for the GitHub rate limit to reset, or switch to a GitHub App which provides 5,000–15,000 requests per hour.'
        : 'Wait for rate limit recovery or upgrade your tier with the provider.',
      docsUrl: connectorId === 'github' ? 'https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting' : null,
      docsLabel: 'GitHub Rate Limits Documentation',
    };
  }

  return {
    failedStage: stage || 'Connection Test',
    error: errorMsg || 'Connection failed',
    likelyCause: 'A network timeout, configuration error, or provider outage occurred.',
    confidence: 'Moderate (~60%)',
    requiredPermission: 'Stable outbound HTTPS connectivity and valid credentials.',
    remediation: 'Check network connectivity to the provider API, review settings, and retry.',
    docsUrl: null,
    docsLabel: null,
  };
}

export default function DiagnosticCard({ result, connectorId, onRetry }) {
  const [aiExplanation, setAiExplanation] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  if (!result || result.ok) return null;

  // Find the first failed step or fallback to main error
  const failedStep = result.steps?.find((s) => s.status === 'failed' || s.status === 'error');
  const errorMsg = result.error || result.message || failedStep?.message || 'Connection test failed.';
  const stageName = failedStep?.stage || 'Validation';

  // Use backend diagnostic if returned, else deterministic fallback
  const fallback = getDeterministicAdvice(errorMsg, stageName, connectorId);
  const diag = result.diagnostic || fallback;

  const handleAskAI = async () => {
    setLoadingAi(true);
    try {
      // NEVER send secrets/passwords/raw tokens to LLM!
      // Send ONLY the sanitized stage name and error message
      const sanitizedError = errorMsg.replace(/ghp_[A-Za-z0-9_]+/g, '[REDACTED_PAT]')
                                     .replace(/github_pat_[A-Za-z0-9_]+/g, '[REDACTED_PAT]')
                                     .replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED_KEY]')
                                     .replace(/-----BEGIN[^-]*-----[\s\S]*?-----END[^-]*-----/g, '[REDACTED_PRIVATE_KEY]');

      const prompt = `You are an enterprise AI discovery system connector diagnostic expert.
Explain this integration connection failure clearly, professionally, and concisely to an IT administrator:
- Connector: ${connectorId}
- Failed Stage: ${stageName}
- Error: ${sanitizedError}

Provide your response in 3 structured sections:
1. Likely Root Cause (with honest uncertainty if multiple possibilities exist)
2. Required Permission / Configuration Change
3. Actionable Remediation Step

Do NOT invent non-existent APIs or facts. Be precise, helpful, and concise.`;

      if (base44?.integrations?.Core?.InvokeLLM) {
        const response = await base44.integrations.Core.InvokeLLM({ prompt });
        setAiExplanation(typeof response === 'string' ? response : (response?.text || response?.result || JSON.stringify(response)));
      } else {
        setAiExplanation(
          `Analysis for ${connectorId} (${stageName}):\n\n` +
          `• Root Cause: ${diag.likely_cause}\n` +
          `• Required Scope: ${diag.required_permission || diag.required_action}\n` +
          `• Action: ${diag.remediation}`
        );
      }
    } catch (e) {
      setAiExplanation(
        `Automated Diagnostic Insight:\n\n` +
        `• Cause: ${diag.likely_cause}\n` +
        `• Required Action: ${diag.required_action || diag.required_permission}\n` +
        `• Next Step: ${diag.remediation}`
      );
    }
    setLoadingAi(false);
  };

  return (
    <div className="rounded-xl border border-red-200/80 bg-red-50/50 p-4 dark:border-red-900/60 dark:bg-red-950/20 space-y-3.5">
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-red-950 dark:text-red-200">
              Diagnostic Analysis: Connection Failed
            </h4>
            <Badge variant="outline" className="border-red-300 text-red-700 bg-red-100/50 text-[10px] dark:border-red-800 dark:text-red-300 dark:bg-red-950/40">
              {stageName}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-red-800 dark:text-red-300 font-mono break-words bg-red-100/60 dark:bg-red-950/40 p-2 rounded-md">
            {errorMsg}
          </p>
        </div>
      </div>

      {/* Structured diagnostic findings */}
      <div className="grid gap-2.5 rounded-lg border border-red-200/60 bg-white/70 p-3 text-xs dark:border-red-900/40 dark:bg-card/70">
        <div>
          <span className="font-semibold text-foreground">Likely Cause: </span>
          <span className="text-muted-foreground">{diag.likely_cause || fallback.likelyCause}</span>
        </div>
        <div>
          <span className="font-semibold text-foreground">Required Permission / Configuration: </span>
          <span className="text-muted-foreground">{diag.required_action || diag.required_permission || fallback.requiredPermission}</span>
        </div>
        <div>
          <span className="font-semibold text-foreground">Recommended Remediation: </span>
          <span className="text-muted-foreground">{diag.remediation || fallback.remediation}</span>
        </div>
        {fallback.docsUrl && (
          <div className="pt-1">
            <a
              href={fallback.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline text-xs"
            >
              {fallback.docsLabel || 'Documentation'} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>

      {/* AI Assistant Explanation Section */}
      {aiExplanation ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Diagnostic Explanation</span>
          </div>
          <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed text-xs">
            {aiExplanation}
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAskAI}
            disabled={loadingAi}
            className="text-xs text-primary hover:bg-primary/10 gap-1.5 h-8 px-2.5"
          >
            {loadingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
            {loadingAi ? 'Generating AI explanation…' : 'Explain Failure with AI Assistant'}
          </Button>

          {onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="text-xs gap-1.5 h-8"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry Test
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
