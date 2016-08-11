/* global exports,require,console */

const self = require("sdk/self");
const { sandbox, evaluate, load } = require("sdk/loader/sandbox");
// require("sdk/preferences/service").set('extensions.'+self.id+'.sdk.console.logLevel', 'debug');

exports["test main"] = function(assert) {
    var main = require("../lib/main.js");
    assert.pass("main.js loaded successfully");
};

// test dbus stuff
// if (require("sdk/system/runtime").OS == 'Linux') {
// }


function scope_import_fake_dom(scope) {
    function dummyEvent(type, base) {
        if (base !== undefined)
            Object.assign(this, base);
        this.type = type;
        this.propagate = true;
        this.stopPropagation = function() {this.propagate = false;};
        this.preventDefault = function() {};
    }

    function DummyDom(id) {
        this.id = id;
        this.childNodes = [];
        this.eventlisteners = {};
        this.addEventListener = function(e, cb){
            let el = this.eventlisteners[e] || [];
            this.eventlisteners[e] = el;
            el.push(cb);
        };
        this.dispatchEvent = function(ev) {
            for (let cb of this.eventlisteners[ev.type])
                try {
                    cb(ev);
                } catch (e) {
                    console.error(e);
                }

        };
        this.querySelector = function(q){
            if (this.id === q) return this;
            for (let x of this.childNodes) {
                if (x.id === q) return x;
                x = x.querySelector(q);
                if (x !== undefined) return x;
            }
            return undefined;
        };

        this.appendChild = function(chld) { this.childNodes.push(chld); return chld;};
    }

    let document = new DummyDom('document');
    document.documentElement = document;
    document.createElement = function(x) {return new DummyDom(x);};

    scope.window = {document: document};
    scope.document = scope.window.document;
    scope.CustomEvent = dummyEvent;
    scope.DragEvent = dummyEvent;

    return DummyDom;
}


exports["test mpsites upload invalid"] = function(assert) {
    var got_alert_not_mpsites = false;
    var scope = sandbox();

    let DummyDom = scope_import_fake_dom(scope);
    scope.document.appendChild(new DummyDom('body'))
        .appendChild(new DummyDom('#stored_sites'))
            .appendChild(new DummyDom('#stored_sites > tbody'));

    scope.console = { warn:function(){}};

    scope.confirm = function(m){return true;};
    scope.alert = function(m){if (/Not a mpsites.file/.test(m)) got_alert_not_mpsites = true;};
    scope.FileReader = function() { this.onload = function(){ console.error('test failed, onload should be set!');}; };
    scope.FileReader.prototype.readAsText = function(){
        this.onload({target:{result:"invalid..not.a.mpsites.file"}});
    };
    load(scope, self.data.url('mpw-utils.js'));
    load(scope, self.data.url('config.js'));


    scope.document.dispatchEvent(new scope.DragEvent('drop', {dataTransfer: {files:[{name: 'some.mpsites'}]}}));

    assert.ok(got_alert_not_mpsites);
};

exports["test mpsites upload valid"] = function(assert, async_test_done) {
    var version_mismatch_received = false;
    var scope = sandbox();

    function FileReader() {
        this.onload = function(){ console.error('test failed, onload should be set!');};
        this.readAsText = function() {
            this.onload({target:{result: ['# Master Password site export',
                 '#     Export of site names and stored passwords (unless device-private) encrypted with the master key.',
                 '# ',
                 '##',
                 '# Format: 1',
                 '# Date: 2015-09-30T10:15:25Z',
                 '# User Name: test',
                 '# Full Name: test',
                 '# Avatar: 0',
                 '# Version: 2.2', '# Algorithm: 3', '# Default Type: 17', '# Passwords: PROTECTED',
                 '##',
                 '#',
                 '#               Last     Times  Password                      Login\t                     Site\tSite',
                 '#               used      used      type                       name\t                     name\tpassword',
                 '2015-09-30T10:14:31Z         0    16:1:6                           \t                    asite\t',
                 '2015-09-30T10:14:39Z         0    18:1:4                           \t                    åsite\t'
                ].join('\n')}});
        };
    }
    scope.console = console;
    scope.FileReader = FileReader;

    let DummyDom = scope_import_fake_dom(scope);
    let document = scope.document;
    document.importNode = function() {
        let x = new DummyDom();
        x.appendChild(new DummyDom('input.domainvalue')).setAttribute = function(){};
        x.querySelectorAll = function() {
            return [{},{},{},{},{},{}];
        };
        return x;
    };

    document.appendChild(new DummyDom('body'))
        .appendChild(new DummyDom('#stored_sites'))
            .appendChild(new DummyDom('#stored_sites > tbody'))
                .appendChild(new DummyDom('#stored_sites_row'));

    scope.alert = function(m){ if (/Version mismatch/.test(m)) version_mismatch_received=true; else throw new Error('unexpected alert: '+m);};
    scope.confirm = function(m){return true;};

    load(scope, self.data.url('mpw-utils.js'));
    load(scope, self.data.url('config.js'));

    document.dispatchEvent(new scope.DragEvent('dragenter'));
    document.dispatchEvent(new scope.DragEvent('dragover'));

    document.addEventListener('masterpassword-siteupdate', function(ev){
        assert.equal(ev.type, "masterpassword-siteupdate", "custom event is of wrong type");
        console.log(ev.detail);
        let sites_received = ev.detail;

        assert.ok(version_mismatch_received);
        assert.ok('asite' in sites_received);
        assert.ok('åsite' in sites_received);
        assert.equal(sites_received.asite.asite.generation, 6);
        assert.equal(sites_received.asite.asite.type, 'x');
        assert.equal(sites_received['åsite']['åsite'].generation, 4);
        assert.equal(sites_received['åsite']['åsite'].type, 'm');

        async_test_done();
    });

    document.dispatchEvent(new scope.DragEvent('drop', {dataTransfer: {files:[{name: 'some.mpsites'}]}}));
};

exports["test main handlers"] = function(assert, async_test_done) {
    var scope = sandbox();
    scope.console = console;
    evaluate(scope, "var window = { setTimeout:function(cb,x){cb();} }; var addon_script_ready = 0; var popup_cb, copy_to_clip;");
    scope.addon = {
        port: {
            on:function(x,cb) {
                if (x === 'popup') {scope.popup_cb = cb;}
            },
            once:function(x, cb) {
                if (x === 'get_tab_url_resp') { cb('test.domain'); }
            },
            emit:function(x,y){
                if (x==='loaded') { scope.addon_script_ready++; }
                else if (x==='to_clipboard') { scope.copy_to_clip = y; }
                else if (x==='update_page_password_input') {
                    assert.equal(scope.copy_to_clip, 'hushh');
                    async_test_done();
                }
            }
        }
    };

    scope.mpw = function() {
        return {
            sitepassword: function(){return "hushh";},
            key_id: function(){return "sha254-key-id";}
        };
    };

    function qrysel(x) {
        if (x === "#sitename") x = "test.domain";
        return {
            value: x,
            addEventListener:function(){},
            style: {display:''},
            getAttribute: function(){},
            setAttribute: function(){},
            appendChild: function(x){return x;}
        };
    }
    scope.document = {
        createElement: qrysel,
        querySelector: qrysel,
        querySelectorAll: function(){ return [ qrysel() ]; }
    };

    load(scope, self.data.url('main_popup.js'));
    assert.ok(scope.addon_script_ready === 1, "main_popup.js loaded successfully");

    evaluate(scope, "popup_cb({defaulttype:'l',username:'test',masterkey:'test', sites:{}},false);");
};

require("sdk/test").run(exports);
