// a javascript mini-library for making chat completion requests to an LLM provider

//
// authorization
//

function authorize_openai(apiKey) {
    return { 'Authorization': `Bearer ${apiKey}` };
}

function authorize_anthropic(apiKey) {
    return { 'x-api-key': apiKey };
}

//
// payloads
//

function payload_openai(query, args) {
    const { system, history, prefill } = args ?? {};
    let messages = [];
    if (system != null) {
        messages.push({ role: 'system', content: system });
    }
    if (history != null) {
        messages.push(...history);
    }
    messages.push({ role: 'user', content: query });
    if (prefill != null) {
        messages.push({ role: 'assistant', content: prefill });
    }
    let payload = { messages };
    return payload;
}

function payload_anthropic(query, args) {
    const { system, history, prefill } = args ?? {};
    let messages = [];
    if (history != null) {
        messages.push(...history);
    }
    messages.push({ role: 'user', content: query });
    if (prefill != null) {
        messages.push({ role: 'assistant', content: prefill });
    }
    let payload = { messages };
    if (system != null) {
        payload.system = system;
    }
    return payload;
}

//
// extractors
//

function extractor_openai(response) {
    return response.choices[0].message.content;
}

function extractor_anthropic(response) {
    return response.content[0].text;
}

//
// providers
//

const DEFAULT_PROVIDER = {
    payload: payload_openai,
    response: extractor_openai,
}

const providers = {
    local: {
        url: port => `http://localhost:${port}/v1/chat/completions`,
        port: 8000,
    },
    openai: {
        url: 'https://api.openai.com/v1/chat/completions',
        authorize: authorize_openai,
        model: 'gpt-4o',
        max_tokens_name: 'max_completion_tokens',
    },
    anthropic: {
        url: 'https://api.anthropic.com/v1/messages',
        authorize: authorize_anthropic,
        payload: payload_anthropic,
        response: extractor_anthropic,
        model: 'claude-3-5-sonnet-latest',
        extra: {
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'prompt-caching-2024-07-31',
            'anthropic-dangerous-direct-browser-access': 'true',
        },
    },
    fireworks: {
        url: 'https://api.fireworks.ai/inference/v1/chat/completions',
        model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
    },
    groq: {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.1-70b-versatile',
    },
};
const PROVIDERS = Object.keys(providers);

function get_provider(provider, args) {
    args = args ?? {};
    return { ...DEFAULT_PROVIDER, ...providers[provider], ...args };
}

function host_url(url, port) {
    return (typeof url === 'function') ? url(port) : url;
}

//
// reply
//

async function reply(query, args) {
    let { provider, system, history, prefill, max_tokens, api_key, ...pargs } = args ?? {};
    max_tokens = max_tokens ?? 1024;

    // get provider settings
    provider = get_provider(provider ?? 'local', pargs);
    const url = host_url(provider.url, provider.port);

    // check authorization
    if (provider.authorize != null && api_key == null) {
        throw new Error('API key is required');
    }

    // get request params
    const extra = provider.extra ?? {};
    const model = provider.model ? { model: provider.model } : {};
    const max_tokens_name = provider.max_tokens_name ?? 'max_tokens';
    const authorize = provider.authorize ? provider.authorize(api_key) : {};
    const message = provider.payload(query, { system, history, prefill });

    // prepare request
    const headers = { 'Content-Type': 'application/json', ...authorize, ...extra };
    const payload = { ...message, ...model, [max_tokens_name]: max_tokens };

    // make request
    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
    });
    const data = await response.json();

    // check status
    if (!response.ok) {
        throw new Error(`Status ${response.status}: ${data.error.message}`);
    }

    // return json data
    return provider.response(data);
}

class Chat {
    constructor(system, args) {
        this.system = system;
        this.args = args ?? {};
        this.history = [];
    }

    async reply(query, args) {
        const text = await reply(query, {
            system: this.system, history: this.history, ...this.args, ...args
        });
        this.history.push({ role: 'user', content: query });
        this.history.push({ role: 'assistant', content: text });
        return text;
    }
}

//
// exports
//

export { reply, Chat, PROVIDERS };
