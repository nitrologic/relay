// pnglibconf.h
#pragma once

#define PNG_WRITE_BGR_SUPPORTED

#define PNG_READ_INTERLACING_SUPPORTED
#define PNG_WRITE_INTERLACING_SUPPORTED

#define PNG_STDIO_SUPPORTED
#define PNG_ERROR_TEXT_SUPPORTED
#define PNG_WRITE_INT_FUNCTIONS_SUPPORTED
#define PNG_READ_INT_FUNCTIONS_SUPPORTED

#define PNG_API_RULE 0
#define PNG_CALL_TYPEA(type, name, args) type (PNGAPI name) args
#define PNG_CALL_TYPE(type, name, args) type (PNGAPI name) args
#define PNG_FUNCTION(type, name, args, attributes) attributes type PNGAPI name args
#define PNG_INTERNAL_FUNCTION(type, name, args, attributes) attributes type name args
#define PNG_EXPORT_TYPE(t) t
#define PNG_LINKAGE_API
#define PNG_LINKAGE_FUNCTION extern
#define PNG_EMPTY
#define PNG_API_IS_O

/* Enable standard features */
#define PNG_READ_SUPPORTED
#define PNG_WRITE_SUPPORTED
#define PNG_FLOATING_POINT_SUPPORTED
#define PNG_FIXED_POINT_SUPPORTED

#define PNG_ZLIB_IMPORT 0

#define PNG_USER_WIDTH_MAX 8192
#define PNG_USER_HEIGHT_MAX 8192

#define PNG_Z_DEFAULT_STRATEGY Z_DEFAULT_STRATEGY
#define PNG_Z_DEFAULT_COMPRESSION Z_DEFAULT_COMPRESSION
#define PNG_Z_DEFAULT_NOFILTER_STRATEGY 0

#define PNG_ZBUF_SIZE 8192
#define PNG_INFLATE_BUF_SIZE 8192

#define PNG_IDAT_READ_SIZE PNG_ZBUF_SIZE

/*

#define Z_NO_COMPRESSION         0
#define Z_BEST_SPEED             1
#define Z_BEST_COMPRESSION       9
#define Z_DEFAULT_COMPRESSION  (-1)

#define Z_FILTERED            1
#define Z_HUFFMAN_ONLY        2
#define Z_RLE                 3
#define Z_FIXED               4
#define Z_DEFAULT_STRATEGY    0

*/