import https from 'node:https';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: Array<{ message: { content: string }; finish_reason: string }>;
  error?: { message: string };
}

// node:https instead of the OpenAI SDK to avoid the "premature close"
// error caused by undici in Next.js route handlers.
export async function callOpenAI(
  messages: ChatMessage[],
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    jsonMode?: boolean;
  },
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');

  const body = JSON.stringify({
    model: options?.model ?? 'gpt-4o',
    messages,
    max_tokens:  options?.maxTokens  ?? 1500,
    temperature: options?.temperature ?? 0.4,
    ...(options?.jsonMode && { response_format: { type: 'json_object' } }),
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.openai.com',
        path:     '/v1/chat/completions',
        method:   'POST',
        headers: {
          'Content-Type':   'application/json',
          Authorization:    `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Length': Buffer.byteLength(body),
        },
        keepAlive: false,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          try {
            const json = JSON.parse(data) as OpenAIResponse;
            if (json.error) { reject(new Error(json.error.message)); return; }
            resolve(json.choices?.[0]?.message?.content ?? '');
          } catch {
            reject(new Error(`Invalid OpenAI response: ${data.slice(0, 300)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
