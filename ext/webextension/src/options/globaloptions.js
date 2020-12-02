/*jshint browser:true */
/*globals chrome */

(function(){
"use strict";

function store_update(data) {
    browser.runtime.sendMessage({action: 'store_update', data: data })
    .catch(err=>{ console.log("BUG!",err); });
}

document.querySelector('#passwdtype').addEventListener('change', function() {
    store_update({defaulttype: this.value});
});
document.querySelector('#passwdtimeout').addEventListener('change', function() {
    let v = parseInt(this.value);
    store_update({passwdtimeout: v});
});
document.querySelector('#pass_to_clipboard').addEventListener('change', function() {
    store_update({pass_to_clipboard: this.checked});
});
document.querySelector('#auto_submit_pass').addEventListener('change', function() {
    store_update({auto_submit_pass: this.checked});
});
document.querySelector('#auto_submit_username').addEventListener('change', function() {
    store_update({auto_submit_username: this.checked});
});
document.querySelector('#pass_store').addEventListener('change', function() {
    store_update({pass_store: this.checked});
});

window.addEventListener('load', function() {
    browser.runtime.sendMessage({action: 'store_get', keys:
        ['defaulttype',
         'passwdtimeout',
         'pass_to_clipboard',
         'auto_submit_pass',
         'auto_submit_username',
         'pass_store']})
    .then(data => {
        document.querySelector('#passwdtype').value = data.defaulttype;
        document.querySelector('#passwdtimeout').value = data.passwdtimeout;
        document.querySelector('#pass_to_clipboard').checked = data.pass_to_clipboard;
        document.querySelector('#auto_submit_pass').checked = data.auto_submit_pass;
        document.querySelector('#auto_submit_username').checked = data.auto_submit_username;
        document.querySelector('#pass_store').checked = data.pass_store;
    });
});

}());
