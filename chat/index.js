// client-side chat interface

import { Chat, PROVIDERS } from '../src/curl.js';
import { ApiKeyWidget, get_api_key, h } from '../src/utils.js';

//
// constants
//

const system = 'You are a helpful assistant that loves to use emojis.';

//
// ui elements
//

const chat_box = document.querySelector('#chat-box');
const query_box = document.querySelector('#query-box');
const query = document.querySelector('#query');
const control = document.querySelector('#control');
const key_input = document.querySelector('#key-input');
const key_button = document.querySelector('#key-button');
const prov_input = document.querySelector('#prov-input');
const prov_button = document.querySelector('#prov-button');

function make_message(role, content, system=false) {
    const content_cls = system ? ['italic'] : [];
    const role_span = h('span', { cls: [
        'relative', 'top-[-5px]', 'p-2', 'small-caps'
    ] }, role);
    const role_box = h('div', { cls: [
        'absolute', 'top-[-10px]', 'left-[10px]', 'h-[20px]', 'border', 'rounded', 'border-gray-500', 'bg-white'
    ] }, role_span);
    const content_box = h('div', { cls: [
        'message-content', 'w-full', 'p-1', ...content_cls
    ] }, content);
    return h('div', { cls: [
        'relative', 'border', 'border-gray-300', 'rounded', 'p-2', 'bg-gray-100'
    ] }, [role_box, content_box]);
}

//
// utilities
//

function get_provider() {
    return localStorage.getItem('chat-provider');
}

function is_valid_provider(provider) {
    return PROVIDERS.includes(provider);
}

// update valid indicator
function set_valid_provider(valid) {
    prov_button.textContent = valid ? '✓' : '✗';
    prov_button.classList.toggle('text-green-500', valid);
    prov_button.classList.toggle('text-red-500', !valid);
}

function set_provider(provider) {
    localStorage.setItem('chat-provider', provider);
    if (is_valid_provider(provider)) {
        set_valid_provider(true);
        widget.set_provider(provider);
    } else {
        set_valid_provider(false);
        widget.set_provider(null);
    }
}

// get query arguments
function get_query_args() {
    const provider = get_provider();
    const api_key = get_api_key(provider);
    return { provider, system, api_key };
}

//
// event handlers
//

// handle keypress
query.addEventListener('keypress', async (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();

        // hide query box
        query_box.classList.add('hidden');

        // add user query message
        const query_value = query.value;
        const sent = make_message('user', query_value);
        chat_box.insertBefore(sent, query_box);
        query.value = '';

        // add assistant response
        const reply = make_message('assistant', '');
        chat_box.insertBefore(reply, query_box);

        // set up reply box
        const reply_box = reply.querySelector('.message-content');
        let text = '';

        // get response and add to chat
        const args = get_query_args();
        const response = chat.stream(query_value, args);
        for await (const chunk of response) {
            text += chunk;
            reply_box.innerHTML = await md.marked(text);
        }

        // show query box
        query_box.classList.remove('hidden');
        query.focus();
    }
});

// handle F1 config
document.addEventListener('keydown', (event) => {
    if (event.key === 'F1') {
        control.classList.toggle('hidden');
    }
});

// handle provider input
prov_input.addEventListener('input', () => {
    const provider = prov_input.value;
    set_provider(provider);
});

//
// configuration
//

// get stored provider
const provider = get_provider() ?? 'anthropic';
const widget = new ApiKeyWidget(key_input, key_button);

// apply to control ui
prov_input.value = provider;
set_provider(provider);

//
// main
//

// make chatterbox
const chat = new Chat(system);

// prepend system message
const system_box = make_message('system', system, true);
chat_box.insertBefore(system_box, query_box);

// set focus
query.focus();
