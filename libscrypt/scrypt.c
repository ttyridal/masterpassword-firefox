/*
 * MasterPassword implementation for emscripten
 *
 */

#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "libscrypt.h"
#include "sha256.h"
#include <arpa/inet.h>
unsigned char scrypt_ret[64];
unsigned char hmac_sha256_digest[32];
char mp_pass_ret[64];

static const char NSgeneral[] = "com.lyndir.masterpassword";
static const char NSlogin[] = "com.lyndir.masterpassword.login";
static const char NSanswer[] = "com.lyndir.masterpassword.answer";

unsigned char * scrypt(char * password, unsigned password_len,
                       char * salt, unsigned salt_len,
                       unsigned N, unsigned r, unsigned p)
{
    int i = libscrypt_scrypt(
            (unsigned char*)password, password_len,
            (unsigned char*)salt, salt_len,
            N, r, p,
            scrypt_ret, sizeof scrypt_ret);
    if (i!=0) return NULL;
    return scrypt_ret;
}

unsigned char * scrypt_hmac_sha256(const unsigned char * key, unsigned keylen,
                                   char * data, unsigned datalen)
{
    HMAC_SHA256_CTX hctx;
    libscrypt_HMAC_SHA256_Init(&hctx, key, keylen);
    libscrypt_HMAC_SHA256_Update(&hctx, data, datalen);
    libscrypt_HMAC_SHA256_Final(hmac_sha256_digest, &hctx);
    return hmac_sha256_digest;
}

char * sha256_digest(unsigned char * bytes, unsigned len)
{
    static unsigned char digest[65];
    int i;
    char hex_map[] = "0123456789abcdef";
    SHA256_CTX ctx;
    libscrypt_SHA256_Init(&ctx);
    libscrypt_SHA256_Update(&ctx, bytes, len);
    libscrypt_SHA256_Final(digest, &ctx);
    digest[64]=0;

    for (i = 31; i >= 0; i--) {
        digest[i*2 + 1] = hex_map[digest[i]&0xf];
        digest[i*2 + 0] = hex_map[digest[i]>>4];
    }
    return (char*)digest;
}

unsigned char * get_masterkey(void)
{
    return scrypt_ret;
}

void int_to_network_bytes(uint32_t i, char * b)
{
    i = htonl(i);
    memcpy(b,&i,sizeof i);
}

unsigned char * mp_key(char * mp_utf8, char * name_utf8)
{
    const unsigned N = 32768,r=8,p=2;
    const unsigned mplen = strlen(mp_utf8);
    const unsigned namelen = strlen(name_utf8);
    unsigned saltlen = 0;
    char tmp[512];

    if (sizeof(NSgeneral)-1+namelen+4 > sizeof tmp)
        return NULL;
    memcpy(tmp,NSgeneral,sizeof(NSgeneral)-1);
    saltlen = sizeof(NSgeneral)-1;
    int_to_network_bytes(namelen, tmp+saltlen);
    saltlen+=4;
    memcpy(tmp+saltlen,name_utf8,namelen);
    saltlen+=namelen;

    if (scrypt(mp_utf8, mplen, tmp, saltlen, N,r,p) == NULL)
        return NULL;
    return scrypt_ret;
}

unsigned char * mp_seed(char * site_utf8, unsigned counter, const char *  namespace)
{
    const unsigned sitelen = strlen(site_utf8);
    const unsigned nslen = strlen(namespace);
    unsigned saltlen = 0;
    char tmp[512];
    if (nslen+sitelen+8 > sizeof tmp)
        return NULL;
    memcpy(tmp,namespace,nslen);
    saltlen = nslen;
    int_to_network_bytes(sitelen, tmp+saltlen);
    saltlen+=4;
    memcpy(tmp+saltlen,site_utf8,sitelen);
    saltlen+=sitelen;
    int_to_network_bytes(counter, tmp+saltlen);
    saltlen+=4;

    scrypt_hmac_sha256(scrypt_ret, sizeof scrypt_ret, tmp, saltlen);
    return hmac_sha256_digest;
}

char * mp_password(char * site_utf8, unsigned counter, char type)
{
    const char * pintemplates[] = {"nnnn"};
    const char * basictemplates[] = { "aaanaaan", "aannaaan", "aaannaaa"};
    const char * shorttemplates[] = { "Cvcn" };
    const char * mediumtemplates[] = { "CvcnoCvc", "CvcCvcno" };
    const char * longtemplates[] = { "CvcvnoCvcvCvcv", "CvcvCvcvnoCvcv", "CvcvCvcvCvcvno", "CvccnoCvcvCvcv", "CvccCvcvnoCvcv",
                                              "CvccCvcvCvcvno", "CvcvnoCvccCvcv", "CvcvCvccnoCvcv", "CvcvCvccCvcvno", "CvcvnoCvcvCvcc",
                                              "CvcvCvcvnoCvcc", "CvcvCvcvCvccno", "CvccnoCvccCvcv", "CvccCvccnoCvcv", "CvccCvccCvcvno",
                                              "CvcvnoCvccCvcc", "CvcvCvccnoCvcc", "CvcvCvccCvccno", "CvccnoCvcvCvcc", "CvccCvcvnoCvcc",
                                              "CvccCvcvCvccno" };
    const char * maxtemplates[] = { "anoxxxxxxxxxxxxxxxxx","axxxxxxxxxxxxxxxxxno" };
    const char * nametemplates[] = { "cvccvcvcv" };
    const char * phrasetemplates[] = { "cvcc cvc cvccvcv cvc", "cvc cvccvcvcv cvcv", "cv cvccv cvc cvcvccv"};

    const char * template;
    unsigned i;
    unsigned passlen=0;

    switch (type){
        case 'n': template = NSlogin; break;
        case 'p': template = NSanswer; break;
        default: template = NSgeneral; break;
    }
    if (!mp_seed(site_utf8, counter, template)) return NULL;

    switch (type){
    case 'i':
            i=sizeof pintemplates / sizeof pintemplates[0];
            template=pintemplates[hmac_sha256_digest[0] % i];
            break;
    case 'b':
            i=sizeof basictemplates / sizeof basictemplates[0];
            template=basictemplates[hmac_sha256_digest[0] % i];
            break;
    case 's':
            i=sizeof shorttemplates / sizeof shorttemplates[0];
            template=shorttemplates[hmac_sha256_digest[0] % i];
            break;
    case 'm':
            i=sizeof mediumtemplates / sizeof mediumtemplates[0];
            template=mediumtemplates[hmac_sha256_digest[0] % i];
            break;
    case 'l':
            i=sizeof longtemplates / sizeof longtemplates[0];
            template=longtemplates[hmac_sha256_digest[0] % i];
            break;
    case 'x':
            i=sizeof maxtemplates / sizeof maxtemplates[0];
            template=maxtemplates[hmac_sha256_digest[0] % i];
            break;
    case 'n':
            i=sizeof nametemplates / sizeof nametemplates[0];
            template=nametemplates[hmac_sha256_digest[0] % i];
            break;
    case 'p':
            i=sizeof phrasetemplates / sizeof phrasetemplates[0];
            template=phrasetemplates[hmac_sha256_digest[0] % i];
            break;

    default: return NULL;
    }

    passlen=strlen(template);
    for(i=0;i<passlen;i++) {
        const char * passChars;
        switch(template[i])
        {
            case 'V': passChars = "AEIOU"; break;
            case 'C': passChars = "BCDFGHJKLMNPQRSTVWXYZ";break;
            case 'v': passChars = "aeiou"; break;
            case 'c': passChars = "bcdfghjklmnpqrstvwxyz"; break;
            case 'A': passChars = "AEIOUBCDFGHJKLMNPQRSTVWXYZ"; break;
            case 'a': passChars = "AEIOUaeiouBCDFGHJKLMNPQRSTVWXYZbcdfghjklmnpqrstvwxyz"; break;
            case 'n': passChars = "0123456789"; break;
            case 'o': passChars = "@&%?,=[]_:-+*$#!'^~;()/."; break;
            case 'x': passChars = "AEIOUaeiouBCDFGHJKLMNPQRSTVWXYZbcdfghjklmnpqrstvwxyz0123456789!@#$%^&*()"; break;
            case ' ': passChars = " "; break;
            default: return NULL;
        }
        mp_pass_ret[i] = passChars[hmac_sha256_digest[i+1] % strlen(passChars)];
    }
    mp_pass_ret[passlen]=0;
    return mp_pass_ret;
}

void mp_clean(void){
    memset(scrypt_ret,0,sizeof scrypt_ret);
    memset(hmac_sha256_digest,0,sizeof hmac_sha256_digest);
    memset(mp_pass_ret,0,sizeof mp_pass_ret);
}

#ifdef FORTEST
#include <stdio.h>
#include <string.h>
#include <assert.h>
#define ASSERT_EQUAL(a,b) if (strcmp(a,b)!=0){printf("Failed %s != %s, line %d\n",a,b, __LINE__);exit(1);}
int main(int argc, char** argv) {
    if(!mp_key("test","test")) printf("keying failed\n");
    ASSERT_EQUAL("xoxgubavi", mp_password(".", 0, 'n'));
    ASSERT_EQUAL("95212fae6842582826f620d402b19aeaf38a77d612c24529bd5c89bacfd42288", sha256_digest(get_masterkey(),64));

    if(!mp_key("testtesttest","test")) printf("keying failed\n");
    ASSERT_EQUAL("15e1741aa454746472af7b0bbda637b1d02cb700a5f1a21d23656c905cf08353", sha256_digest(get_masterkey(),64));

    /* silence unused argument warning */
    (void)argc;
    (void)argv;
    return 0;
}
#endif
