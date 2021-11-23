# see ../README.build for instructions on environment

#libscrypt retrieved from https://github.com/technion/libscrypt
#at commit 4df2c4c703367


.PHONY: main
main: scrypt-asm.js

scrypt.js: scrypt.c
	emcc scrypt.c crypto_scrypt-nosse.c sha256.c -o scrypt.js -O3 \
		--memory-init-file 0  \
		-s TOTAL_MEMORY=67108864 \
		-s EXPORTED_FUNCTIONS="['_scrypt','_scrypt_hmac_sha256','_sha256_digest','_mp_key','_mp_seed','_mp_clean','_get_masterkey']" \
		-s "EXTRA_EXPORTED_RUNTIME_METHODS=['ccall']" \
		-s NO_BROWSER=1 \
		-s ASSERTIONS=0

scrypt-asm.js: scrypt.js
	echo "window.Module = Module" | cat scrypt.js - >scrypt-asm.js

for_test: scrypt.c
	gcc -Wall -Wextra -pedantic scrypt.c crypto_scrypt-nosse.c sha256.c -o for_test -DFORTEST
