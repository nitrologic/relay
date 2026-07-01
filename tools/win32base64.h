#pragma once

// Encodes a raw buffer into a Base64 string using crypt32.lib.

#include <wincrypt.h>
#include <vector>
#include <string>

std::string encodeBase64(const void* pPixels, size_t size) {
        DWORD dwFlags = CRYPT_STRING_BASE64 | CRYPT_STRING_NOCRLF;
        DWORD dwOutLen = 0;
        // Calculate required buffer size
        if (!CryptBinaryToStringA((const BYTE*)pPixels, (DWORD)size, dwFlags, NULL, &dwOutLen)) {
                return "";
        }
        std::vector<char> buffer(dwOutLen);
        if (!CryptBinaryToStringA((const BYTE*)pPixels, (DWORD)size, dwFlags, buffer.data(), &dwOutLen)) {
                return "";
        }
        return std::string(buffer.data());
}
