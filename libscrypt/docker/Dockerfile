FROM gcc:6.5.0

ARG EMCC_VER=1.35.10
ARG NODE_VER=v10.23.0
ARG NODE_DIST=linux-x64

RUN set -ex; \
    cd /tmp; \
    curl -L -o unzip.dpkg http://archive.debian.org/debian/pool/main/u/unzip/unzip_6.0-8+deb7u5_amd64.deb; \
    curl -L -o emscripten.zip https://github.com/emscripten-core/emscripten/archive/${EMCC_VER}.zip; \
    curl -L -o llvm.zip https://github.com/emscripten-core/emscripten-fastcomp/archive/${EMCC_VER}.zip; \
    curl -L -o clang.zip https://github.com/emscripten-core/emscripten-fastcomp-clang/archive/${EMCC_VER}.zip; \
    curl -L -o node.tar.gz https://nodejs.org/download/release/${NODE_VER}/node-${NODE_VER}-${NODE_DIST}.tar.gz; \
    \
    dpkg -i unzip.dpkg; \
    \
    unzip emscripten.zip -d /usr/lib/; \
    unzip llvm.zip; \
    cd emscripten-fastcomp-${EMCC_VER}; \
    unzip ../clang.zip -d tools; \
    mv tools/emscripten-fastcomp-clang-${EMCC_VER} tools/clang; \
    mkdir build; \
    cd build; \
    ../configure --enable-optimized --disable-assertions --enable-targets=host,js; \
    make -j 16; \
    mv Release /usr/lib/llvm; \
    cd /tmp; \
    \
    tar xf node.tar.gz -C /usr/lib; \
    rm -Rf *;

RUN set -ex; \
    PATH=$PATH:/usr/lib/llvm/bin:/usr/lib/node-${NODE_VER}-${NODE_DIST}/bin:/usr/lib/emscripten-${EMCC_VER}; \
    export PATH; \
    emcc -v

ENV PATH="/usr/lib/emscripten-${EMCC_VER}:$PATH" 
ENV EMSCRIPTEN=/usr/lib/emscripten-${EMCC_VER}
WORKDIR /src
CMD bash
