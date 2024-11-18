// storage

//
// key management
//

function get_api_key(provider) {
    return localStorage.getItem(`${provider}-api-key`);
}

function set_api_key(provider, api_key) {
    localStorage.setItem(`${provider}-api-key`, api_key);
}

function clear_api_key(provider) {
    localStorage.removeItem(`${provider}-api-key`);
}

//
// api key widget
//

function mask_api_key(api_key) {
    return '*'.repeat(api_key.length);
}

function api_key_widget(provider, input, button) {
    // state variable
    let api_key = get_api_key(provider);
    let is_set = api_key != null;

    // set initial button text
    if (is_set) {
        button.textContent = 'Clear';
        input.value = mask_api_key(api_key);
        input.disabled = true;
    }

    // click handler
    button.addEventListener('click', (event) => {
        if (is_set) {
            clear_api_key(provider);
            is_set = false;
            input.value = '';
            input.disabled = false;
            button.textContent = 'Store';
        } else {
            const value = input.value;
            if (value.length > 0) {
                set_api_key(provider, value);
                is_set = true;
                input.value = mask_api_key(value);
                input.disabled = true;
                button.textContent = 'Clear';
            }
        }
    });
}

//
// element maker
//

function h(tag, args, children) {
    let { style, cls, ...attrs } = args ?? {};
    children = children ?? [];

    // create element
    const elem = document.createElement(tag);

    // add classes
    if (cls != null) {
        cls = Array.isArray(cls) ? cls : cls.split(' ');
        elem.classList.add(...cls);
    }

    // add styles
    for (const [key, value] of Object.entries(style ?? {})) {
        elem.style[key] = value;
    }

    // add attributes
    for (const [key, value] of Object.entries(attrs)) {
        elem[key] = value;
    }

    // add children
    children = Array.isArray(children) ? children : [children];
    for (const child of children) {
        elem.append(child);
    }

    // return element
    return elem;
}

//
// exports
//

export { get_api_key, set_api_key, clear_api_key, api_key_widget, h };
