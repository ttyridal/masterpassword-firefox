/* global exports,require,console */

function loadConfigJs() {
    var self = require("sdk/self");
    const { sandbox, evaluate, load } = require("sdk/loader/sandbox");
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
    load(scope, self.data.url('../test/jquery_stubs.js'));
    load(scope, self.data.url('config.js'));

    return scope;
}

exports["test mpw utils import ios"] = function(assert, async_test_done) {
    var scope = loadConfigJs();
    const {Cu} = require("chrome");
    const {TextDecoder, OS} = Cu.import("resource://gre/modules/osfile.jsm", {}); //jshint ignore:line
    function confirm_fn(txt) { console.error("cofirmfn:",txt);return true; }

    OS.File.read("test/ios2.1.88_sample.mpsites").then(function(ar){
        let mpsites_txt = (new TextDecoder()).decode(ar);
        var r;
        try {
            r = scope.window.mpw_utils.read_mpsites(
                mpsites_txt,
                undefined, undefined,
                confirm_fn);
        } catch(e) {
            assert.ok(0, "read_mpsites threw error "+e);
            async_test_done();
            return;
        }

        assert.equal(r.length, 4, "read failed");
        assert.equal(r[0].sitename, 'a.very.very.very.very.ling.site.com');
        assert.equal(r[0].passtype, 'l');
        assert.equal(r[0].passalgo, '2');
        assert.equal(r[0].passcnt, '1');

        async_test_done();
    },
    function failure(reason) {
        console.log(reason);
        assert.ok(0, "File read failed");
        async_test_done();
    });

};

exports["test mpw utils import confirm"] = function(assert) {
    var scope = loadConfigJs();
    var test_key_id = '95212FAE6842582826F620D402B19AEAF38A77D612C24529BD5C89BACFD42288';
    var header = [ '# Master Password site export',
'#     Export of site names and stored passwords (unless device-private) encrypted with the master key.',
'# ', '##', '# Format: 1', '# Date: 2015-09-30T10:15:25Z', '# User Name: test', '# Full Name: test',
'# Avatar: 0', '# Key ID: '+test_key_id,
'# Version: 2.2', '# Algorithm: 3', '# Default Type: 17', '# Passwords: PROTECTED',
'##', '#'].join('\n');

    var r;
    var confirm_called = false;
    function confirm_true(txt) { confirm_called = true; return true; }
    function confirm_false(txt) { confirm_called = true; return false; }

    r = scope.window.mpw_utils.read_mpsites(header, 'wrongname', 'wrongkey', confirm_false);
    assert.equal(true, confirm_called);
    assert.equal(typeof r, 'undefined');

    confirm_called = false;
    r = scope.window.mpw_utils.read_mpsites(header, 'test', 'wrongkey', confirm_false);
    assert.equal(true, confirm_called);
    assert.equal(typeof r, 'undefined');

    confirm_called = false;
    r = scope.window.mpw_utils.read_mpsites(header, 'test', test_key_id, confirm_false);
    assert.equal(false, confirm_called);
    assert.equal(typeof r, typeof [], "Wrong return type");

    r = scope.window.mpw_utils.read_mpsites(header, 'wronguser', test_key_id, confirm_true);
    assert.equal(true, confirm_called);
    assert.equal(typeof r, typeof [], "Wrong return type");
};

exports["test mpw utils import"] = function(assert) {
    var scope = loadConfigJs();

    var header = [ '# Master Password site export',
'#     Export of site names and stored passwords (unless device-private) encrypted with the master key.',
'# ', '##', '# Format: 1', '# Date: 2015-09-30T10:15:25Z', '# User Name: test', '# Full Name: test',
'# Avatar: 0', '# Key ID: 95212FAE6842582826F620D402B19AEAF38A77D612C24529BD5C89BACFD42288',
'# Version: 2.2', '# Algorithm: 3', '# Default Type: 17', '# Passwords: PROTECTED',
'##', '#',
'#               Last     Times  Password                      Login\t                     Site\tSite',
'#               used      used      type                       name\t                     name\tpassword'
        ];

    var sites = [
'2015-09-30T10:14:31Z         0    16:1:6                           \t                    asite\t',
'2015-09-30T10:14:51Z         0    17:3:1                           \t                    csite\t',
'2015-09-30T10:14:39Z         0    18:2:4                           \t                    åsite\t'
        ];

    function confirm_fn() { return true; }

    assert.throws(function(){
        scope.window.mpw_utils.read_mpsites(
            [ 'gargabe' ].join('\n'),
            undefined, undefined,
            confirm_fn);}, /Not a mpsites file/);
    var r = scope.window.mpw_utils.read_mpsites(header.concat(sites).join('\n'));
    assert.equal(r[0].sitename, 'asite');
    assert.equal(r[0].passtype, 'x');
    assert.equal(r[0].passalgo, '1');
    assert.equal(r[0].passcnt, '6');

    assert.equal(r[1].sitename, 'csite');
    assert.equal(r[1].passtype, 'l');
    assert.equal(r[1].passalgo, '3');
    assert.equal(r[1].passcnt, '1');

    assert.equal(r[2].sitename, 'åsite');
    assert.equal(r[2].passtype, 'm');
    assert.equal(r[2].passalgo, '2');
    assert.equal(r[2].passcnt, '4');

};

exports["test mpw utils export"] = function(assert) {
    var scope = loadConfigJs();

    var ret = scope.window.mpw_utils.make_mpsites("0123456",{
        'testdomain.no': {
            'test.domain': {type:'m', generation:1},
            'user@test.domain': {type:'l', username:'reasonably_short', generation:1},
            'åuser@test.domain': {type:'x', username: 'veryveryveryveryveryveryverylong', generation:2}
        },
        'another.domain': {
            'very@long.domain@another_very_very_long_test.domain': {type:'i', username: 'regular', generation:3}
        }
    }, 1);

    var sites_parsed = [];
    var re = /^([^ ]+) +(\d+) +(\d+)(:\d+)?(:\d+)? +([^\t]*)\t *([^\t]+)\t(.*)/;
    for (let x of ret) {
        if (x[0] === '#') {continue;}
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


    ret = scope.window.mpw_utils.make_mpsites("0123456", {
        'testdomain.no': {
            'user@test.domain': {type:'p', generation:1},
            'åuser@test.domain': {type:'b', generation:4}
        }
    }, 3);

    sites_parsed = [];
    re = /^([^ ]+) +(\d+) +(\d+)(:\d+)?(:\d+)? +([^\t]*)\t *([^\t]+)\t(.*)/;
    for (let x of ret) {
        if (x[0] === '#') {continue;}
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
};

exports["test mpw algorithm"] = function(assert) {
    var self = require("sdk/self");
    const { sandbox, evaluate, load } = require("sdk/loader/sandbox");
    var scope = sandbox();
    scope.window = { };
    scope.XMLHttpRequest = function(){};
    scope.console = {
        log: function(){},
        error: console.error
    };
    try {
        load(scope, self.data.url('js/scrypt-asm.js'));
    } catch(e) {
        // jshint noempty: false
        if (e.message === "AsmJS modules are not yet supported in XDR serialization.") {}
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
    var pw = scope.window.mpw('Robert Lee Mitchell','banana colored duckling');
    pwtime = Date.now() - pwtime;
    assert.ok(pw, 'mpw object exists');

    //console.log('exec time', pwtime);
    assert.ok(pwtime < 500, 'acceptable execute time');

    assert.equal(pw.key_id(), '98eef4d1df46d849574a82a03c3177056b15dffca29bb3899de4628453675302');
    assert.equal('Jejr5[RepuSosp', pw.sitepassword('masterpasswordapp.com',1,'l'));
    assert.equal('LiheCuwhSerz6)', pw.sitepassword('⛄',1,'l'));
    assert.equal('XambHoqo6[Peni', pw.sitepassword('masterpasswordapp.com',4294967295,'l'));
    assert.equal('W6@692^B1#&@gVdSdLZ@', pw.sitepassword('masterpasswordapp.com',1,'x'));
    assert.equal('Jej2$Quv', pw.sitepassword('masterpasswordapp.com',1,'m'));
    assert.equal('WAo2xIg6', pw.sitepassword('masterpasswordapp.com',1,'b'));
    assert.equal('Jej2', pw.sitepassword('masterpasswordapp.com',1,'s'));
    assert.equal('7662', pw.sitepassword('masterpasswordapp.com',1,'i'));
    assert.equal('jejraquvo', pw.sitepassword('masterpasswordapp.com',1,'n'));
    assert.equal('jejr quv cabsibu tam', pw.sitepassword('masterpasswordapp.com',1,'p'));
    assert.equal('wohzaqage', pw.sitepassword('masterpasswordapp.com',1,'nx'));

//     <case id="v3_securityAnswer" parent="v3">
//         <siteVariant>Answer</siteVariant>
//         <siteType>GeneratedPhrase</siteType>
//         <result>xin diyjiqoja hubu</result>
//     </case>
//     <case id="v3_securityAnswer_context" parent="v3_securityAnswer">
//         <siteContext>question</siteContext>
//         <result>xogx tem cegyiva jab</result>
//     </case>


    pw = mpw('⛄','banana colored duckling');
    assert.equal(pw.key_id(), '1717aa1f9bf5ba56cd0965cda3d78e6d2e6a1ea8c067a8ea621f3ddad4a87eb8');
    assert.equal('NopaDajh8=Fene', pw.sitepassword('masterpasswordapp.com',1,'l'));

    pw = scope.window.mpw('Robert Lee Mitchell','⛄');
    assert.equal(pw.key_id(), '351432b8528a5abecab768ca95015097de76fe14c41e10af36c67dcfb8917e08');
    assert.equal('QesuHirv5-Xepl', pw.sitepassword('masterpasswordapp.com',1,'l'));

    assert.throws(function(){mpw('.'.repeat(500),'.');}, /mp_key failed/);
    assert.throws(function(){pw.sitepassword('.'.repeat(500),1,'l');}, /mp_seed failed/);


    sitename = ".";
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
    sitename = "æøåß";
    assert.equal('cWIVZiNU2G4quLcdYb4.', pw.sitepassword(sitename,cnt,'x'));

    //alg v2
    pw = mpw('æøåßß','test', 2);
    sitename = ".";
    assert.ok(pw);
    assert.equal('j3*sW(mU$hkFDzjiKyHU', pw.sitepassword(sitename,cnt,'x'));

    // alg v1
    pw = mpw('abc','abc', 1);
    assert.ok(pw);
    sitename = "æøåß";
    assert.equal('jV2(RKbXI0hNL$aSCz8.', pw.sitepassword(sitename,cnt,'x'));
};

require("sdk/test").run(exports);

