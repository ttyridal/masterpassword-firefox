/**
 * @jest-environment jsdom
 */
/* globals global */

import {jest, beforeAll, it} from '@jest/globals'

import {mockStorageGet} from '../../mocks/chromestorage.js'

beforeAll(()=>{
    global.chrome = {
        storage: {local:{get: jest.fn().mockImplementation(mockStorageGet())}, 
                  sync:{get: jest.fn().mockImplementation(mockStorageGet())}}
    };
});


// jest.mock('../lib/sitestore.js', () => ({
//   __esModule: true, // this property makes it work
//   default: {
//       get: jest.fn().mockResolvedValue([])
//   },
//       get: jest.fn().mockResolvedValue([])
// //     sitestore.get = jest.fn().mockResolvedValue([]);
// }));


it('config.js loads without error', async () => {
    document.body.innerHTML =
    '<div>' +
    '  <table class="" id="stored_sites"><tbody></tbody></table>' + 
    '  <input class="" id="importinput" type="file">' + 
    '  <div id="messagebox"><div class="progress"></div></div>' + 
    '  <div id="messagebox"><div id="messageboxtxt"></div><div class="progress"></div></div>' + 
    '</div>';

    global.chrome.storage.sync.get.mockImplementation(mockStorageGet({username:'test', max_alg_version:3}));

    const sitestore = (await import('../lib/sitestore.js')).default;
    sitestore.get = jest.fn().mockResolvedValue([]);
    await import('./config.js');


    window.dispatchEvent(new window.Event('load'));
});
