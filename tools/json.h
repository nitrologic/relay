#pragma once

#include <cstddef>
#include <string>
#include <vector>
#include <map>
#include <stack>
#include <algorithm>
#include <limits>

#include <cstdint>
#include <sstream>
#include <iostream>


// https://www.json.org/json-en.html

// follows ECMA-404 The JSON Data Interchange Standard with integer / number differentiation

//#include "pico.h"

typedef std::string utf8;

const int64_t NotAnInt=0x8000000000000000;
const double NotANumber=std::numeric_limits<double>::quiet_NaN();

enum JSType{Object,Array,String,Number,Integer,True,False,Null};

struct JSObject;
struct JSArray;

// TODO: add GetReal Integer/Number accessor

struct JSValue{
	JSType type;
	utf8 string;
	union{
		JSObject *object;
		JSArray *array;
		double number;
		int64_t integer;
	};

	JSValue():type(Null){
	}

	JSValue(JSObject *object):object(object){
		type=Object;
	};

	JSValue(JSArray *array):array(array){
		type=Array;
	}

	JSValue(utf8 literal,bool isString){
		if(isString){
			type=String;
			string=literal;
		}else if(literal=="true"){
			type=True;
		}else if(literal=="false"){
			type=False;
		}else if(literal=="null" || literal.length()==0){
			type=Null;
		}else{
			char *end;
			if(literal.find('.')==std::string::npos && literal.find('e')==std::string::npos){
				type=Integer;
				integer=std::strtoll(literal.c_str(),&end,10);
			}else{
				type=Number;
				number=std::strtod(literal.c_str(),&end);
			}
		}
	}
	utf8 stringMember(utf8 name) const;
	JSValue *valueMember(utf8 name) const;
	JSObject *objectMember(utf8 name) const;
	JSArray *arrayMember(utf8 name) const;
	int64_t integerMember(utf8 name) const;
	double numberMember(utf8 name) const;
	utf8 toJSON() const;
};

struct JSObject{
	std::vector<utf8> names;
	std::vector<JSValue*> values;

	size_t size() const{
		return names.size();
	}

	JSValue *member(utf8 name) const{
		ptrdiff_t index = std::find(names.begin(),names.end(),name)-names.begin();
		JSValue *value=(index<values.size())?values[index]:NULL;
		return value;
	}

	JSObject *objectMember(utf8 name) const{
		JSValue *value=member(name);
		if(value && value->type==Object) return value->object;
		return NULL;
	}

	JSArray *arrayMember(utf8 name) const{
		JSValue *value=member(name);
		if(value && value->type==Array) return value->array;
		return NULL;
	}

	utf8 stringMember(utf8 name) const{
		ptrdiff_t index = std::find(names.begin(),names.end(),name)-names.begin();
		if(index==names.size()) return utf8();
		JSValue *value=values[index];
		if(value && value->type==String) return value->string;
		return value->toJSON();		
	}

	int64_t integerMember(utf8 name) const{
		ptrdiff_t index = std::find(names.begin(),names.end(),name)-names.begin();
		if(index==(long long)names.size()) return NotAnInt;
		JSValue *value=values[index];
		if(value && value->type==Integer) return value->integer;
		return NotAnInt;		
	}

	double numberMember(utf8 name) const{
		ptrdiff_t index = std::find(names.begin(),names.end(),name)-names.begin();
		if(index==names.size()) return NotANumber;
		JSValue *value=values[index];
		if(value && value->type==Number) return value->number;
		return NotANumber;		
	}

	utf8 toJSON() const{
		std::stringstream ss;
		ss << "{";
		size_t n=names.size();
		for(size_t i=0;i<n;i++){
			ss << "\"" << names[i] << "\":" << values[i]->toJSON();
			if(i<n-1){
				ss << ",";
			}
		}
		ss << "}";
		return ss.str();
	}
};

struct JSArray{
	std::vector<JSValue*> values;
	utf8 toJSON() const{
		std::stringstream ss;
		ss << "[";
		size_t n=values.size();
		for(size_t i=0;i<n;i++){
			ss << values[i]->toJSON();
			if(i<n-1){
				ss << ",";
			}
		}
		ss << "]";
		return ss.str();
	}
};

JSValue *JSValue::valueMember(utf8 name) const{
	if(type==Object){
		return object->member(name);
	}
	return NULL;
}

JSObject *JSValue::objectMember(utf8 name) const{
	if(type==Object){
		return object->objectMember(name);
	}
	return NULL;
}

JSArray *JSValue::arrayMember(utf8 name) const{
	if(type==Object){
		return object->arrayMember(name);
	}
	return NULL;
}

utf8 JSValue::stringMember(utf8 name) const{
	if(type==Object){
		return object->stringMember(name);
	}
	return utf8();
}

int64_t JSValue::integerMember(utf8 name) const{
	if(type==Object){
		return object->integerMember(name);
	}
	return NotAnInt;
}

double JSValue::numberMember(utf8 name) const{
	if(type==Object){
		return object->numberMember(name);
	}
	return NotANumber;
}

utf8 JSValue::toJSON() const{
	switch(type){
		case Object:
			return object->toJSON();
		case Array:
			return array->toJSON();
		case String:
			return "\""+string+"\"";
		case Number:
			return std::to_string(number);
		case Integer:
			return std::to_string(integer);
		case True:
			return "true";
		case False:
			return "false";
		case Null:
			return "null";
	}
	return "";
}

// simon come here

const std::map<char,char> ControlCodes={
	{'"','"'},
	{'\\','\\'},
	{'/','/'},
	{'b','\b'},
	{'f','\f'},
	{'n','\n'},
	{'r','\r'},
	{'t','\t'}
};

enum JSContext{
	InObject,
	InArray
};

struct JSONParser{

	 //TODO: UNESCAPE hex \u0000

	static utf8 parseString(utf8 js){
		std::ostringstream o;
		bool escape=false;
		for(int i=0;i<js.length();i++){
			char c=js[i];
			if(c=='\\'){
				escape=true;
				continue;
			}
			if(escape){
				escape=false;
				switch (c) {
					case 'b': c='\b'; break;
					case 'f': c='\f'; break;
					case 'n': c='\n'; break;
					case 'r': c='\r'; break;
					case 't': c='\t'; break;
				}
			}
			o<<c;
		}
		return o.str();
	}

	int parseRHS(utf8 literal,JSValue *result){
		result=new JSValue(literal,false);
		return 0;
	}

	int parseJSON(utf8 js,JSValue **result){
		std::stack<JSObject*> objects;
		std::stack<JSArray*> arrays;
		std::stack<JSContext> context;
		JSValue *value=NULL;
		bool isNull=true;	//detect empty object/arrays
		utf8 literal;
		utf8 name;
		size_t pos=0;
#ifdef VERBOSE		
		std::cout << "parseJSON parsing js length " << js.length() << std::endl;
#endif
		for(int i=0;i<js.length();i++){
			char c=js[i];
			if(c<9 || c>127){
				std::cout << "parseJSON non ascii char in js "<< (int)c << " pos " << i << std::endl;
				return 1;
			}
		}
		while(true){
			char ch=js[pos++];
			if(ch==','||ch==']'||ch=='}'){
				JSValue *v=value?value:( literal.length()?new JSValue(literal,false):(isNull?new JSValue():new JSValue(name,true)));
				value=NULL;
				literal.clear();
				name.clear();
				if(!isNull||ch==','){
					if(context.top()==InArray){
						arrays.top()->values.emplace_back(v);
					}else{
						objects.top()->values.emplace_back(v);
					}
				}
				isNull=true;
				if(ch==',') continue;
			}

			if(ch=='['){
				arrays.push(new JSArray());
				context.push(InArray);
				isNull=true;
				continue;
			}

			if(ch==']'){
				if(context.top()!=InArray){
					std::cout << "parseJSON unexpected ] while parsing object" << std::endl;
					return 1;
				}

				value=new JSValue(arrays.top());
				isNull=false;
				*result=value;
				arrays.pop();

				context.pop();
				if(objects.size()==0 && arrays.size()==0){
					return 0;
				}
				continue;
			}

			if(ch=='{'){
				objects.push(new JSObject());
				context.push(InObject);
				isNull=true;
				continue;
			}

			if(ch=='}'){
				if(context.top()!=InObject){
					std::cout << "parseJSON unexpected } while parsing array" << std::endl;
					return 2;
				}
				value=new JSValue(objects.top());
				isNull=false;
				*result=value;
				objects.pop();
				context.pop();
				if(objects.size()==0 && arrays.size()==0){
					return 0;
				}
				continue;
			}

			if(ch=='"'){
				std::stringstream ss;
				while(true){
					if(pos>=js.length()){
						std::cout << "parseJSON read past end of content at pos " << pos << std::endl;
						return 3;
					}
					char cp=js[pos++];
					if(cp=='"'){
						name=ss.str();
						isNull=false;
						break;
					}
					if(cp=='\\'){
						char esc=js[pos++];
						if(ControlCodes.count(esc)){
							cp=ControlCodes.at(esc);
						}else if (esc=='u'){
							utf8 hex4=js.substr(pos,4);
							pos+=4;
							std::cout << "TODO char from hex[4] " << hex4;
						}else{
							std::cout << "parseJSON unknown escape character in string with char value" << (int)esc << std::endl;
							return 1;
						}
					}
					ss.put(cp);
				}
				continue;
			}

			if(ch<=32){
				continue; //ignore whitespace
			}

			if(ch==':'){
				if(context.top()!=InObject){
					std::cout << "parseJSON unexpected : while parsing array" << std::endl;
					return 4;
				}
				objects.top()->names.emplace_back(name);
				name.clear();
				continue;
			}

			literal.push_back(ch);
			isNull=false;
		}
	}
};



utf8 jsonifyInts(std::vector<int> ints){
	std::stringstream ss;
	ss<<"[";
	if(ints.size()){
		for(int i:ints){
			ss<<i<<",";
		}
		ss.seekp(-1,std::ios_base::end);
	}
	ss<<"]";
	return ss.str();
}

utf8 jsonifyStrings(std::vector<utf8> strings){
	std::stringstream ss;
	ss<<"[ ";
	for(const utf8 &s:strings){
		ss<<"\""<<s<<"\",";
	}
	ss.seekp(-1,std::ios_base::end);
	ss<<"]";
	return ss.str();
}

utf8 jsonifyArray(std::vector<utf8> strings){
	std::stringstream ss;
	ss<<"[ ";
	for(const utf8 &s:strings){
		ss<<s<<",";
	}
	ss.seekp(-1,std::ios_base::end);
	ss<<"]";
	return ss.str();
}

