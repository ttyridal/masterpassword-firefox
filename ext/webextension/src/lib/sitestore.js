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
import {Site} from "./sites.js";

export class NeedUpgradeError extends Error {
  constructor() {
    super("Need data upgrade");
    this.name = "NeedUpgradeError";
  }
}

// quota on sync data is quite strict, so trying to minimize
const site_to_storage_map = {sitename:'s', generation: 'c', username:'n', type:'t', url:'u'};
export function site_to_storage(site) {
    return Object.keys(site).reduce((obj, k) => {
        if (k in site_to_storage_map) obj[site_to_storage_map[k]] = site[k];
        return obj;
    }, {});
}
function storage_to_site(s) {
    return new Site({sitename: s.s,
                     generation: s.c,
                     type: s.t,
                     username: s.n,
                     url: s.u});
}

export class SiteStore {
    constructor(store) {
        this._needs_upgrade = false;
        this.store = store;
    }

    need_upgrade() {
        return this._needs_upgrade;
    }

    get() {
        return this.get_nowrap().then(sites => sites.map(storage_to_site));
    }

    get_nowrap() {
        return new Promise(resolve => {
            this.store.get(['sites', 'sitedata'], d => {
                if ('sitedata' in d)
                    resolve(d.sitedata);
                else if ('sites' in d) {
                    this._needs_upgrade = true;
                    let result = [];
                    for (const [domain, sitedict] of Object.entries(d.sites)) {
                        for (const [sitename, props] of Object.entries(sitedict)) {
                            result.push({
                                s:sitename,
                                c:props.generation,
                                n:props.username,
                                t:props.type,
                                u:[domain]});
                        }
                    }
                    resolve(result);
                } else
                    resolve([]);
            });
        });
    }

    addOrReplace(site) {
        if (this._needs_upgrade) {
            console.error("need upgrade before addOrReplace");
            throw new NeedUpgradeError();
        }
        return new Promise(resolve => {
            this.get_nowrap()
            .then(sites=>{
                const siteidx = sites.findIndex(e => e.s == site.sitename);
                console.log("addOrReplace", site.sitename, siteidx);
                if (siteidx == -1)
                    sites.push(site_to_storage(site))
                else
                    sites[siteidx] = site_to_storage(site);

                this.store.set({'sitedata': sites}, ()=>resolve());
            })
        });
    }

    set(sites) {
        return new Promise(resolve => {
            this.store.set({'sitedata': sites.map(site_to_storage)}, ()=>resolve());
        });
    }

    update(sitename, params) {
        if (this._needs_upgrade) {
            console.error("need upgrade before update");
            throw new NeedUpgradeError();
        }
        return new Promise((resolve, fail) => {
            this.get_nowrap()
            .then(sites=>{
                const siteidx = sites.findIndex(e => e.s == sitename);
                if (siteidx == -1) {
                    fail(new Error("Not found"));
                    return;
                }
                Object.assign(sites[siteidx], site_to_storage(params));
                this.store.set({'sitedata': sites}, ()=>resolve());
            })
        });
    }

    remove(sitename) {
        if (this._needs_upgrade) {
            console.error("need upgrade before remove");
            throw new NeedUpgradeError();
        }
        return new Promise((resolve, fail) => {
            this.get_nowrap()
            .then(sites=>{
                const siteidx = sites.findIndex(e => e.s == sitename);
                if (siteidx == -1) {
                    fail(new Error("Not found"));
                    return;
                }
                sites.splice(siteidx, 1);

                this.store.set({'sitedata': sites}, ()=>resolve());
            });
        });
    }
}
