#include <ft2build.h>
#include <freetype.h>
#include <ftbitmap.h>

#include <iostream>

extern "C" bool initFreetype(const char *filepath,int size);

const wchar_t utfspace[]={' '};

FT_Library ftLibrary;
FT_Face ftFace;

bool initFreetype(const char *face,int size){
	FT_Error error;
	error=FT_Init_FreeType(&ftLibrary);
	if(error) return false;
	error=FT_New_Face(ftLibrary,face,0,&ftFace);
	if(error) return false;
	error=FT_Select_Charmap(ftFace,FT_ENCODING_UNICODE);
	if(error) return false;
	error=FT_Set_Char_Size(ftFace,0,size<<6,72,72);
	int ascend=ftFace->size->metrics.ascender;
	int descend=-ftFace->size->metrics.descender;
	int height=ftFace->size->metrics.height;
	std::cout << "initFreetype face:" << face << " height:" << height;
	std::cout << " ascend:" << ascend << " descend:" << descend << std::endl;
	return true;
}

/*

struct TFreetypeFont:TSystemFont{
  TFreetypeFont *_next;
  TFreetypeDib *_owner;

  int _size;
  int _weight;

  int _width;
  int _ascend;
  int _descend;
  int _height;

  FT_Face _aface;

  FT_Error _error;

  TFreetypeFont(TFreetypeDib *owner,const char* filepath,int size,int weight){

	_next=0;
	_owner=owner;
	_size=size;
	_weight=weight;

	_aface=0;
 
	_error=FT_New_Face(ftLibrary,filepath,0,&_aface);

	if(_error){
	  return; //TODO: retry with other default path
	}

	_error=FT_Select_Charmap(_aface,FT_ENCODING_UNICODE);

	if(_error){
	  return; //TODO: retry with other default path
	}

	_error=FT_Set_Char_Size(_aface,0,size<<6,72,72);
	if(_error){
	  return; //TODO: retry with other default path
	}

	_ascend=_aface->size->metrics.ascender;
	_descend=-_aface->size->metrics.descender;
	_height=_aface->size->metrics.height>>6;

	int spacewidth,spaceheight;

	calcTextBounds(L" ",1,&spacewidth,&spaceheight);

	_width=spacewidth; //TODO: get width of char code 0
  }

  ~TFreetypeFont(){
  }

  virtual int getAscend(){
	return _ascend/75;
  }

  virtual int getDescend(){
	return _descend/75;
  }

  virtual int getWidth(){
	return _width;
  }

  virtual int getHeight(){
	return _height;
  }

  virtual void calcTextBounds(const UTF16 *text,int count,int *width,int *height){
	int i,w,h;
	UTF16 charcode;
	FT_UInt index;

	if(!_aface){
	  return;
	}

	w=0;
	h=getHeight();    
	for(i=0;i<count;i++){
	  charcode=text[i];

	  index=FT_Get_Char_Index(_aface,charcode);
	  if(index==0){
		continue;
	  }
	  _error=FT_Load_Char(_aface,charcode,FT_LOAD_DEFAULT);
	  if(_error){
		continue; //TODO: retry with someother charset
	  }

	  w+=_aface->glyph->advance.x>>6;
	  h+=_aface->glyph->advance.y>>6;
	}
	*width=w;
	*height=h;
  }

  virtual void drawText(TPixmap *dest,UTF16 *text,int count){
	int i,x,y,a,argb,xx,yy,w,h,ox,oy;
	UTF16 charcode;
	unsigned char*ft;

	if(!_aface){
	  return;
	}

	x=0;
	y=0;
	for(i=0;i<count;i++){
	  charcode=text[i];
	  _error=FT_Load_Char(_aface,charcode,FT_LOAD_RENDER);
	  if(_error){
		continue; //TODO: retry with someother charset
	  }

//    todo: ajust for font weight
//    FT_Bitmap_Embolden(ftLibrary,&_aface->glyph->bitmap,1<<4,1<<4);

	  w=_aface->glyph->bitmap.width;
	  h=_aface->glyph->bitmap.rows;
	  ft=_aface->glyph->bitmap.buffer;
	  ox=x+_aface->glyph->bitmap_left;
//      oy=y+_size-_aface->glyph->bitmap_top;
	  oy=y+1+getAscend()-_aface->glyph->bitmap_top;
	  for(yy=0;yy<h;yy++){
		for(xx=0;xx<w;xx++){
		  a=ft[xx];
		  argb=(a<<24)|0xffffff;
		  dest->plot(ox+xx,oy+yy,(a<<24)|0xffffff);          
		}
		ft+=_aface->glyph->bitmap.pitch;
	  }
	  x+=_aface->glyph->advance.x>>6;
	  y+=_aface->glyph->advance.y>>6;
	}
  }

};

/// singleton dib font list

TFreetypeFont *ftfontlist=0;

/// unlike GDI, freetype needs fontname to bge absolute path to ttf file

TSystemFont* TFreetypeDib::openDibFace(const char* fontname,int height,int weight){

  const char* filepath;
  TFreetypeFont *font;

  font=rd_new TFreetypeFont(this,fontname,height,weight);
  
  if (font->_error){
	rd_delete font;
	return 0;
  }
  
  font->_next=ftfontlist;
  ftfontlist=font;
  return font;
}

void TFreetypeDib::resizeDib(int w,int h,int flags){
  _srcpixels=(unsigned char*)rd_malloc(w*h);
  _pixmap->setshape(_srcpixels,w,h,w,flags);
}

TFreetypeDib::TFreetypeDib(){

  FT_Init_FreeType(&ftLibrary);

  int bits=8;
  switch(bits){
	case 8:
	  _pixmap=new TPixmap8();
	  break;
	default:
	  return;//throw L"chunks";
  }
}

TFreetypeDib::~TFreetypeDib(){
  FT_Done_FreeType(ftLibrary);
  delete _pixmap;
}
*/