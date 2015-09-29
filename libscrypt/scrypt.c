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

static const char NSgeneral[] = "com.lyndir.masterpassword";

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

unsigned char * mp_key(char * mp_utf8, char * name_utf8, int lenoverride)
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
    if (lenoverride > 0) // v1 & v2
        int_to_network_bytes(lenoverride, tmp+saltlen);
    else // v3
        int_to_network_bytes(namelen, tmp+saltlen);
    saltlen+=4;
    memcpy(tmp+saltlen,name_utf8,namelen);
    saltlen+=namelen;

    if (scrypt(mp_utf8, mplen, tmp, saltlen, N,r,p) == NULL)
        return NULL;
    return scrypt_ret;
}

unsigned char * mp_seed(char * site_utf8, unsigned counter, const char * scope, const char * context, int lenoverride)
{
    const unsigned sitelen = strlen(site_utf8);
    const unsigned nslen = strlen(scope);
    unsigned ctxlen;
    unsigned saltlen = 0;
    char tmp[512];

    if (context) {
        ctxlen = strlen(context);
        if (nslen+sitelen+ctxlen+12 > sizeof tmp)
            return NULL;
    }
    else if (nslen+sitelen+8 > sizeof tmp)
        return NULL;

    memcpy(tmp,scope,nslen);
    saltlen = nslen;
    if (lenoverride>0) // v1
        int_to_network_bytes(lenoverride, tmp+saltlen);
    else // v2 & v3
        int_to_network_bytes(sitelen, tmp+saltlen);
    saltlen+=4;
    memcpy(tmp+saltlen,site_utf8,sitelen);
    saltlen+=sitelen;
    int_to_network_bytes(counter, tmp+saltlen);
    saltlen+=4;
    if (context) {
        int_to_network_bytes(counter, tmp+saltlen);
        saltlen+=4;
        memcpy(tmp+saltlen,context,ctxlen);
    }

    scrypt_hmac_sha256(scrypt_ret, sizeof scrypt_ret, tmp, saltlen);
    return hmac_sha256_digest;
}

void mp_clean(void){
    memset(scrypt_ret,0,sizeof scrypt_ret);
    memset(hmac_sha256_digest,0,sizeof hmac_sha256_digest);
}

#ifdef FORTEST
#include <stdio.h>
#include <string.h>
#include <assert.h>
#define ASSERT_EQUAL(a,b) if (strcmp(a,b)!=0){printf("Failed %s != %s, line %d\n",a,b, __LINE__);exit(1);}
int main(int argc, char** argv) {
    if(!mp_key("test","test")) printf("keying failed\n");
    ASSERT_EQUAL("95212fae6842582826f620d402b19aeaf38a77d612c24529bd5c89bacfd42288", sha256_digest(get_masterkey(),64));

    if(!mp_key("testtesttest","test")) printf("keying failed\n");
    ASSERT_EQUAL("15e1741aa454746472af7b0bbda637b1d02cb700a5f1a21d23656c905cf08353", sha256_digest(get_masterkey(),64));

    /* silence unused argument warning */
    (void)argc;
    (void)argv;
    return 0;
}
#endif
