exports["test mpw"] = function(assert) {
    var self = require("sdk/self");
    const { sandbox, evaluate, load } = require("sdk/loader/sandbox");
    var scope = sandbox();
    scope.window = { };
    scope.XMLHttpRequest = function(){};
    scope.console = { 
        log: function(){},
        error: console.error,
    };
    try {
        load(scope, self.data.url('js/scrypt-asm.js'));
    } catch(e) {
        if (e.message == "AsmJS modules are not yet supported in XDR serialization.") {}
        else {
            console.error("loading scrypt-asm threw", e.message);
            throw e;
        }
    }
    load(scope, self.data.url('scrypt.js'));
    var mpw = scope.window.mpw;

    var sitename = ".";
    var cnt = 1;
    var pwtime = Date.now();
    var pw = scope.window.mpw('test','test');
    pwtime = Date.now() - pwtime;
    assert.ok(pw, 'mpw object exists');

    //console.log('exec time', pwtime);
    assert.ok(pwtime < 500, 'acceptable execute time');

    assert.equal(pw.key_id(), '95212fae6842582826f620d402b19aeaf38a77d612c24529bd5c89bacfd42288');

    pw = mpw('test','æøå');
    assert.ok(pw, 'mpw object exists');
    assert.equal('U^Mh@^%kf3KaaCaRkO9&', pw.sitepassword(sitename,cnt,'x'));
    assert.equal('GekqXiquCidi1+', pw.sitepassword(sitename,cnt,'l'));
    assert.equal('GekQig8#', pw.sitepassword(sitename,cnt,'m'));
    assert.equal('UOl07Hft', pw.sitepassword(sitename,cnt,'b'));
    assert.equal('Gek0', pw.sitepassword(sitename,cnt,'s'));
    assert.equal('4110', pw.sitepassword(sitename,cnt,'i'));
    assert.equal('gekqigode', pw.sitepassword(sitename,cnt,'n'));
    assert.equal('ge qigqu cos lelamra', pw.sitepassword(sitename,cnt,'p'));


    pw = mpw('test','€ß');
    assert.ok(pw);
    assert.equal('y3%JI^fQ1)^jmEDrmGKg', pw.sitepassword(sitename,cnt,'x'));

    pw = mpw('æøåßß','test');
    assert.ok(pw);
    assert.equal('A7@BuMpJH&sF*jSeBkFo', pw.sitepassword(sitename,cnt,'x'));

    pw = mpw('abc','abc');
    assert.ok(pw);
    sitename = "æøåß"
    assert.equal('cWIVZiNU2G4quLcdYb4.', pw.sitepassword(sitename,cnt,'x'));

    //alg v2
//     pw = mpw('æøåßß','test');
//     assert.ok(pw);
//     assert.equal('j3*sW(mU$hkFDzjiKyHU', pw.sitepassword(sitename,cnt,'x'));


    // alg v1
//     pw = mpw('abc','abc');
//     assert.ok(pw);
//     sitename = "æøåß"
//     assert.equal('jV2(RKbXI0hNL$aSCz8.', pw.sitepassword(sitename,cnt,'x'));


    assert.pass("scrypt asm loaded");
};

require("sdk/test").run(exports);
