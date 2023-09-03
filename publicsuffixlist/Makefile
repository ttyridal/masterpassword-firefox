../ext/webextension/src/lib/psllookup.json.png: public_suffix_list.dat
	python psl_to_pgm.py pgm public_suffix_list.dat | convert pgm:- -strip -define png:compression-filter=1 ../ext/webextension/src/lib/psllookup.json.png

../ext/webextension/src/lib/psllookup.json.gz: public_suffix_list.dat
	python psl_to_pgm.py json public_suffix_list.dat | gzip -c -9 - >$@

public_suffix_list.dat:
	wget https://publicsuffix.org/list/public_suffix_list.dat


