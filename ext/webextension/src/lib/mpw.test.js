/**
 * @jest-environment jsdom
 */
import {jest} from '@jest/globals'

beforeAll(async () => {
    await import('./scrypt-asm.js');
    await import('./mpw.js');

});

it('mpw craete object with correct keyid', async ()=>{
    let pwtime = Date.now();
    const pw = window.mpw('Robert Lee Mitchell','banana colored duckling');
    pwtime = Date.now() - pwtime;

    expect(pw).toBeDefined();
    expect(pwtime).toBeLessThan(600);

    expect(pw.key_id()).toBe('98eef4d1df46d849574a82a03c3177056b15dffca29bb3899de4628453675302');
});
it('mpw test vectors', async ()=>{
    let pw = window.mpw('Robert Lee Mitchell','banana colored duckling');

    expect('Jejr5[RepuSosp').toEqual(pw.sitepassword('masterpasswordapp.com',1,'l'));
    expect('LiheCuwhSerz6)').toEqual(pw.sitepassword('⛄',1,'l'));
    expect('XambHoqo6[Peni').toEqual(pw.sitepassword('masterpasswordapp.com',4294967295,'l'));
    expect('W6@692^B1#&@gVdSdLZ@').toEqual(pw.sitepassword('masterpasswordapp.com',1,'x'));
    expect('Jej2$Quv').toEqual(pw.sitepassword('masterpasswordapp.com',1,'m'));
    expect('WAo2xIg6').toEqual(pw.sitepassword('masterpasswordapp.com',1,'b'));
    expect('Jej2').toEqual(pw.sitepassword('masterpasswordapp.com',1,'s'));
    expect('7662').toEqual(pw.sitepassword('masterpasswordapp.com',1,'i'));
    expect('jejraquvo').toEqual(pw.sitepassword('masterpasswordapp.com',1,'n'));
    expect('jejr quv cabsibu tam').toEqual(pw.sitepassword('masterpasswordapp.com',1,'p'));
    expect('wohzaqage').toEqual(pw.sitepassword('masterpasswordapp.com',1,'nx'));

    pw = mpw('⛄','banana colored duckling');
    expect(pw.key_id()).toEqual('1717aa1f9bf5ba56cd0965cda3d78e6d2e6a1ea8c067a8ea621f3ddad4a87eb8');
    expect('NopaDajh8=Fene').toEqual(pw.sitepassword('masterpasswordapp.com',1,'l'));

    pw = window.mpw('Robert Lee Mitchell','⛄');
    expect(pw.key_id()).toEqual('351432b8528a5abecab768ca95015097de76fe14c41e10af36c67dcfb8917e08');
    expect('QesuHirv5-Xepl').toEqual(pw.sitepassword('masterpasswordapp.com',1,'l'));
});

it('mpw thows on bad key or seed', async ()=>{
    expect(()=>{
        window.mpw('.'.repeat(500),'.'); //keyfail
    }).toThrow()

    expect(()=>{
        window.mpw.sitepassword('.'.repeat(500),1,'l'); //seed fail
    }).toThrow()
});

it('mpw utf8 username or pass', async ()=>{
    let sitename = ".";
    const cnt = 1;
    let pw = mpw('test','æøå');
    expect('U^Mh@^%kf3KaaCaRkO9&').toEqual(pw.sitepassword(sitename,cnt,'x'));
    expect('GekqXiquCidi1+').toEqual(pw.sitepassword(sitename,cnt,'l'));
    expect('GekQig8#').toEqual(pw.sitepassword(sitename,cnt,'m'));
    expect('UOl07Hft').toEqual(pw.sitepassword(sitename,cnt,'b'));
    expect('Gek0').toEqual(pw.sitepassword(sitename,cnt,'s'));
    expect('4110').toEqual(pw.sitepassword(sitename,cnt,'i'));
    expect('gekqigode').toEqual(pw.sitepassword(sitename,cnt,'n'));
    expect('ge qigqu cos lelamra').toEqual(pw.sitepassword(sitename,cnt,'p'));

    pw = mpw('test','€ß');
    expect('y3%JI^fQ1)^jmEDrmGKg').toEqual(pw.sitepassword(sitename,cnt,'x'));

    pw = mpw('æøåßß','test');
    expect('A7@BuMpJH&sF*jSeBkFo').toEqual(pw.sitepassword(sitename,cnt,'x'));

    pw = mpw('abc','abc');
    sitename = "æøåß";
    expect('cWIVZiNU2G4quLcdYb4.').toEqual(pw.sitepassword(sitename,cnt,'x'));
});

/*
//     <case id="v3_securityAnswer" parent="v3">
//         <siteVariant>Answer</siteVariant>
//         <siteType>GeneratedPhrase</siteType>
//         <result>xin diyjiqoja hubu</result>
//     </case>
//     <case id="v3_securityAnswer_context" parent="v3_securityAnswer">
//         <siteContext>question</siteContext>
//         <result>xogx tem cegyiva jab</result>
//     </case>

*/

it('mpw utf8 algorithm v2', async ()=>{
    const pw = mpw('æøåßß','test', 2);
    const sitename = ".";
    const cnt = 1;
    expect('j3*sW(mU$hkFDzjiKyHU').toEqual(pw.sitepassword(sitename,cnt,'x'));
});

it('mpw utf8 algorithm v2', async ()=>{
    const pw = mpw('abc','abc', 1);
    const cnt = 1;
    const sitename = "æøåß";
    expect('jV2(RKbXI0hNL$aSCz8.').toEqual(pw.sitepassword(sitename,cnt,'x'));
});
