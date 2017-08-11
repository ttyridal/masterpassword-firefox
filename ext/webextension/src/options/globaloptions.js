/*jshint browser:true */
/*globals chrome */

(function(){
"use strict";


document.querySelector('#passwdtype').addEventListener('change', function() {
    chrome.extension.getBackgroundPage().store_update({defaulttype: this.value});
});
document.querySelector('#passwdtimeout').addEventListener('change', function() {
    let v = parseInt(this.value);
    chrome.extension.getBackgroundPage().store_update({passwdtimeout: v});
});
document.querySelector('#pass_to_clipboard').addEventListener('change', function() {
    chrome.extension.getBackgroundPage().store_update({pass_to_clipboard: this.checked});
});
document.querySelector('#auto_submit_pass').addEventListener('change', function() {
    chrome.extension.getBackgroundPage().store_update({auto_submit_pass: this.checked});
});
document.querySelector('#auto_submit_username').addEventListener('change', function() {
    chrome.extension.getBackgroundPage().store_update({auto_submit_username: this.checked});
});
document.querySelector('#pass_store').addEventListener('change', function() {
    chrome.extension.getBackgroundPage().store_update({pass_store: this.checked});
});

window.addEventListener('load', function() {
    chrome.extension.getBackgroundPage().store_get(
        ['defaulttype',
         'passwdtimeout',
         'pass_to_clipboard',
         'auto_submit_pass',
         'auto_submit_username',
         'pass_store'])
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
