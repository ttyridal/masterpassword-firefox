var buttons = require('sdk/ui/button/toggle');
var panels = require("sdk/panel");
var tabs = require("sdk/tabs");
var { viewFor } = require("sdk/view/core");
var tab_utils = require("sdk/tabs/utils");
var { Hotkey } = require("sdk/hotkeys");

var self = require("sdk/self");
const {Cc,Ci} = require("chrome");
var ss = require("sdk/simple-storage");

var session_store = {'username':null,'masterkey':null,'sites':{}};
if (ss.storage.username) session_store.username = ss.storage.username;
if (ss.storage.sites) session_store.sites = ss.storage.sites;

var button = buttons.ToggleButton({
    id: "com_github_ttyridal_masterpassword",
    label: "Master Password",
    icon: {
        "16": "./icon16.png",
        "32": "./icon32.png",
        "64": "./icon64.png"
    },
    onChange: function(state){
        if (state.checked) {
            var panel = createPanel();
            panel.show({position: button});
            panel.port.on('loaded' ,function(){ panel.port.emit("popup", session_store,false); });
        }
    }
});

var hotPassword = Hotkey({
  combo: require("sdk/simple-prefs").prefs.hotkeycombo,
  onPress: function() {
    var panel = createPanel();
    panel.show({position: button});
    panel.port.on('loaded' ,function(){ panel.port.emit("popup", session_store, true); });
  }
});

function createPanel() {
    var panel = panels.Panel({
        width:360,
        height:310,
        contentURL: self.data.url("main_popup.html"),
        onHide: function(){
            button.state('window', {checked: false});
            panel.destroy();
        }
    });
    panel.port.on('close', function() { panel.hide(); });

    panel.port.on('store_update', function(d){
        if (require("sdk/private-browsing").isPrivate(require("sdk/windows").activeWindow)) {
            console.log("won't store anything for private windows");
            return;
        }
        var k;
        for (k in d)
            session_store[k] = d[k];
        ss.storage.username = d.username;
        ss.storage.sites = d.sites;
    });
    panel.port.on('openconfig', function(d){
        tabs.open({
            url: self.data.url("config.html"),
            onReady: function(tab) {
                if (! /^resource:.*config\.html$/.test(tab.url)) return;
                var worker = tab.attach({ contentScriptFile: self.data.url('config-cs.js') });
                worker.port.on('configload', function(m) {
                    worker.port.emit('configload', {sites:session_store.sites, username:session_store.username});
                });
                worker.port.on('configstore', function(d) {
                    session_store.sites = d;
                    ss.storage.sites = d;
                });
            }
        });
    });

    panel.port.on('to_clipboard', function(d){
        const gClipboardHelper = Cc["@mozilla.org/widget/clipboardhelper;1"]
                                       .getService(Ci.nsIClipboardHelper);
        gClipboardHelper.copyString(d);
    });
    panel.port.on('get_tab_url', function(d){
        panel.port.emit('get_tab_url_resp', tabs.activeTab.url);
    });
    panel.port.on('update_page_password_input', function(d){
        var lltab = viewFor(tabs.activeTab);
        var browser = tab_utils.getBrowserForTab(lltab);
        if (!browser ||
            !browser.contentDocument ||
            !browser.contentDocument.activeElement ||
            browser.contentDocument.activeElement.tagName != "INPUT") {
            return;
        }
        if (browser.contentDocument.activeElement.type=="password")
            browser.contentDocument.activeElement.value=d;
        else {
            console.log('focused element is not password field');
        }

    });
    return panel;
}
