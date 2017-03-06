/* Copyright Torbjorn Tyridal 2017

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
// jshint esversion: 6, bitwise: true, eqeqeq: true, freeze: true, futurehostile: true, nonbsp: true
// jshint singleGroups: true, strict: true, undef: true, unused: true, varstmt: true
// jshint browser: true
/* globals chrome */

;(function() {
"use strict";

const TIMEOUT = 100;

if (isInputActive()) {
    if (window === parent) {
        foundTheInput();
    } else {
        askParent()
        .then(()=>foundTheInput())
        .catch(() => {});
    }
} else if (isFrameActive()) {
    window.addEventListener('message', function msgHandler(e) {
        if (!e.data || e.data.id !== chrome.runtime.id)
            return;
        if (e.data.action === 'checkme') {
            if (e.source !== document.activeElement.contentWindow)
                return;

            window.removeEventListener('message', msgHandler);
            if (window === parent)
                confirmChild(e.source);
            else {
                askParent()
                .then(()=>{confirmChild(e.source);})
                .catch(() => {});
            }
        }
    });
}

function isInputActive() {
    return document.activeElement.matches('input');
}

function isFrameActive() {
    return document.activeElement.matches('frame, iframe');
}

function askParent() {
	return new Promise((r,f) => {
        let to;
        function fn(e) {
            if (e.source !== parent || !e.data || e.data.id !== chrome.runtime.id)
                return;

            if (e.data.action === 'confirmed') {
                window.removeEventListener('message', fn);
                window.clearTimeout(to);
                r();
            }
		}
        to = window.setTimeout(()=>{
            window.removeEventListener('message', fn);
            f('timeout');}, TIMEOUT);
		window.addEventListener('message', fn);
		parent.postMessage({id: chrome.runtime.id, action: 'checkme'}, '*');
	});
}

function confirmChild(childWindow) {
    childWindow.postMessage({id: chrome.runtime.id, action: 'confirmed'}, '*');
}

function foundTheInput() {
    chrome.runtime.sendMessage({id: chrome.runtime.id, action: 'IamActive', tgt: {type: document.activeElement.type, name: document.activeElement.name}});
}
})();
