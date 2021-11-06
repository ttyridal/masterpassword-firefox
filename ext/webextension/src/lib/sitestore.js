/* Copyright Torbjorn Tyridal 2021

    This file is part of Masterpassword for Firefox.

    This file (herby known as "the software") is licensed under the MIT license:

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
*/
"use strict";
import mpw_utils from "./mpw-utils.js";

export default (function() {

let sitedata_needs_upgrade = false;
const store = chrome.storage.local;

function get(url) {
    return get_nowrap().then(sites => sites.map(e => new mpw_utils.Site(e)));
};

function get_nowrap() {
    return new Promise((resolve, fail) => {
        store.get(['sites', 'sitedata'], d => {
            if ('sitedata' in d)
                resolve(d.sitedata);
            else if ('sites' in d) {
                sitedata_needs_upgrade = true;
                let result = [];
                for (const [domain, sitedict] of Object.entries(sites)) {
                    for (const [sitename, props] of Object.entries(sitedict)) {
                        props.sitename = sitename;
                        props.url = [domain];
                        result.push(props);
                    }
                }
                resolve(result);
            } else
                resolve([]);
        });
    });
}

function addOrReplace(site) {
    if (sitedata_needs_upgrade) {
        console.error("need upgrade before storage");
        return;
    }
    return new Promise((resolve, fail) => {
        get()
        .then(sites=>{
            const siteidx = sites.findIndex(e => e.sitename == site.sitename);
            console.log("addOrReplace", site.sitename, siteidx);
            if (siteidx == -1)
                sites.push(site)
            else
                sites[siteidx] = site;

            store.set({'sitedata': sites}, ()=>resolve());
        })
    });
}

function set(sites) {
    return new Promise((resolve, fail) => {
        store.set({'sitedata': sites}, ()=>resolve());
    });
}

function update(sitename, params) {
    return new Promise((resolve, fail) => {
        get()
        .then(sites=>{
            const siteidx = sites.findIndex(e => e.sitename == sitename);
            if (siteidx == -1) {
                fail(new Error("Not found"));
                return;
            }

            Object.assign(sites[siteidx], params);
            store.set({'sitedata': sites}, ()=>resolve());
        })
    });
}

function addurl(sitename, url) {
    return new Promise((resolve, fail) => {
        get()
        .then(sites=>{
            const siteidx = sites.findIndex(e => e.sitename == sitename);
            if (siteidx == -1) {
                fail(new Error("Not found"));
                return;
            }

            let urls = new Set(sites[siteidx].url);
            urls.add(url);
            sites[siteidx].url = Array.from(urls);
            store.set({'sitedata': sites}, ()=>resolve());
        });
    });
}

function remove(sitename, url) {
    console.log("sitestore.remove(",sitename,url,")");
    return new Promise((resolve, fail) => {
        get()
        .then(sites=>{
            const siteidx = sites.findIndex(e => e.sitename == sitename);
            if (siteidx == -1) {
                fail(new Error("Not found"));
                return;
            }

            let urls = new Set(sites[siteidx].url);
            if (url) {
                urls.delete(url);
                sites[siteidx].url = Array.from(urls);
            }

            if (!url || urls.size == 0)
                sites.splice(siteidx, 1);

            store.set({'sitedata': sites}, ()=>resolve());
        });
    });
}

/*
function removeConflict(sitename, url) {
    return new Promise((resolve, fail) => {
        get()
        .then(sites=>{
            const not_matching = (e) => ((e.sitename != sitename) && (!url || (url != e.url)));
            sites = sites.filter(not_matching);
            store.set({'sitedata': sites}, ()=>resolve());
        });
    });
}
*/
return {
    get,
    set,
    addOrReplace,
    addurl,
    remove,
    update
}

})();
