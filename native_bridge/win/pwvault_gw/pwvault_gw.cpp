#include <SDKDDKVer.h>
#include <tchar.h>
#include <Windows.h>
#include <WinCred.h>
#include <io.h>
#include <fcntl.h>
#include <iostream>
#include <fstream>
#include <sstream>
#include <stdint.h>
#include "jsmn.h"

typedef NTSTATUS(NTAPI* fnRtlGetVersion)(PRTL_OSVERSIONINFOW lpVersionInformation);
typedef BOOL(WINAPI *LPFN_ISWOW64PROCESS) (HANDLE, PBOOL);

using namespace std;

wstring GetFormattedMessage(LONG errCode);

void set_binary_io()
{
	_setmode(_fileno(stdin), _O_BINARY);
	_setmode(_fileno(stdout), _O_BINARY);
}

wchar_t const target[] = L"masterpassword-for-firefox";
wchar_t const password[] = L"Password";

wstring exeversionw;
string exeversion;

void initExeVersion(wchar_t * szVersionFile) {
    DWORD  verHandle = 0;
    UINT   size = 0;
    LPBYTE lpBuffer = NULL;
    DWORD  verSize = GetFileVersionInfoSize(szVersionFile, &verHandle);
    if (verSize != NULL) {
        LPSTR verData = new char[verSize];

        if (GetFileVersionInfo(szVersionFile, verHandle, verSize, verData)) {
            if (VerQueryValue(verData, L"\\", (VOID FAR* FAR*)&lpBuffer, &size)) {
                if (size) {
                    VS_FIXEDFILEINFO *verInfo = (VS_FIXEDFILEINFO *)lpBuffer;
                    if (verInfo->dwSignature == 0xfeef04bd) {

                        exeversion =
                            to_string((verInfo->dwFileVersionMS >> 16) & 0xffff) + '.' +
                            to_string((verInfo->dwFileVersionMS >> 0) & 0xffff) + '.' +
                            to_string((verInfo->dwFileVersionLS >> 16) & 0xffff) + '.' +
                            to_string((verInfo->dwFileVersionLS >> 0) & 0xffff);
                        exeversionw =
                            to_wstring((verInfo->dwFileVersionMS >> 16) & 0xffff) + L'.' +
                            to_wstring((verInfo->dwFileVersionMS >> 0) & 0xffff) + L'.' +
                            to_wstring((verInfo->dwFileVersionLS >> 16) & 0xffff) + L'.' +
                            to_wstring((verInfo->dwFileVersionLS >> 0) & 0xffff);
                    }
                }
            }
        }
        delete[] verData;
    }
}

BOOL IsWow64() {
    BOOL bIsWow64 = FALSE;
    auto fnIsWow64Process = (LPFN_ISWOW64PROCESS)GetProcAddress(
        GetModuleHandle(TEXT("kernel32")), "IsWow64Process");

    if (NULL != fnIsWow64Process) {
        if (!fnIsWow64Process(GetCurrentProcess(), &bIsWow64)) {
        // ignore errors
        }
    }
    return bIsWow64;
}

string winVer() {
    RTL_OSVERSIONINFOW osinfo = {0};
    osinfo.dwOSVersionInfoSize = sizeof osinfo;
    static auto RtlGetVersion = (fnRtlGetVersion)GetProcAddress(GetModuleHandleW(L"ntdll.dll"), "RtlGetVersion");
    RtlGetVersion(&osinfo);
    return "win-" + to_string(osinfo.dwMajorVersion) + '.' +
        to_string(osinfo.dwMinorVersion) + '.' +
        to_string(osinfo.dwBuildNumber) + " " +
#ifdef _WIN64
        "x64"
#else
        "x86" + (IsWow64() ? " wow64" : "")
#endif
        ;
}

wstring utf8_to_wstring(const string & s) {
	UINT cp = CP_UTF8;
	DWORD flags = 0;
    if (!s.length())
        return wstring(L"");
	auto sz = MultiByteToWideChar(cp, flags, s.c_str(), (int)s.size(), nullptr, 0);
	if (!sz) {
		throw wstring(L"Convert UTF8 to wide failed");
	}
	auto * dst = new wchar_t[sz * sizeof(wchar_t)];
	auto sz2 = MultiByteToWideChar(cp, flags, s.c_str(), (int)s.size(), dst, sz);
	if (sz2 != sz)
		throw wstring(L"Convert UTF8 to wide failed 2");

	auto ret = wstring(dst, dst + sz);
	delete[] dst;
	return ret;
}

string wstring_to_utf8(const wstring & s) {
	UINT cp = CP_UTF8;
	DWORD flags = 0;
    if (!s.length())
        return string("");
	auto sz = WideCharToMultiByte(cp, flags, s.c_str(), (int)s.size(), nullptr, 0, nullptr, nullptr);
	if (!sz) {
		throw wstring(L"Convertion to UTF8 failed");
	}
	auto * buf = new char[sz];
	auto sz2 = WideCharToMultiByte(cp, flags, s.c_str(), (int)s.size(), buf, sz, nullptr, nullptr);
	if (sz2 != sz) 
		throw wstring(L"Convertion to UTF8 failed 2");

	auto ret = string(buf, buf + sz);
	delete[] buf;
	return ret;
}

void password_set(const wstring & s) {
	CREDENTIALW credsToAdd = {};
	credsToAdd.Flags = 0;
	credsToAdd.Type = CRED_TYPE_GENERIC;
	credsToAdd.TargetName = const_cast<wchar_t*>(target);
	credsToAdd.CredentialBlob = (LPBYTE)s.c_str();
	credsToAdd.CredentialBlobSize = (DWORD)(s.size()*sizeof(wchar_t));
	credsToAdd.Persist = CRED_PERSIST_LOCAL_MACHINE;
	credsToAdd.UserName = L"masterkey";

	if (!CredWrite(&credsToAdd, 0)) {
        wstring error(L"CredWrite failed ");
        error += GetFormattedMessage(GetLastError());
        throw error;
	}
}

auto password_get() {
	PCREDENTIALW creds;
	if (!CredRead(target, 1, 0, &creds)) {
        wstring error(L"CredRead failed ");
        DWORD lasterr = GetLastError();
        error += GetFormattedMessage(lasterr);
        if (lasterr == ERROR_NOT_FOUND) {
            return wstring(L"");
        }
        throw error;
    }
	auto const * const passwordOut = (wchar_t const * const)creds->CredentialBlob;
	auto ret = wstring(passwordOut, passwordOut + creds->CredentialBlobSize / sizeof(wchar_t));
	CredFree(creds);
	return ret;
}

int jsoneq(const char *json, jsmntok_t *tok, const char *s) {
	if (tok->type == JSMN_STRING && (int)strlen(s) == tok->end - tok->start &&
		strncmp(json + tok->start, s, tok->end - tok->start) == 0) {
		return 0;
	}
	return -1;
}

void native_bridge() {
	while (1) {
		jsmn_parser p;
		jsmntok_t t[128];
		uint32_t msg_sz;
		cin.read((char*)&msg_sz, sizeof msg_sz);
		if (msg_sz > 1024)
			throw string("Message too long");
		if (cin.eof())
			return;

		char * buf = new char[msg_sz];
		cin.read(buf, msg_sz);
		jsmn_init(&p);

		int r = jsmn_parse(&p, buf, msg_sz, t, (unsigned)size(t));
		if (r < 0) {
			cerr << "Failed to parse JSON: " << r << ' ' << msg_sz << endl;
			throw 0;
		}
		else if (r < 1 || t[0].type != JSMN_OBJECT) {
			cerr << "JSON: expected object" << r << endl;
			throw 0;
		}
		
		string type;
		string value;
		for (auto i = 1; i < r; ++i) {
			if (jsoneq(buf, &t[i], "type") == 0) {
				char * pp = buf + t[i + 1].start;
				type = string(pp, pp + t[i + 1].end - t[i + 1].start);
				i++;
			}
			else if (jsoneq(buf, &t[i], "value") == 0) {
				char * pp = buf + t[i + 1].start;
				value = string(pp, pp + t[i + 1].end - t[i + 1].start);
				i++;
			}
		}
		if (type == string("pwget")) {
			cerr << "GET PASSWORD\n";
            try {
                string s("{\"type\": \"pwgetreply\", \"success\": true, \"value\": \"");
                wstring pw = password_get();
                string pwc = wstring_to_utf8(pw);

                s += wstring_to_utf8(pw) + "\"}";

                uint32_t sz = (uint32_t)s.size();
                cout.write((char*)&sz, sizeof sz);
                cout.write(s.c_str(), sz);
            }
            catch (wstring err) {
                wcerr << L"pwget ERROR: " << err.c_str() << endl;
                cout << "{\"type\": \"pwgetreply\", \"success\": false}";
            }
		}
		else if (type == string("pwset") && !value.empty()) {
            try {
                password_set(utf8_to_wstring(value));
                string s("{\"type\": \"pwsetreply\", \"success\": true}");
                uint32_t sz = (uint32_t)s.size();
                cout.write((char*)&sz, sizeof sz);
                cout.write(s.c_str(), sz);
            }
            catch (wstring err) {
                wcerr << L"pwget ERROR: " << err.c_str() << endl;
                string s("{\"type\": \"pwsetreply\", \"success\": false}");
                uint32_t sz = (uint32_t)s.size();
                cout.write((char*)&sz, sizeof sz);
                cout.write(s.c_str(), sz);
            }
		}
        else if (type == string("comcheck")) {
            stringstream ss;
            ss << "{\"type\":\"comcheckreply\",\"success\":true," <<
                "\"os\": \"" << winVer() << "\"," <<
                "\"version\":\"" << exeversion <<
                "\"}";

            uint32_t sz = (uint32_t)ss.tellp();
            cout.write((char*)&sz, sizeof sz);
            cout.write(ss.str().c_str(), sz);

        }
		else
			throw wstring(L"Illegal message");
	}
}

std::wstring ReplaceAll(const std::wstring & str, const std::wstring& from, const std::wstring& to) {
	wstring ret(str);
	size_t start_pos = 0;
	while ((start_pos = ret.find(from, start_pos)) != std::string::npos) {
		ret.replace(start_pos, from.length(), to);
		start_pos += to.length(); // Handles case where 'to' is a substring of 'from'
	}
	return ret;
}

wstring GetFormattedMessage(LONG errCode)
{
	LPWSTR pBuffer = NULL;
	FormatMessageW(FORMAT_MESSAGE_FROM_SYSTEM |
		FORMAT_MESSAGE_ALLOCATE_BUFFER,
		NULL,
		errCode,
		0,
		(LPWSTR)&pBuffer,
		0,
		NULL);

	wstring ret(pBuffer);
	LocalFree(pBuffer);

	return ret;
}

HKEY createOrOpenRegKey(bool installAllUsers, const wchar_t * path) {
	HKEY keyh;
	auto l = RegCreateKeyExW(
		installAllUsers ? HKEY_LOCAL_MACHINE : HKEY_CURRENT_USER,
		path,
		0,
		NULL,
		REG_OPTION_NON_VOLATILE,
		KEY_ALL_ACCESS | KEY_WOW64_64KEY,
		NULL,
		&keyh,
		NULL);
	if (l) {
		wstring error(L"CreateKey");
		error += GetFormattedMessage(l);
		throw error;
	}
	return keyh;
}

void writeRegKey(HKEY keyh, wstring str) {
	auto l = RegSetValueExW(
        keyh, 
        NULL, 
        0, 
        REG_SZ, 
        (BYTE*)str.c_str(), 
        (DWORD)((str.size()) * sizeof(wchar_t)));
	if (l) {
		wstring error(L"WriteValue");
		error += GetFormattedMessage(l);
		throw error;
	}
}

void install_firefox(bool installAllUsers, wstring & binpath) {
	const wchar_t regpath[] = L"SOFTWARE\\Mozilla\\NativeMessagingHosts\\no.ttyridal.pwvault_gateway";

	wstring fname = binpath.substr(0, binpath.size() - 4) + L"_ff.json";
	wcerr << L"Create file " << fname.c_str() << endl;

	wofstream f(fname, ofstream::trunc);
	f << L"{\n"
		<< L"  \"name\": \"no.ttyridal.pwvault_gateway\",\n"
		<< L"  \"description\" : \"Exposes the OS password vault to masterpassword extension\",\n"
		<< L"  \"path\" : \"" << ReplaceAll(binpath, L"\\", L"\\\\").c_str() << L"\",\n"
		<< L"  \"type\" : \"stdio\",\n"
		<< L"  \"allowed_extensions\" : [\"jid1-pn4AFskf9WBAdA@jetpack\"]\n"
		<< L"}";
	f.close();

	wcerr << L"Write registry " << (installAllUsers ? L"HKLM\\" : L"HKCU\\") << regpath << endl;
	HKEY keyh = createOrOpenRegKey(
		installAllUsers, 
		regpath);
	writeRegKey(keyh, fname);
	RegCloseKey(keyh);
}

void install_chrome(bool installAllUsers, wstring & binpath) {
	const wchar_t regpath[] = L"SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\no.ttyridal.pwvault_gateway";

	wstring fname = binpath.substr(0, binpath.size() - 4) + L"_chrome.json";
	wcerr << L"Create file " << fname.c_str() << endl;

	wofstream f(fname, ofstream::trunc);
	f << L"{\n"
		<< L"  \"name\": \"no.ttyridal.pwvault_gateway\",\n"
		<< L"  \"description\" : \"Exposes the OS password vault to masterpassword extension\",\n"
		<< L"  \"path\" : \"" << ReplaceAll(binpath, L"\\", L"\\\\").c_str() << L"\",\n"
		<< L"  \"type\" : \"stdio\",\n"
		<< L"  \"allowed_origins\": [\n"
        << L"            \"chrome-extension://hifbblnjfcimjnlhibannjoclibgedmd/\",\n", // chrome extension id
        << L"            \"chrome-extension://hhlpgmeeiabedlfldelibppckcfdkilp/\"\n",  // edge extension id
        << L"  ]\n"
		<< L"}";
	f.close();

	wcerr << L"Write registry " << (installAllUsers ? L"HKLM\\" : L"HKCU\\") << regpath << endl;
	HKEY keyh = createOrOpenRegKey(
		installAllUsers,
		regpath);
	writeRegKey(keyh, fname);
	RegCloseKey(keyh);
}

int wmain(int argc, wchar_t * argv[])
{
	argv = CommandLineToArgvW(GetCommandLine(), &argc);
    initExeVersion(argv[0]);

	if (argc > 1 && (wstring(argv[1]) == wstring(L"test"))) {
		_setmode(_fileno(stderr), _O_U16TEXT);
        wcerr << "NativeBridge " << exeversionw << ' ' << utf8_to_wstring(winVer()) << endl;

        try {
            if (argc > 2 && (wstring(argv[2]) == wstring(L"pwget"))) {
                wcerr << L"output: " << password_get().c_str() << endl;
            } else if (argc > 3 && (wstring(argv[2]) == wstring(L"pwset"))) {
                password_set(wstring(argv[3]));
            } else
                wcerr << L"Invalid arguments\n";
        }
        catch (wstring e) {
            wcerr << L"ERROR: " << e.c_str() << endl;
        }
    }
    else if (argc > 1 && (wstring(argv[1]) == wstring(L"install"))) {
        _setmode(_fileno(stderr), _O_U16TEXT);

        wchar_t buffer[MAX_PATH];
        GetModuleFileName(NULL, buffer, MAX_PATH);
        wstring fname(buffer);

        bool installAllUsers = argc > 2 && wstring(argv[2]) == wstring(L"global");
        install_firefox(installAllUsers, fname);
        install_chrome(installAllUsers, fname);
    }
    else {
        cerr << "Native bridge: " << exeversion << endl;
        set_binary_io();
        try {
            native_bridge();
        }
        catch (string err) {
            cerr << "FatalError: " << err.c_str() << endl;
            return -1;
        }
        catch (wstring err) {
            cerr << "FatalError: " << wstring_to_utf8(err).c_str() << endl;
            return -1;
        }
        catch (int) {
            return -1;
        }
	}

	return 0;
}