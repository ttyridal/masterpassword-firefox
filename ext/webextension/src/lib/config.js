"use strict;"

class Config {
    constructor() {
        console.log("calling constructor");
        this._cache = {};
    }

    get algorithm_version() { return 3 };
    get browser_is_chrome() { return typeof browser === 'undefined' };
    get username() { if (typeof this._cache.username === 'undefined')
                        throw new Error("need get(['username'])");
                     else return this._cache.username; };
    get key_id() { if (typeof this._cache.key_id === 'undefined')
                        throw new Error("need get(['key_id'])");
                     else return this._cache.key_id; };
    get defaulttype() { if (typeof this._cache.defaulttype === 'undefined')
                        throw new Error("need get(['defaulttype'])");
                     else return this._cache.defaulttype; };
    get pass_to_clipboard() { if (typeof this._cache.pass_to_clipboard === 'undefined')
                        throw new Error("need get(['pass_to_clipboard'])");
                     else return this._cache.pass_to_clipboard; };
    get pass_store() { if (typeof this._cache.pass_store === 'undefined')
                        throw new Error("need get(['pass_store'])");
                     else return this._cache.pass_store; };
    get passwdtimeout() { if (typeof this._cache.passwdtimeout === 'undefined')
                        throw new Error("need get(['passwdtimeout'])");
                     else return this._cache.passwdtimeout; };

    set(toset){
        if ('masterkey' in toset) throw new Error("key should never be stored on config");
        const store = (this.browser_is_chrome ? chrome.storage.sync : chrome.storage.local)

        const isEmptyObject = (o) => {for (let i in o) return false; return true;};

        return new Promise(res => {
            Object.apply(this._cache, toset);

            if (store === chrome.storage.sync) {
                let obj = {...toset};
                let localset = {};
                for (const x of ['pass_store', 'passwdtimeout']) {
                    if (x in obj) {
                        localset[x] = obj[x];
                        delete obj[x];
                    }
                }
                if (!isEmptyObject(localset))
                    chrome.storage.local.set(localset, ()=>{
                        if (!isEmptyObject(obj))
                            store.set(obj, ()=>{ res() });
                        else
                            res();
                    });
                else
                    store.set(toset, ()=>{ res() });
            } else {
                store.set(toset, ()=>{ res() });
            }
        });
    }

    get(lst){
        const store = (this.browser_is_chrome ? chrome.storage.sync : chrome.storage.local)
        const singlekey = typeof lst === "string";
        return new Promise(res => {
            if (singlekey) lst = [lst];
            let localget = [];

            // stuff to always keep in local store
            if (store === chrome.storage.sync) {
                for (const x of ['pass_store', 'passwdtimeout']) {
                    if (lst.includes(x)) localget.push(x);
                }
            }

            store.get(lst, cb=>{
                // set some default values if they are not on store
                // need them to not be undefined, or cache above will fail
                if (lst.includes('defaulttype')) cb.defaulttype = cb.defaulttype || 'l';
                if (lst.includes('key_id')) cb.key_id = cb.key_id || '';
                if (lst.includes('pass_to_clipboard')) cb.pass_to_clipboard = !!cb.pass_to_clipboard;
                if (lst.includes('username')) cb.username = cb.username || '';
                if (lst.includes('pass_store')) cb.pass_store = !!cb.pass_store;
                if (lst.includes('passwdtimeout')) cb.passwdtimeout = isNaN(cb.passwdtimeout) ? -1 : cb.passwdtimeout;

                Object.assign(this._cache, cb);

                if (localget.size) {
                    console.log("Need to get local", localget);
                    chrome.storage.local.get(localget, stuff => {
                        Object.assign(this._cache, stuff);
                        Object.assign(cb, stuff);
                        if (lst.includes('pass_store')) cb.pass_store = !!cb.pass_store;
                        if (lst.includes('passwdtimeout')) cb.passwdtimeout = isNaN(cb.passwdtimeout) ? -1 : cb.passwdtimeout;
                        res(singlekey ? cb[lst[0]] : cb);
                    });
                } else {
                    res(singlekey ? cb[lst[0]] : cb);
                }
            });
        });
    }
}

const config = new Config();

export default config;

