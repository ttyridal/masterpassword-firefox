import {expect, it} from '@jest/globals'
import { parseUri } from './uritools.js';

it('extracts url', () => {
  expect(parseUri("https://torbjorn.tyridal.no/some/page?args=1")).toEqual(
        {"anchor": "", 
         "authority": "torbjorn.tyridal.no", 
         "directoryPath": "/some/page/", 
         "domain": "torbjorn.tyridal.no", 
         "fileName": "", 
         "path": "/some/page", 
         "port": "", 
         "protocol": "https", 
         "query": "args=1", 
         "source": "https://torbjorn.tyridal.no/some/page?args=1"});
});
