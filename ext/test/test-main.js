
exports["test main"] = function(assert) {
    var main = require("../lib/main.js");
    assert.pass("main.js loaded successfully");
};

if (require("sdk/system/runtime").OS == 'Linux') {
    // test dbus stuff
}

exports["test main handlers"] = function(assert) {
    var self = require("sdk/self");
    const { sandbox, evaluate, load } = require("sdk/loader/sandbox");
    var scope = sandbox();
    var addon_script_ready=0;
    scope.addon = {
        port: {
            on:function(x){},
            emit:function(x){ if (x==='loaded') addon_script_ready++; }
        }
    };
    scope['$'] = function(){ return {
        on: function(x){}
    }};
    load(scope, self.data.url('main_popup.js'));
    assert.ok(addon_script_ready == 1, "main_popup.js loaded successfully");
};

require("sdk/test").run(exports);
