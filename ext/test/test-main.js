/* global exports,require,console */

exports["test main"] = function(assert) {
    var main = require("../lib/main.js");
    assert.pass("main.js loaded successfully");
};

// test dbus stuff
// if (require("sdk/system/runtime").OS == 'Linux') {
// }


function mpsites_upload_jquery() {
    return {
        on: function(x, cb){
            if (x === 'drop') {
                cb({
                    originalEvent: {
                        dataTransfer: {files:[{name:'test.mpsites'}]}
                    },
                    preventDefault: function(){},
                    stopPropagation: function(){}
                });
            }
        },
        append: function(){}
    };
}
mpsites_upload_jquery.each = function(ar, cb) {
    for (var x in ar) {
        if (!ar.hasOwnProperty(x)) continue;
        cb.apply(ar[x], [x, ar[x]]);
    }
};

exports["test mpsites upload invalid"] = function(assert) {
    var self = require("sdk/self");
    const { sandbox, evaluate, load } = require("sdk/loader/sandbox");
    var got_alert_not_mpsites = false;
    var scope = sandbox();
    scope.window = {
        'addEventListener': function(){}
    };
    scope.document = {};
    scope.console = {
        log: function(){},
        warn: function(){},
        error: console.error
    };
    scope.confirm = function(m){return true;};
    scope.alert = function(m){if (/Not a mpsites.file/.test(m)) got_alert_not_mpsites = true;};
    scope.$ = mpsites_upload_jquery;
    scope.FileReader = function() { this.onload = function(){ console.error('test failed, onload should be set!');}; };
    scope.FileReader.prototype.readAsText = function(){
        this.onload({target:{result:"invalid..not.a.mpsites.file"}});
    };
    load(scope, self.data.url('config.js'));

    assert.ok(got_alert_not_mpsites);
};

exports["test mpsites upload valid"] = function(assert) {
    var self = require("sdk/self");
    const { sandbox, evaluate, load } = require("sdk/loader/sandbox");

    var file = [ '# Master Password site export',
'#     Export of site names and stored passwords (unless device-private) encrypted with the master key.',
'# ', '##', '# Format: 1', '# Date: 2015-09-30T10:15:25Z', '# User Name: test', '# Full Name: test',
'# Avatar: 0',
'# Version: 2.2', '# Algorithm: 3', '# Default Type: 17', '# Passwords: PROTECTED',
'##', '#',
'#               Last     Times  Password                      Login\t                     Site\tSite',
'#               used      used      type                       name\t                     name\tpassword',
'2015-09-30T10:14:31Z         0    16:1:6                           \t                    asite\t',
'2015-09-30T10:14:39Z         0    18:1:4                           \t                    åsite\t'
        ].join('\n');

    var version_mismatch_received = false;
    var event_received;
    var scope = sandbox();
    scope.window = {
        'addEventListener': function(){}
    };
    scope.document = {
        createEvent:function(){return{initCustomEvent:function(){ this.sites = arguments[3];}};},
        documentElement:{dispatchEvent: function(e){event_received=e;}}
    };
    scope.console = console;
    scope.confirm = function(m){return true;};
    scope.alert = function(m){ if (/Version mismatch/.test(m)) version_mismatch_received=true; } ;
    scope.$ = mpsites_upload_jquery;
    scope.FileReader = function() { this.onload = function(){ console.error('test failed, onload should be set!');}; };
    scope.FileReader.prototype.readAsText = function(){
        this.onload({target:{result:file}});
    };
    load(scope, self.data.url('config.js'));
    assert.ok(version_mismatch_received);
    assert.ok('asite' in event_received.sites);
    assert.ok('åsite' in event_received.sites);
    assert.equal(event_received.sites.asite.asite.generation, 6);
    assert.equal(event_received.sites.asite.asite.type, 'x');
    assert.equal(event_received.sites['åsite']['åsite'].generation, 4);
    assert.equal(event_received.sites['åsite']['åsite'].type, 'm');
};

exports["test main handlers"] = function(assert, async_test_done) {
    var self = require("sdk/self");
    const { sandbox, evaluate, load } = require("sdk/loader/sandbox");

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

    scope.$ = function(x){ return {
        on: function(x){},
        hide: function(){},
        show: function(){},
        html: function(y){},
        attr: function(y,z){},
        val: function(y){ if (x==='#sitename') {return "test.domain";} }
    };};
    load(scope, self.data.url('main_popup.js'));
    assert.ok(scope.addon_script_ready === 1, "main_popup.js loaded successfully");

    evaluate(scope, "popup_cb({defaulttype:'l',username:'test',masterkey:'test', sites:{}},false);");
};

require("sdk/test").run(exports);
