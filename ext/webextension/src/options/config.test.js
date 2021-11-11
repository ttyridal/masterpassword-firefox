/**
 * @jest-environment jsdom
 */
import {jest} from '@jest/globals'

beforeAll(()=>{
    global.chrome = {
        storage: {local:{}}
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

    global.chrome.storage.local.get = (lst,cb)=>{if (lst.includes('username') &&  lst.includes('max_alg_version')) return {'username':'test','max_alg_version':3}; return {}};

    const sitestore = (await import('../lib/sitestore.js')).default;
    sitestore.get = jest.fn().mockResolvedValue([]);
    const configjs = (await import('./config.js'));


    window.dispatchEvent(new window.Event('load'));


    console.log(document.body.innerHTML);
})
