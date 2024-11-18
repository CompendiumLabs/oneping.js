// storage

//
// key management
//

function get_api_key(provider) {
    return localStorage.getItem(`${provider}-api-key`);
}

function has_api_key(provider) {
    return get_api_key(provider) != null;
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

class ApiKeyWidget {
    constructor(input, button) {
        this.input = input;
        this.button = button;
        this.set_provider(null);
        this.connect_handlers();
    }

    // set provider and update state
    set_provider(provider) {
        this.provider = provider;
        this.is_valid = provider != null;
        this.is_set = this.is_valid && has_api_key(provider);
        this.update_state();
    }

    get_api_key() {
        return get_api_key(this.provider);
    }

    // get masked api key
    masked_api_key() {
        const api_key = this.get_api_key();
        return '*'.repeat(api_key.length);
    }

    // set input/button state
    update_state() {
        if (this.is_valid) {
            if (this.is_set) {
                this.button.textContent = 'Clear';
                this.button.disabled = false;
                this.input.value = this.masked_api_key();
                this.input.disabled = true;
            } else {
                this.button.textContent = 'Store';
                this.button.disabled = false;
                this.input.value = '';
                this.input.disabled = false;
            }
        } else {
            this.button.textContent = '';
            this.button.disabled = true;
            this.input.value = '';
            this.input.disabled = true;
        }
    }

    // button click handler
    connect_handlers() {
        this.button.addEventListener('click', (event) => {
            if (this.is_set) {
                clear_api_key(this.provider);
                this.is_set = false;
            } else {
                const value = this.input.value;
                if (value.length > 0) {
                    set_api_key(this.provider, value);
                    this.is_set = true;
                }
            }
            this.update_state();
        });
    }
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
    if (typeof children === 'string') {
        elem.innerHTML = children;
    } else {
        children = Array.isArray(children) ? children : [children];
        for (const child of children) {
            elem.append(child);
        }
    }

    // return element
    return elem;
}

//
// exports
//

export { get_api_key, set_api_key, clear_api_key, ApiKeyWidget, h };
