"use strict";
import {jest} from '@jest/globals'
import mpw_utils from './mpw-utils.js'
import {Site} from './sites.js'

import fs from 'fs'


it('exports mpsites', () => {
    const non_conflict_sites =[
            new Site({sitename: 'test.domain', url:['testdomain.no'], type:'m', generation:1}),
            new Site({sitename: 'user@test.domain', url:['testdomain.no'], type:'l', username:'reasonably_short', generation:1}),
            new Site({sitename: 'åuser@test.domain', url:['testdomain.no'], type:'x', username: 'veryveryveryveryveryveryverylong', generation:2}),
            new Site({sitename: 'very@long.domain@another_very_very_long_test.domain', url:['another.domain'], type:'i', username: 'regular', generation:3})
        ];
    const alg_version_min = 1;
    const alg_version = 3;
    const use_mpjson = false;
    const ret = mpw_utils.make_mpsites("0123456", "mainuser", non_conflict_sites, alg_version_min, alg_version, use_mpjson);

    const re = /^([^ ]+) +(\d+) +(\d+)(:\d+)?(:\d+)? +([^\t]*)\t *([^\t]+)\t(.*)/;
    const dictify = (x)=>{ return {lastused:x[0], timesused:x[1], type:x[2], algver:x[3], count:x[4], username:x[5], sitename:x[6]};};

    const sites_parsed = ret.filter(x => x[0] !== '#').map(x => dictify(re.exec(x).slice(1)));

    expect(sites_parsed).toEqual(expect.arrayContaining([
        expect.objectContaining({type:'18', algver: ':1', count: ':1', username:'', sitename: 'test.domain'}),
        expect.objectContaining({type:'17', algver: ':1', count: ':1', username:'reasonably_short', sitename: 'user@test.domain'}),
        expect.objectContaining({type:'16', algver: ':2', count: ':2', username:'veryveryveryveryveryveryverylong', sitename: 'åuser@test.domain'}),
        expect.objectContaining({type:'21', algver: ':1', count: ':3', username:'regular', sitename: 'very@long.domain@another_very_very_long_test.domain'}),
    ]));
});

const mpheader_key = '95212FAE6842582826F620D402B19AEAF38A77D612C24529BD5C89BACFD42288';
const mpsite_header = ['# Master Password site export',
                    '#     Export of site names and stored passwords (unless device-private) encrypted with the master key.',
                    '# ', '##', '# Format: 1', '# Date: 2015-09-30T10:15:25Z', '# User Name: test', '# Full Name: test',
                    '# Avatar: 0', '# Key ID: '+mpheader_key,
                    '# Version: 2.2', '# Algorithm: 3', '# Default Type: 17', '# Passwords: PROTECTED',
                    '##', '#',
                    '#               Last     Times  Password                      Login\t                     Site\tSite',
                    '#               used      used      type                       name\t                     name\tpassword'
        ];

it('imports mpsites', () => {
    const sites = [
                    '2015-09-30T10:14:31Z         0    16:1:6                           \t                    asite\t',
                    '2015-09-30T10:14:51Z         0    17:3:1                           \t                    csite\t',
                    '2015-09-30T10:14:39Z         0    18:2:4                           \t                    åsite\t'
        ];

    const r = mpw_utils.read_mpsites(mpsite_header.concat(sites).join('\n'));
    
    expect(r).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'x', passalgo: 1, generation: 6, username: '', sitename: 'asite'}),
    expect.objectContaining({ type: 'l', passalgo: 3, generation: 1, username: '', sitename: 'csite'}),
    expect.objectContaining({ type: 'm', passalgo: 2, generation: 4, username: '', sitename: 'åsite'})
    ]));
    expect(r[0]).toBeInstanceOf(Site);

});

it('import bogus mpsites throws', () => {
    const confirm_fn = jest.fn().mockReturnValue(true);

    expect(()=>{
        mpw_utils.read_mpsites([ 'gargabe' ].join('\n'), undefined, undefined, confirm_fn);
    }).toThrow(mpw_utils.MPsitesImportError);

    expect(confirm_fn).toHaveBeenCalledTimes(0);
});

it('import confirm on wrong name', () => {
    const confirm_false = jest.fn().mockReturnValue(false);
    const confirm_true = jest.fn().mockReturnValue(true);
    let r;

    r = mpw_utils.read_mpsites(mpsite_header.join('\n'), 'wrongname', 'wrongkey', confirm_false);
    expect(confirm_false).toHaveBeenCalled();
    expect(r).toBe(undefined);
    confirm_false.mockClear();

    r = mpw_utils.read_mpsites(mpsite_header.join('\n'), 'wrongname', mpheader_key, confirm_true);
    expect(confirm_true).toHaveBeenCalled();
    expect(r).toEqual([]);
    confirm_true.mockClear();
});

it('import confirm on wrong key', () => {
    const confirm_false = jest.fn().mockReturnValue(false);
    const confirm_true = jest.fn().mockReturnValue(true);
    let r;

    r = mpw_utils.read_mpsites(mpsite_header.join('\n'), 'test', 'wrongkey', confirm_false);
    expect(confirm_false).toHaveBeenCalled();
    expect(r).toBe(undefined);
    confirm_false.mockClear();

    r = mpw_utils.read_mpsites(mpsite_header.join('\n'), 'test', 'wrongkey', confirm_true);
    expect(confirm_true).toHaveBeenCalled();
    expect(r).toEqual([]);
    confirm_true.mockClear();
});

it('import old ios client file', () => {
    const confirm_true = jest.fn().mockReturnValue(true);
    const fdr = fs.readFileSync('../test/ios2.1.88_sample.mpsites', "utf8", function(err, data) { return data; });
    let r = mpw_utils.read_mpsites(fdr, 'test', mpheader_key, confirm_true);
    expect(confirm_true).toHaveBeenCalledTimes(0);

    expect(r.length).toEqual(4);
    expect(r).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'x', passalgo: 2, generation: 1, username: '', sitename: 'apple.com'}),
        expect.objectContaining({ type: 'l', passalgo: 2, generation: 2, username: '', sitename: 'mysite.com'}),
        expect.objectContaining({ type: 'l', passalgo: 2, generation: 1, username: '', sitename: 'a.very.very.very.very.ling.site.com'}),
    ]));
});
