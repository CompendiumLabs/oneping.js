// whisper

import { AudioRecorder, transcribe, OPENAI_URL, LOCAL_URL } from '../src/audio.js';
import { ApiKeyWidget, h } from '../src/utils.js';

// init objects
const recorder = new AudioRecorder();

// ui objects
const output = document.getElementById('output');
const circle = document.getElementById('status');

// make a new message box
function makeMessage(timestamp, text) {
    const time = h('span', { cls: [
        'italic', 'w-[120px]', 'min-w-[120px]', 'text-center', 'py-1', 'px-2',
        'border-r', 'border-gray-300', 'rounded-l', 'bg-gray-100'
    ] }, timestamp);
    const content = h('span', { cls: [
        'py-1', 'px-2', 'rounded-r'
    ] }, text);
    const message = h('div', { cls: [
        'flex', 'flex-row', 'border', 'rounded', 'border-gray-300'
    ] }, [time, content]);
    return message;
}

// get transcription arguments
function get_trans_args() {
    const url = localStorage.getItem('whisper-url');
    const api_key = widget.get_api_key();
    return { url, api_key };
}

// record action
let recording = false;
document.addEventListener('keydown', async (event) => {
    if (!recording && event.key == ' ') {
        // go to recording state
        recording = true;
        const timestamp = new Date().toLocaleTimeString();

        // record audio
        circle.classList.add('recording');
        const audio = await recorder.startRecording({ decode: false });
        circle.classList.remove('recording');

        if (audio != null) {
            // transcribe audio
            circle.classList.add('transcribing');
            const args = get_trans_args();
            const text = await transcribe(audio, args);
            console.log(`transcribe: ${text}`);
            circle.classList.remove('transcribing');

            // display text
            const message = makeMessage(timestamp, text);
            output.appendChild(message);
            output.scrollTop = output.scrollHeight;
        }

        // back to normal state
        recording = false;
    }
});

document.addEventListener('keyup', async (event) => {
    if (recording && event.key == ' ') {
        recorder.stopRecording();
    }
});

//
// configuration
//

// get ui elements
const control = document.getElementById('control');
const api_input = control.querySelector('#key-input');
const api_button = control.querySelector('#key-button');
const url_input = control.querySelector('#url-input');
const url_button = control.querySelector('#url-button');

// create api key widget
const widget = new ApiKeyWidget(api_input, api_button);
widget.set_provider('openai');

// set url from storage
const url_initial = localStorage.getItem('whisper-url');
url_input.value = url_initial ?? OPENAI_URL;
if (url_initial == OPENAI_URL) {
    url_button.textContent = 'Local';
} else {
    url_button.textContent = 'OpenAI';
}

// handle F1 toggle
document.addEventListener('keydown', (event) => {
    if (event.key === 'F1') {
        control.classList.toggle('hidden');
    }
});

// handle set openai/local
url_button.addEventListener('click', () => {
    const label = url_button.textContent;
    if (label == 'OpenAI') {
        url_input.value = OPENAI_URL;
        url_button.textContent = 'Local';
    } else {
        url_input.value = LOCAL_URL;
        url_button.textContent = 'OpenAI';
    }
    const url = url_input.value;
    localStorage.setItem('whisper-url', url);
});

// handle url input
url_input.addEventListener('input', () => {
    const url = url_input.value;
    localStorage.setItem('whisper-url', url);
});
