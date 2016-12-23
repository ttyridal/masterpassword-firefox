(function(){
"use strict";


var session_store = {
    'username':null,
    'masterkey':null,
    'defaulttype':'l',
    'max_alg_version': 3,
    'passwdtimeout': -1,
    'key_id': undefined,
    'sites':{}
};

function store_update(d) {
    console.log("background.js: store_update",d);
}

function store_get(keys) {
    return new Promise((resolve, fail) => {
        let r = {};
        for (let k of keys) {
            switch (k) {
                case 'username':
                case 'masterkey':
                case 'defaulttype':
                case 'max_alg_version':
                case 'key_id':
                    r[k] = session_store[k];
                    break;
                case 'sites':
                    r.sites = JSON.parse(JSON.stringify(session_store.sites));
                    break;
                default:
                    fail();
            }
        }
        resolve(r);
    });
}

window.store_update = store_update;
window.store_get = store_get;

console.log("background.js loaded");
}());
