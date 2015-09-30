
exports["test main"] = function(assert) {
    var main = require("../lib/main.js");
    assert.pass("main.js loaded successfully");
};

if (require("sdk/system/runtime").OS == 'Linux') {
    // test dbus stuff
}

exports["test main handlers"] = function(assert, async_test_done) {
    var self = require("sdk/self");
    const { sandbox, evaluate, load } = require("sdk/loader/sandbox");

    var scope = sandbox();
    scope.console = console;
    evaluate(scope, "var window = { setTimeout:function(cb,x){cb();} }; var addon_script_ready = 0; var popup_cb, copy_to_clip;");
    scope.addon = {
        port: {
            on:function(x,cb){if (x=='popup') scope.popup_cb = cb;},
            once:function(x, cb){if (x=='get_tab_url_resp') cb('test.domain');},
            emit:function(x,y){
                if (x==='loaded') scope.addon_script_ready++;
                else if(x==='to_clipboard') scope.copy_to_clip = y;
                else if(x==='update_page_password_input') {
                    assert.equal(scope.copy_to_clip, 'hushh');
                    async_test_done();
                }
                else console.log('emit',x);
            }
        }
    };

    scope.mpw = function() {
        return {
            sitepassword: function(){return "hushh"},
            key_id: function(){return "sha254-key-id";}
        }
    }

    scope['$'] = function(x){ return {
        on: function(x){},
        hide: function(){},
        show: function(){},
        html: function(y){},
        attr: function(y,z){},
        val: function(y){ if (x=='#sitename') {return "test.domain";} },
    }};
    load(scope, self.data.url('main_popup.js'));
    assert.ok(scope.addon_script_ready == 1, "main_popup.js loaded successfully");

    evaluate(scope, "popup_cb({defaulttype:'l',username:'test',masterkey:'test', sites:{}},false);");
};

require("sdk/test").run(exports);
