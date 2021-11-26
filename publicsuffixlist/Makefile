../ext/webextension/src/lib/psllookup.json.png: public_suffix_list.dat
	python psl_to_pgm.py public_suffix_list.dat | convert pgm:- -strip -define png:compression-filter=1 ../ext/webextension/src/lib/psllookup.json.png

public_suffix_list.dat:
	wget https://publicsuffix.org/list/public_suffix_list.dat


