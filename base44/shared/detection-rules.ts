export const DEFAULT_RULES = [
  // Package dependencies — Python
  { name: 'OpenAI Python SDK', type: 'package', pattern: 'openai', severity: 'high', asset_type: 'ai_application', provider: 'openai', confidence: 'high', description: 'Detects the OpenAI Python SDK in package manifests.' },
  { name: 'Anthropic Python SDK', type: 'package', pattern: 'anthropic', severity: 'high', asset_type: 'ai_application', provider: 'anthropic', confidence: 'high', description: 'Detects the Anthropic Python SDK in package manifests.' },
  { name: 'Google GenAI SDK', type: 'package', pattern: 'google-generativeai', severity: 'high', asset_type: 'ai_application', provider: 'google', confidence: 'high', description: 'Detects the Google Generative AI SDK.' },
  { name: 'Google GenAI Client', type: 'package', pattern: 'google-genai', severity: 'high', asset_type: 'ai_application', provider: 'google', confidence: 'high', description: 'Detects the Google GenAI client library.' },
  { name: 'LangChain', type: 'package', pattern: 'langchain', severity: 'high', asset_type: 'ai_application', provider: 'langchain', confidence: 'high', description: 'Detects the LangChain framework.' },
  { name: 'LlamaIndex', type: 'package', pattern: 'llama-index', severity: 'high', asset_type: 'ai_application', provider: 'llamaindex', confidence: 'high', description: 'Detects the LlamaIndex framework.' },
  { name: 'AutoGen', type: 'package', pattern: 'autogen', severity: 'high', asset_type: 'ai_agent', provider: 'microsoft', confidence: 'high', description: 'Detects the Microsoft AutoGen agent framework.' },
  { name: 'CrewAI', type: 'package', pattern: 'crewai', severity: 'high', asset_type: 'ai_agent', provider: 'crewai', confidence: 'high', description: 'Detects the CrewAI agent framework.' },
  { name: 'Replicate SDK', type: 'package', pattern: 'replicate', severity: 'high', asset_type: 'ai_application', provider: 'replicate', confidence: 'high', description: 'Detects the Replicate Python SDK.' },
  { name: 'Hugging Face Transformers', type: 'package', pattern: 'transformers', severity: 'high', asset_type: 'ai_model', provider: 'huggingface', confidence: 'high', description: 'Detects the Hugging Face Transformers library.' },
  { name: 'Hugging Face Hub', type: 'package', pattern: 'huggingface-hub', severity: 'medium', asset_type: 'ai_model', provider: 'huggingface', confidence: 'medium', description: 'Detects the Hugging Face Hub client.' },
  { name: 'Azure OpenAI SDK', type: 'package', pattern: 'azure-ai-openai', severity: 'high', asset_type: 'ai_application', provider: 'azure', confidence: 'high', description: 'Detects the Azure OpenAI SDK.' },
  { name: 'MCP SDK', type: 'package', pattern: 'mcp', severity: 'medium', asset_type: 'ai_integration', provider: 'mcp', confidence: 'medium', description: 'Detects the Model Context Protocol SDK.' },
  { name: 'Vertex AI SDK', type: 'package', pattern: 'vertexai', severity: 'high', asset_type: 'ai_application', provider: 'google', confidence: 'high', description: 'Detects the Google Vertex AI SDK.' },
  { name: 'Bedrock SDK', type: 'package', pattern: 'boto3-bedrock', severity: 'medium', asset_type: 'ai_application', provider: 'aws', confidence: 'medium', description: 'Detects AWS Bedrock integration.' },
  { name: 'PyTorch', type: 'package', pattern: 'torch', severity: 'medium', asset_type: 'ai_model', provider: 'pytorch', confidence: 'medium', description: 'Detects PyTorch ML framework.' },
  { name: 'TensorFlow', type: 'package', pattern: 'tensorflow', severity: 'medium', asset_type: 'ai_model', provider: 'tensorflow', confidence: 'medium', description: 'Detects TensorFlow ML framework.' },

  // Package dependencies — Node.js
  { name: 'OpenAI Node SDK', type: 'package', pattern: 'openai', severity: 'high', asset_type: 'ai_application', provider: 'openai', confidence: 'high', description: 'Detects the OpenAI Node.js SDK.' },
  { name: 'Anthropic Node SDK', type: 'package', pattern: '@anthropic-ai/sdk', severity: 'high', asset_type: 'ai_application', provider: 'anthropic', confidence: 'high', description: 'Detects the Anthropic Node.js SDK.' },
  { name: 'AI SDK', type: 'package', pattern: 'ai', severity: 'medium', asset_type: 'ai_application', provider: 'vercel', confidence: 'medium', description: 'Detects the Vercel AI SDK.' },
  { name: 'LangChain JS', type: 'package', pattern: 'langchain', severity: 'high', asset_type: 'ai_application', provider: 'langchain', confidence: 'high', description: 'Detects LangChain.js.' },

  // Import patterns
  { name: 'OpenAI Import', type: 'import', pattern: 'import openai', severity: 'high', asset_type: 'ai_application', provider: 'openai', confidence: 'high', description: 'Detects OpenAI Python import.' },
  { name: 'Anthropic Import', type: 'import', pattern: 'import anthropic', severity: 'high', asset_type: 'ai_application', provider: 'anthropic', confidence: 'high', description: 'Detects Anthropic Python import.' },
  { name: 'LangChain Import', type: 'import', pattern: 'from langchain', severity: 'high', asset_type: 'ai_application', provider: 'langchain', confidence: 'high', description: 'Detects LangChain import.' },
  { name: 'OpenAI JS Import', type: 'import', pattern: "from 'openai'", severity: 'high', asset_type: 'ai_application', provider: 'openai', confidence: 'high', description: 'Detects OpenAI JS import.' },
  { name: 'Anthropic JS Import', type: 'import', pattern: "from '@anthropic-ai/sdk'", severity: 'high', asset_type: 'ai_application', provider: 'anthropic', confidence: 'high', description: 'Detects Anthropic JS import.' },

  // Config / environment variables
  { name: 'OpenAI API Key Config', type: 'config', pattern: 'OPENAI_API_KEY', severity: 'high', asset_type: 'ai_application', provider: 'openai', confidence: 'high', description: 'Detects OpenAI API key in configuration.' },
  { name: 'Anthropic API Key Config', type: 'config', pattern: 'ANTHROPIC_API_KEY', severity: 'high', asset_type: 'ai_application', provider: 'anthropic', confidence: 'high', description: 'Detects Anthropic API key in configuration.' },
  { name: 'Azure OpenAI Config', type: 'config', pattern: 'AZURE_OPENAI', severity: 'high', asset_type: 'ai_application', provider: 'azure', confidence: 'high', description: 'Detects Azure OpenAI configuration.' },
  { name: 'Replicate API Token Config', type: 'config', pattern: 'REPLICATE_API_TOKEN', severity: 'high', asset_type: 'ai_application', provider: 'replicate', confidence: 'high', description: 'Detects Replicate API token in configuration.' },
  { name: 'Hugging Face Token Config', type: 'config', pattern: 'HUGGINGFACE_API_TOKEN', severity: 'medium', asset_type: 'ai_model', provider: 'huggingface', confidence: 'medium', description: 'Detects Hugging Face API token.' },
  { name: 'Google AI API Key Config', type: 'config', pattern: 'GOOGLE_API_KEY', severity: 'medium', asset_type: 'ai_application', provider: 'google', confidence: 'medium', description: 'Detects Google AI API key (may also be non-AI).' },
  { name: 'Gemini API Key Config', type: 'config', pattern: 'GEMINI_API_KEY', severity: 'high', asset_type: 'ai_application', provider: 'google', confidence: 'high', description: 'Detects Gemini API key in configuration.' },

  // API endpoints
  { name: 'OpenAI API Endpoint', type: 'api_endpoint', pattern: 'api.openai.com', severity: 'high', asset_type: 'ai_api', provider: 'openai', confidence: 'high', description: 'Detects calls to the OpenAI API.' },
  { name: 'Anthropic API Endpoint', type: 'api_endpoint', pattern: 'api.anthropic.com', severity: 'high', asset_type: 'ai_api', provider: 'anthropic', confidence: 'high', description: 'Detects calls to the Anthropic API.' },
  { name: 'Azure OpenAI Endpoint', type: 'api_endpoint', pattern: 'openai.azure.com', severity: 'high', asset_type: 'ai_api', provider: 'azure', confidence: 'high', description: 'Detects Azure OpenAI endpoint usage.' },
  { name: 'Replicate API Endpoint', type: 'api_endpoint', pattern: 'api.replicate.com', severity: 'high', asset_type: 'ai_api', provider: 'replicate', confidence: 'high', description: 'Detects calls to the Replicate API.' },
  { name: 'Hugging Face API Endpoint', type: 'api_endpoint', pattern: 'huggingface.co', severity: 'medium', asset_type: 'ai_api', provider: 'huggingface', confidence: 'medium', description: 'Detects Hugging Face API usage.' },
  { name: 'Google AI API Endpoint', type: 'api_endpoint', pattern: 'generativelanguage.googleapis.com', severity: 'high', asset_type: 'ai_api', provider: 'google', confidence: 'high', description: 'Detects Google Generative AI API usage.' },

  // Model identifiers
  { name: 'GPT Model Reference', type: 'model_identifier', pattern: 'gpt-', severity: 'high', asset_type: 'ai_model', provider: 'openai', confidence: 'high', description: 'Detects GPT model references.' },
  { name: 'Claude Model Reference', type: 'model_identifier', pattern: 'claude-', severity: 'high', asset_type: 'ai_model', provider: 'anthropic', confidence: 'high', description: 'Detects Claude model references.' },
  { name: 'Gemini Model Reference', type: 'model_identifier', pattern: 'gemini', severity: 'high', asset_type: 'ai_model', provider: 'google', confidence: 'high', description: 'Detects Gemini model references.' },
  { name: 'Llama Model Reference', type: 'model_identifier', pattern: 'llama', severity: 'medium', asset_type: 'ai_model', provider: 'meta', confidence: 'medium', description: 'Detects Llama model references.' },
  { name: 'Mistral Model Reference', type: 'model_identifier', pattern: 'mistral', severity: 'medium', asset_type: 'ai_model', provider: 'mistral', confidence: 'medium', description: 'Detects Mistral model references.' },
];