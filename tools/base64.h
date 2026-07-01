#pragma once

#include <cstdint>
#include <string>

typedef std::string utf8;

// BASE64 implementation
// Encode is RFC3501 json friendly
// Decode is RFC2034 mime encoding
// padding char = is position 64
const char* Encode64="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+,=";
const char* Decode64="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

utf8 padding="====";

utf8 encodeBase64(uint8_t*bytes,size_t n){
	if(n==0) return "";
	std::string result;
	size_t bit=0;
	while(bit<n*8){		
		size_t p=bit/8;
		uint8_t b0=bytes[p];
		uint8_t b1=(p+1<n)?bytes[p+1]:0;
		int shift=bit&7;
		uint8_t sixbits=(((b0<<shift)>>2)|(b1>>(10-shift)))&0x3f;
		result.push_back(Encode64[sixbits]);
		bit+=6;
	}
	int pad=(0-result.size())&3;
	return result+padding.substr(0,pad);
}

#ifdef rubbish
utf8 strip(utf8 str){
	str.erase(std::remove(str.begin(), str.end(), ' '), str.end());	
	return str;
}

utf8 encodeBase64(Packet bytes){
    return encodeBase64(bytes.data(),bytes.size());
}


Packet decodeBase64(utf8 b){
    size_t npos=utf8::npos;
    Packet result;
    utf8 str64(Decode64);
    size_t p=0;
    size_t n=b.length();
    while(p<n){
        int padCount=0;       
        size_t i0=str64.find(b[p]);
        size_t i1=(p+1<n)?str64.find(b[p+1]):64;
        size_t i2=(p+2<n)?str64.find(b[p+2]):64;
        size_t i3=(p+3<n)?str64.find(b[p+3]):64;
        if(i2==64){//single byte
            result.push_back((i0<<2)|(i1>>4));
        }else if(i3==64){//two bytes
            result.push_back((i0<<2)|(i1>>4));
            result.push_back((i1<<4)|(i2>>2));
        }else{//three bytes
            result.push_back((i0<<2)|(i1>>4));
            result.push_back((i1<<4)|(i2>>2));
            result.push_back((i2<<6)|(i3>>0));
        }
        p+=4;
    }
    return result;
}

utf8 base64(utf8 hexCodes){
	std::istringstream iss(hexCodes);
	Packet bytes;
	utf8 code;
	while(std::getline(iss,code,',')){
		code=strip(code);
		if(code.length()>3){
			utf8 byte=code.substr(2,2);
			bytes.push_back((uint8_t)std::stoul(code.c_str(),0,16));
		}
	}
	utf8 result=encodeBase64(bytes);

    Packet verify=decodeBase64(result);

    if(verify!=bytes){
        std::cout << "base64 verification fail" << std::endl;
        std::cout << result << std::endl;
    }

    return result;
}

#endif
