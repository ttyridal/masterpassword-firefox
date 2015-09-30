
exports["test mpw utils export"] = function(assert) {
    var self = require("sdk/self");
    const { sandbox, evaluate, load } = require("sdk/loader/sandbox");
    var scope = sandbox();
    scope.window = {
        'addEventListener': function(){},
    };
    scope['document'] = {};
    load(scope, self.data.url('../test/jquery_stubs.js'));
    load(scope, self.data.url('config.js'));

    var ret = scope.window.mpw_utils.make_mpsites({
        'testdomain.no': {
            'test.domain': {type:'m', generation:1},
            'user@test.domain': {type:'l', username:'reasonably_short', generation:1},
            'åuser@test.domain': {type:'x', username: 'veryveryveryveryveryveryverylong', generation:2},
        },
        'another.domain': {
            'very@long.domain@another_very_very_long_test.domain': {type:'i', username: 'regular', generation:3},
        }
    }, 1);

    var sites_parsed = [];
    var re = /^([^ ]+) +(\d+) +(\d+)(:\d+)?(:\d+)? +([^\t]*)\t *([^\t]+)\t(.*)/
    for (var x of ret) {
        if (x[0] == '#') continue;
        sites_parsed.push(re.exec(x).slice(1));
    }

    assert.equal(sites_parsed[0][2], '18');
    assert.equal(sites_parsed[0][3], ':1');
    assert.equal(sites_parsed[0][4], ':1');
    assert.equal(sites_parsed[0][5], '');
    assert.equal(sites_parsed[0][6], 'test.domain');

    assert.equal(sites_parsed[1][2], '17');
    assert.equal(sites_parsed[1][3], ':1');
    assert.equal(sites_parsed[1][4], ':1');
    assert.equal(sites_parsed[1][5], 'reasonably_short');
    assert.equal(sites_parsed[1][6], 'user@test.domain');

    assert.equal(sites_parsed[2][2], '16');
    assert.equal(sites_parsed[2][3], ':2');
    assert.equal(sites_parsed[2][4], ':2');
    assert.equal(sites_parsed[2][5], 'veryveryveryveryveryveryverylong');
    assert.equal(sites_parsed[2][6], 'åuser@test.domain');

    assert.equal(sites_parsed[3][2], '21');
    assert.equal(sites_parsed[3][3], ':1');
    assert.equal(sites_parsed[3][4], ':3');
    assert.equal(sites_parsed[3][5], 'regular');
    assert.equal(sites_parsed[3][6], 'very@long.domain@another_very_very_long_test.domain');


    ret = scope.window.mpw_utils.make_mpsites({
        'testdomain.no': {
            'user@test.domain': {type:'p', generation:1},
            'åuser@test.domain': {type:'b', generation:4},
        },
    }, 3);

    sites_parsed = [];
    re = /^([^ ]+) +(\d+) +(\d+)(:\d+)?(:\d+)? +([^\t]*)\t *([^\t]+)\t(.*)/
    for (var x of ret) {
        if (x[0] == '#') continue;
        sites_parsed.push(re.exec(x).slice(1));
    }
    assert.equal(sites_parsed[0][2], '31');
    assert.equal(sites_parsed[0][3], ':3');
    assert.equal(sites_parsed[0][4], ':1');
    assert.equal(sites_parsed[0][5], '');
    assert.equal(sites_parsed[0][6], 'user@test.domain');

    assert.equal(sites_parsed[1][2], '19');
    assert.equal(sites_parsed[1][3], ':3');
    assert.equal(sites_parsed[1][4], ':4');
    assert.equal(sites_parsed[1][5], '');
    assert.equal(sites_parsed[1][6], 'åuser@test.domain');

    assert.ok(1);
}

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
    pw = mpw('æøåßß','test', 2);
    sitename = ".";
    assert.ok(pw);
    assert.equal('j3*sW(mU$hkFDzjiKyHU', pw.sitepassword(sitename,cnt,'x'));

    // alg v1
    pw = mpw('abc','abc', 1);
    assert.ok(pw);
    sitename = "æøåß"
    assert.equal('jV2(RKbXI0hNL$aSCz8.', pw.sitepassword(sitename,cnt,'x'));
};

require("sdk/test").run(exports);

