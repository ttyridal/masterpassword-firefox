#~# emcc -v
#emcc (Emscripten GCC-like replacement + linker emulating GNU ld ) 1.29.0
#clang version 3.4 
#Target: x86_64-unknown-linux-gnu
#	Thread model: posix
#Found candidate GCC installation: /usr/lib/gcc/x86_64-linux-gnu/4.8
#	Found candidate GCC installation: /usr/lib/gcc/x86_64-linux-gnu/4.8.2
#Selected GCC installation: /usr/lib/gcc/x86_64-linux-gnu/4.8
#	INFO     root: (Emscripten: Running sanity checks)
#WARNING  root: java does not seem to exist, required for closure compiler, which is optional (define JAVA in ~/.emscripten if you want it)

#libscrypt retrieved from https://github.com/technion/libscrypt
#at commit 4df2c4c703367


.PHONY: main
main: scrypt-asm.js

scrypt.js: scrypt.c wrapper.js
	emcc scrypt.c crypto_scrypt-nosse.c sha256.c -o scrypt.js -Os --js-opts 0 -Wno-pointer-sign --memory-init-file 0  -s TOTAL_MEMORY=67108864 -s EXPORTED_FUNCTIONS="['_scrypt','_scrypt_hmac_sha256','_mp_key','_mp_seed','_mp_password','_mp_clean']"
	#manual steps: remove lot's of unused stuff
	patch < remove_cruft.patch
	cat wrapper.js >> scrypt.js
scrypt-asm.js: scrypt.js
	python $(EMSCRIPTEN)/tools/js_optimizer.py scrypt.js asm cleanup asmLastOpts minifyWhitespace eliminate eliminateMemSafe simplifyExpressions simplifyIfs optimizeFrounds registerize minifyNames last noop
	mv scrypt.js.jsopt.js scrypt-asm.js
