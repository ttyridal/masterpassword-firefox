"use strict";
import {jest, expect, it} from '@jest/globals'
import mpw_utils from './mpw-utils.js'
import {Site} from './sites.js'

import fs from 'fs'

const non_conflict_sites =[
            new Site({sitename: 'test.domain', url:['testdomain.no'], type:'m', generation:1}),
            new Site({sitename: 'user@test.domain', url:['testdomain.no'], type:'l', username:'reasonably_short', generation:1}),
            new Site({sitename: 'åuser@test.domain', url:['testdomain.no'], type:'x', username: 'veryveryveryveryveryveryverylong', generation:2}),
            new Site({sitename: 'very@long.domain@another_very_very_long_test.domain', url:['another.domain'], type:'i', username: 'regular', generation:3}),
            new Site({sitename: 'n@site.com', url:['site.com'], type:'n', generation:1}),
            new Site({sitename: 'nx@site.com', url:['site.com'], type:'nx', generation:1}),
            new Site({sitename: 'p@site.com', url:['site.com'], type:'p', generation:1}),
            new Site({sitename: 'px@site.com', url:['site.com'], type:'px', generation:1}),
        ];

it('exports mpsites', () => {
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
        expect.objectContaining({type:'30', algver: ':1', count: ':1', sitename: 'n@site.com'}),
        expect.objectContaining({type:'31', algver: ':1', count: ':1', sitename: 'p@site.com'}),
        expect.objectContaining({type:'30', algver: ':1', count: ':1', sitename: 'nx@site.com'}), // basically not supported in mpsites format
        expect.objectContaining({type:'31', algver: ':1', count: ':1', sitename: 'px@site.com'}), // basically not supported in mpsites format
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

it('merge 1', async () => {
    let res = await mpw_utils.merge_sites(non_conflict_sites.slice(0,2), non_conflict_sites.slice(2));
    expect(res).toEqual(expect.arrayContaining(non_conflict_sites));

    let s5 = new Site({sitename:"mysite.com"})
    await mpw_utils.merge_sites(res, [s5]);
    expect(res).toEqual(expect.arrayContaining([...non_conflict_sites, s5]));
});

it('merge 2', async () => {
    const s5 = new Site({sitename: 'test.domain', url:['testdomain.no'], type:'m', generation:2, mark:true});
    const resolve = jest.fn((a,b)=>b);
    let res = await mpw_utils.merge_sites(non_conflict_sites, [s5], resolve);

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith(s5, non_conflict_sites[0]);
    expect(res[0]).toBe(non_conflict_sites[0]);

    resolve.mockClear();

    res = await mpw_utils.merge_sites([s5], non_conflict_sites, resolve);

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith(non_conflict_sites[0], s5);
    expect(res[0]).toBe(s5);
    for (let i=1; i < 5; i++)
        expect(res[i]).toBe(non_conflict_sites[i]);

    const resolve2 = jest.fn((a/*,b*/)=>a);
    // merge_sites modifies the first argument.. taking a copy
    let arrayCopy = non_conflict_sites.map(s => new Site(s));
    res = await mpw_utils.merge_sites(arrayCopy, [s5], resolve2);
    expect(resolve2).toHaveBeenCalledTimes(1);
    expect(resolve2).toHaveBeenCalledWith(s5, non_conflict_sites[0]);
    expect(res[0]).toBe(s5);
});

it('exports mpjson', () => {
    const alg_version_min = 1;
    const alg_version = 3;
    const use_mpjson = true;
    let sites = [...non_conflict_sites,
        new Site({sitename: 'manyurls.com', url:['manyurls.com', 'some.site.no','me.to'], type:'x', generation:1})];
    const ret = mpw_utils.make_mpsites("0123456", "mainuser", sites, alg_version_min, alg_version, use_mpjson);

    const jsn = JSON.parse(ret.join(''))
    expect(jsn).toEqual(expect.objectContaining({'export': expect.objectContaining({'redacted': true, 'format': 1})}));
    expect(jsn).toEqual(expect.objectContaining({'user': expect.objectContaining({'full_name': 'mainuser', 'algorithm': 3, 'key_id': '0123456'})}));
    expect(jsn.sites).toBeDefined();
    expect(jsn.sites['test.domain']).toEqual(expect.objectContaining({
          'counter': 1,
          'algorithm': 1,
          'type': 18,
          'login_type': 0, // NSGENERAL
          'ext.browser.url': ['testdomain.no'],
          'ext.browser.username': ''}));
    expect(jsn.sites['manyurls.com']).toEqual(expect.objectContaining({
          'type': 16,
          'login_type': 0,  // NSGENERAL
          'ext.browser.url': ['manyurls.com','some.site.no','me.to'],
          'ext.browser.username': ''}));
    expect(jsn.sites['åuser@test.domain']).toEqual(expect.objectContaining({
          'algorithm': 2,
          'ext.browser.url': ['testdomain.no'],
          'ext.browser.username': 'veryveryveryveryveryveryverylong',
          'counter': 2}));
    expect(jsn.sites['n@site.com']).toEqual(expect.objectContaining({
          'counter': 1,
          'algorithm': 1,
          'type': 30,
          'login_type': 0,
    }));
    expect(jsn.sites['nx@site.com']).toEqual(expect.objectContaining({
          'counter': 1,
          'algorithm': 1,
          'type': 30,
          'login_type': 30,  //NSLOGIN
    }));
    expect(jsn.sites['p@site.com']).toEqual(expect.objectContaining({
          'counter': 1,
          'algorithm': 1,
          'type': 31,
          'login_type': 0,
    }));
    expect(jsn.sites['px@site.com']).toEqual(expect.objectContaining({
          'counter': 1,
          'algorithm': 1,
          'type': 31,
          'login_type': 0,
          'questions': { '': { "type": 31 } }
    }));
});

it('imports mpjson', () => {
    const fdr = fs.readFileSync('../test/spectre_cli.mpjson', "utf8", function(err, data) { return data; });
    const confirm_true = jest.fn().mockReturnValue(true);
    let r = mpw_utils.read_mpsites(fdr, 'test', mpheader_key, confirm_true);
    console.log(r);
    expect(r).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'x', passalgo: 3, generation: 1, username: '', sitename: 'x@site.com'}),
        expect.objectContaining({ type: 'l', passalgo: 3, generation: 1, username: '', sitename: 'l@site.com'}),
        expect.objectContaining({ type: 'm', passalgo: 3, generation: 1, username: '', sitename: 'm@site.com'}),
//         expect.objectContaining({ type: 'b', passalgo: 3, generation: 1, username: '', sitename: 'b@site.com'}),
//         expect.objectContaining({ type: 's', passalgo: 3, generation: 1, username: '', sitename: 's@site.com'}),
        expect.objectContaining({ type: 'i', passalgo: 3, generation: 1, username: '', sitename: 'i@site.com'}),
        expect.objectContaining({ type: 'n', passalgo: 3, generation: 1, username: '', sitename: 'n@site.com'}),
        expect.objectContaining({ type: 'p', passalgo: 3, generation: 1, username: '', sitename: 'p@site.com'}),
        expect.objectContaining({ type: 'nx', passalgo: 3, generation: 1, username: '', sitename: 'nx@site.com'}),
        expect.objectContaining({ type: 'px', passalgo: 3, generation: 1, username: '', sitename: 'px@site.com'}),
    ]));
});
