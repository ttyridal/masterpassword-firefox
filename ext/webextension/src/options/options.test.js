/**
 * @jest-environment jsdom
 */
/* globals global */
import {jest, expect, beforeAll, beforeEach, it} from '@jest/globals'
import {Site} from '../lib/sites.js'

class MockSiteStore {
    get() { return Promise.resolve([]); }
    need_upgrade() { return false; }
}

jest.unstable_mockModule('../lib/sitestore.js', () => {
    return {
        SiteStore: MockSiteStore,
        NeedUpgradeError: null
    };
});

jest.unstable_mockModule('../lib/config.js', () => {
    return {
        default: {
            get: jest.fn().mockResolvedValue({username: 'testuser', use_sync: false})
        }
    }
});


function resetDocument() {
    document.body.innerHTML =
    '<div>' +
    '  <table class="" id="stored_sites"><tbody></tbody></table>' +
    '  <input class="" id="importinput" type="file">' +
    '  <div id="messagebox"><div id="messagebox_text"></div><div class="progress"></div></div>' +
    '  <template id="stored_sites_row"></template>' +
    '</div>';
}

beforeAll(async ()=>{
    global.chrome = {
        storage: {local:{},
                  sync:{}}
    };
    await import('../lib/sitestore.js');
    await import('../lib/config.js');
    resetDocument();
    global.running_under_test = 1;
    await import('./options.js');
    // wait here for the first load event to fire..
    await flushPromises();
});

const importNodeReal = document.importNode

beforeEach(()=>{
    document.importNode = importNodeReal;
    resetDocument();
});

const flushPromises = () => new Promise(r=>setTimeout(r,3));


it('config.js loads without error', async () => {
    window.dispatchEvent(new window.Event('load'));
});

it('loads all kind of passwords', async() => {
    document.importNode = ()=>{
        let tr = document.createElement('tr');
        tr.innerHTML = `
                    <td>sitename</td>
                    <td><input class="domainvalue" type="text" data-old="domain" value="domain"></td>
                    <td>loginname</td>
                    <td>count</td>
                    <td>type</td>
                    <td>ver</td>
                    <td><div class="fa fa-times-circle delete" aria-hidden="true"></div></td>`;
        return tr;
    }

    let spy = jest.spyOn(MockSiteStore.prototype, 'get').mockResolvedValueOnce([
        new Site({sitename:'s@somesite.com',url:['somesite.com'],'type':'s'}),
        new Site({sitename:'x@somesite.com',url:['somesite.com'],'type':'x'}),
        new Site({sitename:'i@somesite.com',url:['somesite.com'],'type':'i'}),
        new Site({sitename:'b@somesite.com',url:['somesite.com'],'type':'b'}),
        new Site({sitename:'l@somesite.com',url:['somesite.com'],'type':'l'}),
        new Site({sitename:'m@somesite.com',url:['somesite.com'],'type':'m'}),
        new Site({sitename:'n@somesite.com',url:['somesite.com'],'type':'n'}),
        new Site({sitename:'p@somesite.com',url:['somesite.com'],'type':'p'}),
        new Site({sitename:'nx@somesite.com',url:['somesite.com'],'type':'nx'}),
        new Site({sitename:'px@somesite.com',url:['somesite.com'],'type':'px'}),
    ]);

    window.dispatchEvent(new window.Event('load'));
    await flushPromises();

    expect(spy).toBeCalled()
    expect(document.querySelector('#stored_sites').rows.length).toBe(10);
});
