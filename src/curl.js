// a javascript mini-library for making chat completion requests to an LLM provider

// general utilities

function robust_parse(json) {
    try {
        return JSON.parse(json);
    } catch (e) {
        console.error(e);
        console.log(json);
        return null;
    }
}

async function* buffer_sse(stream) {
    let buf = ''
    for await (const chunk of stream) {
        buf += chunk
        let boundary;
        while ((boundary = buf.indexOf('\n')) >= 0) {
            yield buf.slice(0, boundary)
            buf = buf.slice(boundary + 1)
        }
    }
    if (buf.length > 0) {
        yield buf
    }
}

const reg_data = new RegExp('^data: (.*)$');
async function* parse_sse(stream) {
    for await (const line of stream) {
        const match = reg_data.exec(line)
        if (match == null) continue;
        const [_, data] = match;
        if (data == '[DONE]') return;
        yield robust_parse(data);
    }
}

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
// contents
//

function convert_image(image) {
    const match = image.match(/^data:(\w+);base64,(.*)$/);
    if (match != null) {
        const [_, type, data] = match;
        return { type, data };
    } else {
        throw new Error(`Unsupported image string: ${image}`);
    }
}

function content_openai(text, image=null) {
    if (image == null) return text;
    return [
        { type: 'image_url', image_url: image },
        { type: 'text', text },
    ];
}

function content_anthropic(text, image=null) {
    if (image == null) return text;
    const { type, data } = convert_image(image);
    const source = { type: 'base64', media_type: type, data };
    return [
        { type: 'image', source },
        { type: 'text', text },
    ];
}

function content_oneping(text, image=null) {
    if (image == null) return text;
    return { image, text };
}

//
// payloads
//

function payload_openai(content, args) {
    const { system, history, prefill } = args ?? {};
    let messages = [];
    if (system != null) {
        messages.push({ role: 'system', content: system });
    }
    if (history != null) {
        messages.push(...history);
    }
    messages.push({ role: 'user', content });
    if (prefill != null) {
        messages.push({ role: 'assistant', content: prefill });
    }
    let payload = { messages };
    return payload;
}

function payload_anthropic(content, args) {
    const { system, history, prefill } = args ?? {};
    let messages = [];
    if (history != null) {
        messages.push(...history);
    }
    messages.push({ role: 'user', content });
    if (prefill != null) {
        messages.push({ role: 'assistant', content: prefill });
    }
    let payload = { messages };
    if (system != null) {
        payload.system = [ {
            type: 'text',
            text: system,
            cache_control: { type: 'ephemeral' },
        } ];
    }
    return payload;
}

function payload_oneping(content, args) {
    if (typeof content == 'string') return { query: content, ...args };
    const { text, image } = content;
    return { query: text, image, ...args };
}

//
// response handlers
//

function response_oneping(response) {
    const { success, data } = response;
    if (!success) {
        throw new Error(`Error from oneping:\n\n${data}`);
    }
    return data;
}

function response_openai(response) {
    return response.choices[0].message.content;
}

function response_anthropic(response) {
    return response.content[0].text;
}

function stream_oneping(chunk) {
    return chunk;
}

function stream_openai(chunk) {
    return chunk.choices[0].delta.content;
}

function stream_anthropic(chunk) {
    if (chunk.type == 'content_block_delta') {
        return chunk.delta.text;
    }
}

//
// providers
//

const DEFAULT_PROVIDER = {
    chat_path: 'chat/completions',
    embed_path: 'embeddings',
    transcribe_path: 'audio/transcriptions',
    authorize: authorize_openai,
    content: content_openai,
    payload: payload_openai,
    response: response_openai,
    stream: stream_openai,
}

const providers = {
    local: {
        base_url: 'http://localhost:8000',
        authorize: null,
    },
    oneping: {
        base_url: 'http://localhost:5000',
        chat_path: 'chat',
        authorize: null,
        max_tokens_name: 'max_tokens',
        content: content_oneping,
        payload: payload_oneping,
        response: response_oneping,
        stream: stream_oneping,
    },
    openai: {
        base_url: 'https://api.openai.com/v1',
        chat_model: 'gpt-4o',
        embed_model: 'text-embedding-3-large',
        transcribe_model: 'gpt-4o-transcribe',
    },
    anthropic: {
        base_url: 'https://api.anthropic.com/v1',
        chat_path: 'messages',
        max_tokens_name: 'max_tokens',
        authorize: authorize_anthropic,
        content: content_anthropic,
        payload: payload_anthropic,
        response: response_anthropic,
        stream: stream_anthropic,
        chat_model: 'claude-3-7-sonnet-latest',
        headers: {
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        },
    },
    google: {
        base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
        chat_model: 'gemini-2.5-flash',
        embed_model: 'gemini-embedding-exp-03-07',
    },
    xai: {
        base_url: 'https://api.x.ai/v1',
        chat_model: 'grok-4',
    },
    fireworks: {
        base_url: 'https://api.fireworks.ai/inference/v1',
        model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
    },
    groq: {
        base_url: 'https://api.groq.com/openai/v1',
        model: 'llama-3.1-70b-versatile',
    },
    deepseek: {
        base_url: 'https://api.deepseek.com',
        model: 'deepseek-chat',
    },
};

function get_provider(provider, args) {
    const pdata = provider ? providers[provider] : {};
    return { ...DEFAULT_PROVIDER, ...pdata, ...args };
}

//
// payloads
//

function prepare_url(prov, path_key) {
    const { base_url, [path_key]: path } = prov;
    return `${base_url}/${path}`;
}

// converts history from oneping { text, image } format to provider format
function convert_history(history, content_func) {
    return history.map(h => {
        const { role, content } = h;
        const { text, image } = (typeof content == 'string') ? { text: content } : content;
        return { role, content: content_func(text, image) };
    });
}

function prepare_request(query, args) {
    let {
        provider: pname, system, history, image, prefill, prediction,
        max_tokens, api_key, stream, ...pargs
    } = args ?? {};
    pname = pname ?? 'local';
    stream = stream ?? false;

    // get request url
    const provider = get_provider(pname, pargs);
    const url = prepare_url(provider, 'chat_path');

    // check authorization
    if (provider.authorize != null && api_key == null) {
        throw new Error('API key is required');
    }

    // get extra parameters
    const head = provider.headers ?? {};
    const body = provider.body ?? {};

    // get provider parameters
    const model = provider.chat_model ? { model: provider.chat_model } : {};
    const authorize = provider.authorize ? provider.authorize(api_key) : {};

    // get generation parameters
    const max_tokens_name = provider.max_tokens_name ?? 'max_completion_tokens';
    const toks = { [max_tokens_name]: max_tokens ?? null };
    const predict = prediction ? { prediction } : {};

    // convert history to provider format
    history = (history != null) ? convert_history(history, provider.content) : null;

    // make message payload
    const content = provider.content(query, image);
    const message = provider.payload(content, { system, history, prefill });

    // compose request
    const headers = { 'Content-Type': 'application/json', ...authorize, ...head };
    const payload = { ...message, ...model, ...toks, ...predict, stream, ...body };

    // relevant parameters
    return { provider, url, headers, payload };
}

//
// reply
//

async function reply(query, args) {
    // get provider settings
    const { provider, url, headers, payload } = prepare_request(query, args);

    // make request
    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
    });
    const data = await response.json();

    // check status
    if (!response.ok) {
        throw new Error(`Status ${response.status}: ${JSON.stringify(data)}`);
    }

    // extract text
    const text = provider.response(data);
    if (text == null || text.length == 0) {
        throw new Error(`Empty response from provider: ${JSON.stringify(data)}`);
    }

    // return text
    return text;
}

//
// stream
//

async function* stream(query, args) {
    // prepare request
    const args1 = { ...args, stream: true };
    const { provider, url, headers, payload } = prepare_request(query, args1);

    // make request
    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
    });

    // check status
    if (!response.ok) {
        const data = await response.json();
        throw new Error(`Status ${response.status}: ${data.message}`);
    }

    // stream decode and parse
    const stream = response.body.pipeThrough(new TextDecoderStream())
    const lines = buffer_sse(stream);
    const chunks = parse_sse(lines);

    // process stream one chunk at a time
    for await (const data of chunks) {
        const text = provider.stream(data);
        if (text != null) yield text;
    }
}

//
// chat
//

class Chat {
    constructor(system, args) {
        this.system = system;
        this.args = args ?? {};
        this.history = [];
    }

    async reply(query, args) {
        const { image } = args ?? {};
        const text = await reply(query, {
            system: this.system, history: this.history, ...this.args, ...args
        });
        this.history.push({ role: 'user', content: content_oneping(query, image) });
        this.history.push({ role: 'assistant', content: text });
        return text;
    }

    async* stream(query, args) {
        const { image } = args ?? {};
        let text = '';
        const response = stream(query, {
            system: this.system, history: this.history, ...this.args, ...args
        });
        for await (const chunk of response) {
            text += chunk;
            yield chunk;
        }
        this.history.push({ role: 'user', content: content_oneping(query, image) });
        this.history.push({ role: 'assistant', content: text });
    }
}

//
// exports
//

export { reply, stream, Chat, providers };
