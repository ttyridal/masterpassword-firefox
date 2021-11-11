import {jest} from '@jest/globals'

let windowSpy;
let sitestore;

class chromeMockStorage {
    constructor() {
    }
    get(lst, cb) {
        console
        cb({});
    }
}

afterEach(() => {
});

it('sitestorage.get should return array of sites from old format', async () => {
    global.chrome = {
        storage: {local:new chromeMockStorage(), sync: new chromeMockStorage()}
    };

    jest.spyOn(global.chrome.storage.local, 'get').mockImplementation((lst, cb)=>cb({}));
    jest.spyOn(global.chrome.storage.sync, 'get').mockImplementation((lst, cb)=>{
        console.log("storage.sync.get(",lst);
        if (lst.includes('sites')) 
            cb({
            "sites": {
            "url1.com": { "urla.no": { "generation": 1, "type": "l", "username": "" } },
            "url2.co.uk": { "urlb.com": { "generation": 1, "type": "l", "username": "" } },
            "url2.de": { "urlb.com": { "generation": 1, "type": "l", "username": "" } } }
            });
        else
            cb({});
    });


  sitestore = (await import('./sitestore.js')).default;

    let a = await sitestore.get("");
    expect(global.chrome.storage.sync.get).toHaveBeenCalledWith(
        expect.arrayContaining(['sites', 'sitedata']), 
        expect.anything());
    expect(a).toEqual(expect.arrayContaining([
        {"sitename": "urla.no", "url": ["url1.com"], "generation": 1, "type": "l", "username": ""},
        {"sitename": "urlb.com", "url": ["url2.co.uk"], "generation": 1, "type": "l", "username": ""}, 
        {"sitename": "urlb.com", "url": ["url2.de"], "generation": 1, "type": "l", "username": ""}
    ]));
});

