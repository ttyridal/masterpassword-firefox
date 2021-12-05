/**
 * @jest-environment jsdom
 */
/* globals global */
import {jest, beforeAll, it} from '@jest/globals'

jest.unstable_mockModule('../lib/sitestore.js', () => {
    return {
        SiteStore: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue([]),
            need_upgrade: jest.fn().mockReturnValue(false),
        }),
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


beforeAll(async ()=>{
    global.chrome = {
        storage: {local:{},
                  sync:{}}
    };
    await import('../lib/sitestore.js');
    await import('../lib/config.js');
});



it('config.js loads without error', async () => {
    document.body.innerHTML =
    '<div>' +
    '  <table class="" id="stored_sites"><tbody></tbody></table>' +
    '  <input class="" id="importinput" type="file">' +
    '  <div id="messagebox"><div class="progress"></div></div>' +
    '  <div id="messagebox"><div id="messageboxtxt"></div><div class="progress"></div></div>' +
    '</div>';


    await import('./config.js');

    window.dispatchEvent(new window.Event('load'));
});
