// AI Proxy Service - Routes AI requests through AWS Lambda
// This keeps your API key secure on the server and helps manage rate limits
import { post } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import { isAWSConfigured } from './amplifyConfigure';

const API_NAME = 'healthTrackerApi';

// Direct AIML API (fallback when AWS not configured)
const AIML_API_BASE = 'https://api.aimlapi.com/v1/chat/completions';
const AIML_API_KEY = '07ca0cb8d6e1417ba82420fdc3054fc6';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  content: string;
  error?: string;
}

// Check if we can use AWS proxy
const canUseProxy = async (): Promise<boolean> => {
  if (!isAWSConfigured()) return false;
  
  try {
    const session = await fetchAuthSession();
    return !!session.tokens;
  } catch {
    return false;
  }
};

// Send chat via AWS Lambda proxy (rate limit managed server-side)
const sendViaProxy = async (
  messages: ChatMessage[],
  healthContext: string
): Promise<ChatResponse> => {
  try {
    const response = await post({
      apiName: API_NAME,
      path: '/ai/chat',
      options: {
        body: JSON.stringify({
          messages,
          healthContext,
          model: 'gpt-4o-mini',
          maxTokens: 500,
        }) as any,
      },
    });

    const data = await (response as any).response;
    const body = await data.body.json();

    if (body.error) {
      return { content: '', error: body.error };
    }

    return { content: body.content || '' };
  } catch (error: any) {
    return { content: '', error: error.message || 'Proxy request failed' };
  }
};

// Send chat directly to AIML API (fallback)
const sendDirect = async (
  messages: ChatMessage[],
  healthContext: string
): Promise<ChatResponse> => {
  try {
    const systemPrompt = 
      'You are a warm, supportive AI health coach helping someone on their weight loss journey with Zepbound (tirzepatide). Be encouraging, helpful, and concise. Use a friendly tone with occasional emojis. Give evidence-based advice. Keep responses under 150 words unless the user asks for detail.' +
      (healthContext ? '\n\nUser health data: ' + healthContext : '');

    const response = await fetch(AIML_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AIML_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { content: '', error: `API error ${response.status}: ${errorText}` };
    }

    const result = await response.json();
    return {
      content: result.choices?.[0]?.message?.content || '',
    };
  } catch (error: any) {
    return { content: '', error: error.message || 'Request failed' };
  }
};

// Main function - uses proxy if available, falls back to direct
export const sendAIChat = async (
  messages: ChatMessage[],
  healthContext: string
): Promise<ChatResponse> => {
  const useProxy = await canUseProxy();
  
  if (useProxy) {
    const proxyResult = await sendViaProxy(messages, healthContext);
    // If proxy fails, fall back to direct
    if (proxyResult.error) {
      console.log('Proxy failed, falling back to direct:', proxyResult.error);
      return sendDirect(messages, healthContext);
    }
    return proxyResult;
  }
  
  return sendDirect(messages, healthContext);
};

// Get remaining rate limit (only available via proxy)
export const getRateLimitStatus = async (): Promise<{
  remaining: number;
  resetsAt: Date | null;
} | null> => {
  if (!(await canUseProxy())) return null;

  try {
    const response = await post({
      apiName: API_NAME,
      path: '/ai/status',
      options: { body: {} },
    });

    const data = await (response as any).response;
    const body = await data.body.json();

    return {
      remaining: body.remaining || 10,
      resetsAt: body.resetsAt ? new Date(body.resetsAt) : null,
    };
  } catch {
    return null;
  }
};
