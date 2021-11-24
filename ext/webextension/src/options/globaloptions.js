/* Copyright Torbjorn Tyridal 2021

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

"use strict";
import config from "../lib/config.js";

(function(){

function store_get(store, key) {
    return new Promise(resolv => { store.get(key, resolv); });
}
function store_set(store, obj) {
    return new Promise((resolve, fail) => {
        store.set(obj, () => {
            if (chrome.runtime.lastError)
                fail(chrome.runtime.lastError);
            else
                resolve();
        });
    });
}

document.querySelector('#passwdtype').addEventListener('change', function() {
    config.set({defaulttype: this.value});
});
document.querySelector('#passwdtimeout').addEventListener('change', function() {
    let v = parseInt(this.value);
    config.set({passwdtimeout: v});
});
document.querySelector('#defaultname').addEventListener('change', function() {
    config.set({defaultname: this.value});
});
document.querySelector('#pass_to_clipboard').addEventListener('change', function() {
    config.set({pass_to_clipboard: this.checked});
});
document.querySelector('#auto_submit_pass').addEventListener('change', function() {
    config.set({auto_submit_pass: this.checked});
});
document.querySelector('#auto_submit_username').addEventListener('change', function() {
    config.set({auto_submit_username: this.checked});
});
document.querySelector('#pass_store').addEventListener('change', function() {
    config.set({pass_store: this.checked});
});
document.querySelector('#use_sync').addEventListener('change', async function() {
    let oldstore = (this.checked?chrome.storage.local:chrome.storage.sync);
    let newstore = (!this.checked?chrome.storage.local:chrome.storage.sync);

    let sitestore_module = await import('../lib/sitestore.js');
    let overwritesites = await (new sitestore_module.SiteStore(newstore)).get_nowrap();
    if (overwritesites.length) {
        let drop = document.createElement('div');
        drop.style="background:rgba(0,0,0,0.3);position:fixed;"+
                   "top:0;left:0;right:0;bottom:0;display:flex;z-index:1000"+
                   "justify-content:center;align-items:center;align-content:center";
        let box = document.createElement('div');
        box.style="background:white;padding:1em;margin:1em;";
        drop.appendChild(box);

        let m = document.createElement('div');
        m.style="color:black";
        m.innerText = "You are switching from " + (this.checked ? "storage.local to storage.sync" :
            "storage.sync to storage.local") + ". However, " + (this.checked ? "storage.sync" :
            "storage.local") + " already contains some site data. Would you like to copy the data " +
            "you have over?";
        box.appendChild(m);
        let brow = document.createElement('div');
        brow.style = "margin-top:2em;display:flex;color:black;"+
            "justify-content:center;align-items:center;align-content:center";

        const buttoncss = "background-image: linear-gradient(rgb(237, 237, 237), "+
            "rgb(237, 237, 237) 38%, rgb(222, 222, 222));width: 8em; margin: 0 1em;"+
            "text-align:center; vertical-align:middle;padding:0.2em;white-space:normal;";

        let b = document.createElement('button');
        b.className='overwrite';
        b.style = "color:red;font-weight:bold;"+buttoncss;
        b.innerText="Copy and overwrite";
        brow.appendChild(b);

        b = document.createElement('button');
        b.className='keep';
        b.style = buttoncss+"color:black;";
        b.innerText="Don't copy";
        brow.appendChild(b);

        b = document.createElement('button');
        b.className='cancel';
        b.style = buttoncss+"color:black;";
        b.innerText="Abort";
        brow.appendChild(b);

        box.appendChild(brow);

        let p = new Promise(resolve => {
            brow.onclick = (el)=>{
                resolve(el.target.className);
                brow.remove();
            }
        });
        document.body.appendChild(drop);

        let choice = await p;
        drop.remove();
        switch (choice) {
            case 'keep':
                config.set({use_sync: this.checked});
                return;
            case 'overwrite':
                break;
            case 'cancel':
            default:
                this.checked = !this.checked;
                return;
        }
    }
    // copying stuff over.. all other cases should have
    // return before getting here!
    let allconfig = await store_get(oldstore, null);
    delete allconfig.releasenote_version;
    try {
        await store_set(newstore, allconfig);
        document.querySelector('#error123')?.remove();
    } catch (err) {
        this.checked = !this.checked;
        console.error("store failed", err.message);
        let emsg = document.querySelector('#error123') ?? document.createElement("div");
        emsg.id="error123";
        emsg.innerText="FAIL: " + err.message;
        document.querySelector('#use_sync').parentNode.parentNode.appendChild(emsg);
        return;
    }
    config.set({use_sync: this.checked});
});

window.addEventListener('load', function() {
    config.get([
        'defaulttype',
        'defaultname',
        'passwdtimeout',
        'pass_to_clipboard',
        'auto_submit_pass',
        'auto_submit_username',
        'pass_store',
        'use_sync',
    ])
    .then(data => {
        data = Object.assign({defaulttype: 'l', passwdtimeout: 0, pass_to_clipboard: true,
                 defaultname: '',
                 auto_submit_pass: false, auto_submit_username: false}, data);

        document.querySelector('#passwdtype').value = data.defaulttype;
        document.querySelector('#passwdtimeout').value = data.passwdtimeout;
        document.querySelector('#defaultname').value = data.defaultname;
        document.querySelector('#pass_to_clipboard').checked = data.pass_to_clipboard;
        document.querySelector('#auto_submit_pass').checked = data.auto_submit_pass;
        document.querySelector('#auto_submit_username').checked = data.auto_submit_username;
        document.querySelector('#pass_store').checked = data.pass_store;
        document.querySelector('#use_sync').checked = data.use_sync;
    });
});

}());
