"use strict";
import config from "../lib/config.js";

(function(){

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
document.querySelector('#use_sync').addEventListener('change', function() {
    config.set({use_sync: this.checked});
});

window.addEventListener('load', function() {
    config.get(['defaulttype',
         'defaultname',
         'passwdtimeout',
         'pass_to_clipboard',
         'auto_submit_pass',
         'auto_submit_username',
         'pass_store',
         'use_sync'])
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
