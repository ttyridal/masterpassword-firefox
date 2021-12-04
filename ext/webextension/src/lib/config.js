/* Copyright Torbjorn Tyridal 2015-2021

    This file is part of Masterpassword for Firefox (herby known as "the software").

    The software is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    The software is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with the software.  If not, see <http://www.gnu.org/licenses/>.
*/
/* globals chrome */
"use strict;"

function promised_storage_get(storage, keys) {
    return new Promise(resolve => {
        storage.get(keys, itms => { resolve(itms); });
    });
}
function promised_storage_set(storage, obj) {
    return new Promise(resolve => {
        storage.set(obj, () => { resolve(); });
    });
}


class Config {
    constructor() {
        this._cache = {};
    }
    reset() { this._cache = {}; }

    get algorithm_version() { return 3 }
    get browser_is_chrome() { return typeof browser === 'undefined' }
    get username() { if (typeof this._cache.username === 'undefined')
                        throw new Error("need get(['username'])");
                     else return this._cache.username; }
    get key_id() { if (typeof this._cache.key_id === 'undefined')
                        throw new Error("need get(['key_id'])");
                     else return this._cache.key_id; }
    get defaulttype() { if (typeof this._cache.defaulttype === 'undefined')
                        throw new Error("need get(['defaulttype'])");
                     else return this._cache.defaulttype; }
    get pass_to_clipboard() { if (typeof this._cache.pass_to_clipboard === 'undefined')
                        throw new Error("need get(['pass_to_clipboard'])");
                     else return this._cache.pass_to_clipboard; }
    get pass_store() { if (typeof this._cache.pass_store === 'undefined')
                        throw new Error("need get(['pass_store'])");
                     else return this._cache.pass_store; }
    get passwdtimeout() { if (typeof this._cache.passwdtimeout === 'undefined')
                        throw new Error("need get(['passwdtimeout'])");
                     else return this._cache.passwdtimeout; }
    get use_sync() { if (typeof this._cache.use_sync === 'undefined')
                        throw new Error("need get(['use_sync'])");
                     else return this._cache.use_sync; }

    set(toset){
        if ('masterkey' in toset) return Promise.reject(new Error("key should never be stored on config"));

        Object.apply(this._cache, toset);

        return (typeof this._cache.use_sync === 'undefined'
            ? promised_storage_get(chrome.storage.local, {'use_sync': this.browser_is_chrome})
            : Promise.resolve({use_sync: this._cache.use_sync}))
        .then(values => {
            this._cache.use_sync = values.use_sync;

            let localset = {};
            if (this._cache.use_sync) {
                let obj = {...toset};
                for (const x of ['pass_store', 'passwdtimeout', 'use_sync']) {
                    if (x in obj) {
                        localset[x] = obj[x];
                        delete obj[x];
                    }
                }
                return Promise.all([promised_storage_set(chrome.storage.sync, obj), Promise.resolve(localset)]);
            } else {
                return Promise.all([Promise.resolve(null), toset]);
            }
        })
        .then(values => {
            let [_, localset] = values; // eslint-disable-line no-unused-vars
            return promised_storage_set(chrome.storage.local, localset);
        });
    }

    get(lst){
        const singlekey = typeof lst === "string";
        if (singlekey) lst = [lst];

        return (typeof this._cache.use_sync === 'undefined'
            ? promised_storage_get(chrome.storage.local, {'use_sync': this.browser_is_chrome})
            : Promise.resolve(this._cache.use_sync))
        .then((values)=>{
            this._cache.use_sync = values.use_sync;

            let result = {use_sync: this._cache.use_sync};
            let store_fetch = lst.filter(e => e !== 'use_sync');

            let localget = [];
            let store = this._cache.use_sync ? chrome.storage.sync : chrome.storage.local;

            // stuff to always keep in local store
            if (this._cache.use_sync) {
                for (const x of ['pass_store', 'passwdtimeout']) {
                    if (lst.includes(x)) localget.push(x);
                }
            }

            return Promise.all([Promise.resolve(result), Promise.resolve(localget), promised_storage_get(store, store_fetch)]);
        })
        .then(values => {
            let [result, localget, cb] = values;
            Object.assign(result, cb);

            if (localget.length)
                return Promise.all([Promise.resolve(result), promised_storage_get(chrome.storage.local, localget)]);
            else
                return [result, {}];
        })
        .then(values => {
            let [result, cb] = values;
            Object.assign(result, cb);

            // set some default values if they are not on store
            // need them to not be undefined, or cache above will fail
            if (lst.includes('defaulttype')) result.defaulttype = result.defaulttype || 'l';
            if (lst.includes('key_id')) result.key_id = result.key_id || '';
            if (lst.includes('pass_to_clipboard')) result.pass_to_clipboard = !!result.pass_to_clipboard;
            if (lst.includes('username')) result.username = result.username || '';
            if (lst.includes('pass_store')) result.pass_store = !!result.pass_store;
            if (lst.includes('passwdtimeout')) result.passwdtimeout = isNaN(result.passwdtimeout) ? -1 : result.passwdtimeout;

            Object.assign(this._cache, result);

            return singlekey ? result[lst[0]] : result;
        });
    }
}

const config = new Config();

export default config;

