/**
 * AWS Lambda Function Template - AI Chat Proxy
 * 
 * Deploy this to AWS Lambda to securely proxy AI requests.
 * This keeps your API key on the server and manages rate limits per user.
 * 
 * SETUP:
 * 1. Create a new Lambda function in AWS Console
 * 2. Copy this code into the function
 * 3. Set environment variable: AIML_API_KEY = your key
 * 4. Create an API Gateway trigger
 * 5. Update amplifyConfigure.ts with your API endpoint
 */

// Environment variables (set in AWS Console)
const AIML_API_KEY = process.env.AIML_API_KEY || '';
const RATE_LIMIT_PER_HOUR = 10;

// Simple in-memory rate limiting (use DynamoDB for production)
const rateLimits = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const hourAgo = now - (60 * 60 * 1000);
  
  const userLimits = rateLimits.get(userId) || [];
  const recentRequests = userLimits.filter(time => time > hourAgo);
  
  if (recentRequests.length >= RATE_LIMIT_PER_HOUR) {
    const oldestRequest = Math.min(...recentRequests);
    const resetsAt = new Date(oldestRequest + (60 * 60 * 1000));
    return {
      allowed: false,
      remaining: 0,
      resetsAt: resetsAt.toISOString(),
    };
  }
  
  recentRequests.push(now);
  rateLimits.set(userId, recentRequests);
  
  return {
    allowed: true,
    remaining: RATE_LIMIT_PER_HOUR - recentRequests.length,
    resetsAt: new Date(now + (60 * 60 * 1000)).toISOString(),
  };
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const path = event.path || event.rawPath || '';
    
    // Get user ID from Cognito authorizer
    const userId = event.requestContext?.authorizer?.claims?.sub || 'anonymous';

    // Check rate limit status endpoint
    if (path.endsWith('/ai/status')) {
      const limit = checkRateLimit(userId);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          remaining: limit.remaining,
          resetsAt: limit.resetsAt,
          limit: RATE_LIMIT_PER_HOUR,
        }),
      };
    }

    // AI Chat endpoint
    if (path.endsWith('/ai/chat')) {
      // Check rate limit
      const limit = checkRateLimit(userId);
      if (!limit.allowed) {
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({
            error: 'Rate limit exceeded. Try again after ' + limit.resetsAt,
            remaining: 0,
            resetsAt: limit.resetsAt,
          }),
        };
      }

      const { messages, healthContext, model, maxTokens } = body;

      // Build system prompt
      const systemPrompt = 
        'You are a warm, supportive AI health coach helping someone on their weight loss journey with Zepbound (tirzepatide). Be encouraging, helpful, and concise. Use a friendly tone with occasional emojis. Give evidence-based advice. Keep responses under 150 words unless the user asks for detail.' +
        (healthContext ? '\n\nUser health data: ' + healthContext : '');

      // Call AIML API
      const response = await fetch('https://api.aimlapi.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AIML_API_KEY}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
          temperature: 0.7,
          max_tokens: maxTokens || 500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          statusCode: response.status,
          headers,
          body: JSON.stringify({ error: `API error: ${errorText}` }),
        };
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || '';

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          content,
          remaining: limit.remaining,
        }),
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' }),
    };

  } catch (error) {
    console.error('Lambda error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
