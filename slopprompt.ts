// slopprompt.ts - A raw mode prompt replacement for slop fountain
// Copyright (c) 2026 Simon Armstrong
// Licensed under the MIT License

// uses winner=await Promise.race(race) logic to maintain communications
// packed tab code style - unsafe typescript formatted with tabs and minimal white space - sorry
// no abort controllers if you don't mind
// may crash on complex paste on windows - work in progress

const vscodeNonce=Deno.env.get("VSCODE_NONCE")||Deno.env.get("VSCODE_INJECTION")||"";

export function safeString(raw:any):string{
	if (raw === null || raw === undefined) return '';
	if (typeof raw === 'string') return raw;
	console.log("[UNSAFE]",raw.toString());
	const error=new Error("BAD STRING");
	console.log("error",error);
	return raw.toString();
}

//__vsc_nonce=d21c4091-f036-4908-bdcc-5e653abb076b

function echo(...args:any[]){
	const lines=[];
	for(const arg of args){
		const line=arg?.toString();
		lines.push(line);
	}
	const text=lines.join(" ");
	console.error(text);
}

let sloppyPromise;
let riffPromise;
let listenerPromise;
let sloppyListen:boolean=false;
const slopConnections=new Map();
let receivePromises={};

//: Promise<{source:Deno.TcpConn, receive:Uint8Array}>[]=[];

const connectionDecoders = new Map<string, TextDecoder>();

//const decoderConnection=new TextDecoder("utf-8");
const rxBufferSize=1e6;
const rxBuffer=new Uint8Array(rxBufferSize);
const rxDecoder=new TextDecoder("utf-8",{stream:true});

// these async functions end up in receiver promise lists
// retun source,receive,name or source,error,name
async function readNamedConnection(name:string,connection:Deno.TcpConn){
	try{
		const n=await connection.read(rxBuffer);
		//echo("readNamedConnection",n,name);
		if(n==null) return {source:connection};
		const bytes=rxBuffer.subarray(0,n);
		return {source:connection,receive:bytes,name};
	}catch(error){
		echo("readNamedConnection error",error);
		return {source:connection,error,name};
	}
}

// take care - collides with slopnet.ts
// TODO: short circuit - Fatal JavaScript out of memory: Ineffective mark-compacts near heap limit

let connectionCount=0;
let slopListener=[];
let slopNames={};

// returns {connection,name} or {error}

async function listenPort(port:number,slopName:string){
	if(!slopListener[port]){
		try{
			slopListener[port]=Deno.listen({ hostname: "localhost", port, transport: "tcp" });
		}catch(error){
			echo("listenPort listen failure",port);
			return {error:error};
		}
	}
	slopNames[port]=slopName;
	echo("[PROMPT] listening for slop",port,slopName);
	const connection=await slopListener[port].accept();
	const name="connection"+(connectionCount++);
	return {connection,name};
}

export function listenService(){
	if(listenerPromise) {
		echo("[PROMPT] listenService - listenPort already active");
		return;
	}
	sloppyPromise=listenPort(8081,"sloppy");
	listenerPromise=sloppyPromise;
	sloppyListen=true;
}

export async function announceCommand(words:string[]){
	const text=words.join(" ");
	if(text){
		const bytes=encoder.encode("/"+text);
		for(const connection of slopConnections){
			connection?.write(bytes);
		}
	}
}

export async function slopBroadcast(text:string,from:string){
	// fix content with only \n
	if(text && from){
		const message=text.replaceAll("\r\n","\n").replaceAll("\n","\r\n");
		const safe=safeString(message);
		if(safe!=message){
			echo("[PROMPT] slopBroadcast unsafe");
		}
		const json=JSON.stringify({messages:[{message,from}]},null,0);
		// NDJSON is the rule
		const bytes=encoder.encode(json+"\n");
		const n=bytes.byteLength;
		const good=[];
		for(const [name,connection] of slopConnections){
			try{
				let total=0;
				while(total<n){
					const packet=bytes.subarray(total);
					const sent=await connection.write(packet);
					if(sent==null || sent==-1){
						throw("chunks");
					}
					total+=sent;
				}
				good.push(connection)
			}
			catch(error){
				echo("faking it until we make it",name,error.message);
				await connection.close();
				slopConnections.delete(name);
				delete receivePromises[name];
			}
		}
	}else{
		echo("help me help you");
	}
}

const reader=Deno.stdin.readable.getReader();
const writer=Deno.stdout.writable.getWriter();

// shortcode :heart: mapping :eyes:

const shortcode=JSON.parse(await Deno.readTextFile("./shortcode.json"));

export function replaceShortCodes(text: string): string {
	return text.replace(/:([a-z_]+):/g, (match, code) => {return shortcode[code] || match;});
}


// grapheme clusters are the new u8 ???

// see stringWidth(text:string) below for bespoke column counting of wide emoji

const encoder=new TextEncoder();
const decoder=new TextDecoder("utf-8");
const segmenter=new Intl.Segmenter("en", { granularity: "grapheme" });

const streamDecoder=new TextDecoder("utf-8",{stream:true});

let grapheme:string[]=[];

function addInput(input:string) {
//	grapheme.push(...(input.match(/(\p{Emoji}\uFE0F?|\p{Emoji_Presentation}|\p{Extended_Pictographic}\u200D?[\p{Emoji_Modifier}\uFE0F]*)+|./gu) || []));
//	grapheme.push(...(input.match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic}\u200D?)+|./gu) || []));
	grapheme.push(...[...segmenter.segment(input)].map(segment => segment.segment));
}

function forwardCursor(bytes) {
	bytes.push(0x1b,'[','C',';');	//\x1b[C`
}

const TabWidth=8;
function backspace(bytes:number[]) {
	if (grapheme.length){
		const lastChar=grapheme.pop()!;
		const isTab=(lastChar=="\t");
		if(isTab){
			// instead of tracking cursor pos
			// pos is position at end of prompt
			const pos=stringWidth(grapheme.join(""));
			const tabStop=(pos/TabWidth)|0;
			const spaces=TabWidth - (pos % TabWidth);
			for (let i=0; i < spaces; i++) {
				bytes.push(0x08);
			}
		}else{
			const width=stringWidth(lastChar) || 1;
			for (let i=0; i <	 width; i++) {
				bytes.push(0x08, 0x20, 0x08);
			}
		}
	}
}

function replaceText(bytes:[],count:number,text:string){
	for(let i=0;i<count;i++){
		backspace(bytes);
	}
	const raw=encoder.encode(text);
	for(let i=0;i<raw.length;i++){
		bytes.push(raw[i]);
	}
}

// grapheme geometry

// a simple fallback for platforms with special needs
// > windows terminals :eyes:

export function isCmdExe(): boolean {
	if (Deno.build.os !== "windows") return false;
	const comspec = Deno.env.get("COMSPEC") ?? "";
	if (!comspec.toLowerCase().includes("cmd.exe")) return false;
	return true;
}

// emoji wide char groups may need cludge for abnormal plungers
// unicode ranges currently featuring wide chars
// codepoint for 🜁 is 1f701
// see also
const WideRanges=[
	[0x1100, 0x115F],[0x2329, 0x232A],[0x2600, 0x26FF],
	[0x2E80, 0x303E],[0x3040, 0xA4CF],[0xAC00, 0xD7A3],
	[0xF900, 0xFAFF],[0xFE10, 0xFE19],[0xFE30, 0xFE6F],[0xFF00, 0xFF60],[0xFFE0, 0xFFE6],
	[0x1F000, 0x1F02F],[0x1F0A0, 0x1F0FF],[0x1F100, 0x1F1FF],
	[0x1F300, 0x1F6FF],
	// added gape for 1f701  🜁
	[0x1F800, 0x1F9FF],
// slop pail mode [0x1fad1, 0x1fad2],
	[0x20000, 0x2FFFD],
	[0x30000, 0x3FFFD]
];
const isWide=(cp: number) => WideRanges.some(([start, end]) => cp >= start && cp <= end);

//🌏 1f30f

const isDoubleWidth = (() => {
	const ranges = [
		[0x1100, 0x115F],
		[0x2329, 0x232A],
		[0x26a1, 0x26a2],	//charcode for ⚡️
		[0x2E80, 0x303E],
		[0x3040, 0xA4CF],
		[0xAC00, 0xD7A3],
		[0xF900, 0xFAFF],
		[0xFE10, 0xFE19],
		[0xFE30, 0xFE6F],
		[0xFF00, 0xFF60],
		[0xFFE0, 0xFFE6],
		[0x1F000, 0x1F02F],
		[0x1F0A0, 0x1F0FF],
		[0x1F100, 0x1F1FF],
		[0x1F300, 0x1F6FF],
// added gape for 1f701  🜁
		[0x1F800, 0x1FAFF],// was 9ff
		[0x20000, 0x2FFFD],
		[0x30000, 0x3FFFD]
	];
	return cp =>
		ranges.some(([s, e]) => cp >= s && cp <= e);
})();

export function stringWidth(text:string):number{
	const thinPail:boolean=vscodeNonce||false;
	let w=0;
	for (const ch of text) {
		const codepoint=ch.codePointAt(0) ?? 0;
		if (codepoint===0xFE0F) continue; // Skip variation selectors
//		w += isWide(codePoint) ? 2 : 1;
		const thin=(codepoint==0x1F578)||(codepoint==0x1F3dB)||(codepoint==0x1F5A5)||(thinPail && codepoint==0x1FAA3);//🏛️🖥️🪣
		w+=thin?1:(isDoubleWidth(codepoint)?2:1);
	}
	return w;
}

// 2.5 discord wide unicode
function discordWide(cp:number):boolean{
	if (cp >= 0x1100 && cp <= 0x115F) return true;
	if (cp >= 0x2E80 && cp <= 0xA4CF) return true;
	if (cp >= 0xAC00 && cp <= 0xD7AF) return true;
	if (cp >= 0xF900 && cp <= 0xFAFF) return true;
	if (cp >= 0xFE10 && cp <= 0xFE1F) return true;
	if (cp >= 0xFE30 && cp <= 0xFE6F) return true;
	if (cp >= 0xFF00 && cp <= 0xFF60) return true;
	if (cp >= 0xFFE0 && cp <= 0xFFE6) return true;
	if (cp==0x1f3db) return false;//🏛️
	if (cp==0x1f399) return false;//🎙
	if (cp==0x1f5bc) return false;//🖼
	if (cp==0x1f5e3) return false;//🗣
	if (cp==0x1f441) return false;//👁
	if (cp >= 0x1F300 && cp <= 0x1F5FF) return true;  // Pictographs
	if (cp >= 0x1F600 && cp <= 0x1F64F) return true;  // Emoticons
	if (cp >= 0x1F680 && cp <= 0x1F6FF) return true;  // Transport & Map
	if (cp >= 0x1F900 && cp <= 0x1F9FF) return true;  // Supplemental
	if (cp >= 0x1FA00 && cp <= 0x1FAFF) return true;  // NEW: includes 🪣 U+1FAD0
	if (cp === 0x26F2) return true; // ⛲
	if (cp === 0x26C5) return true; // ⛅
	return false;
}
// 1.5 discord wide unicode
function discordThin(cp:number):boolean{
	if (cp==0x1f3db) return true;//🏛️
//	if (cp==0x1f701) return true; //🜁
	if (cp==0x1f5bc) return true;//🖼
	if (cp==0x1f5e3) return true;//🗣
//	if (cp === 0x2741) return true; // ❁
//	if (cp === 0x2743) return true; // ❃
	if (cp==0x1f441) return true;//👁
	return false;
}

function discordThick(cp:number):boolean{
	if (cp==0x1f3db) return true;//🏛️
	if (cp==0x1f399) return true;//🎙
	if (cp==0x1f5bc) return true;//🖼
	if (cp==0x1f5e3) return true;//🗣
}


export function discordStringWidth(text:string):number{
	let w=0;
	for (const ch of text) {
		const codepoint=ch.codePointAt(0) ?? 0;
		if (codepoint===0xFE0F) continue; // Skip variation selectors
		const width=discordWide(codepoint)?2.5:discordThick(codepoint)?2:discordThin(codepoint)?1.5:1;
		w+=width;
	}
	return w;
}


// terminal history

let currentInput="";
let historyIndex=-1;
const promptHistory:string[]=[];

async function navigateHistory(direction:"back"|"forward") {
	if (historyIndex === -1 && direction === "back") {
		currentInput=grapheme.join("");
	}
	const newIndex=Math.max(-1,Math.min(historyIndex+(direction=="forward"?1:-1),promptHistory.length));
	if (newIndex === historyIndex) return;
	historyIndex=newIndex;
	const validIndex=historyIndex >= 0 && historyIndex < promptHistory.length;
	const displayText= validIndex ? promptHistory[historyIndex] : currentInput;
	// ANSI sequence to Move to start of line, Clear line, Write new content
	await writer.write(encoder.encode('\r' + ANSI.CLEAR_LINE + displayText));
	grapheme=[...segmenter.segment(displayText)].map(segment => segment.segment);
}

const CURSOR_UP=65;
const CURSOR_DOWN=66;
const CURSOR_RIGHT=67;
const CURSOR_LEFT=68;
const CSI_HOME=72;
const CSI_END=70;
const CSI_STATUS=48;
const CSI_EXT0=50;
const CSI_EXT1=51;
const CSI_EXT3=53;
const CSI_EXT4=54;

// 0x1b 0x5b
function onCSI(bytes,codes:number[]) {
	let n=3;
	const code=codes[2];
	switch(code) {
		case CURSOR_LEFT:
			bytes.push(0x1B, 0x5B, 0x44);
			break;
		case CURSOR_RIGHT:
			bytes.push(0x1B, 0x5B, 0x43);
			break;
		case CURSOR_UP:
			navigateHistory("back");
			break;
		case CURSOR_DOWN:
			navigateHistory("forward");
			break;
		case CSI_STATUS:
			console.log("[RAW] CSI status",codes);
			break;
		case CSI_HOME:
		case CSI_END:
			console.log("[RAW] CSI home end",codes[2]);
			break;
		case CSI_EXT0:
			if(codes[3]==50){
				console.log("[RAW] printer OK");
				n=4;
				break;
			}
		case CSI_EXT1:
		case CSI_EXT3:
		case CSI_EXT4:
			console.log("[RAW] CSI EXT ",codes[2],codes[3]);
			n=4;
			break;
		default:
			console.log("[RAW] CSI ? ",codes)
	}
	return n;
}

let slopFrame=0;
let inCode=false;
let codePos=0;

const ANSI={
	SAVE_CURSOR:'\x1B[s',
	RESTORE_CURSOR:'\x1B[u',
	CLEAR_LINE:'\x1B[K',
	CLEAR_LINE_START:'\x1B[1K',
	CLEAR_LINE_FULL:'\x1B[2K'
};

function harden(text:string,maxLength:number){
	let s=text.normalize("NFC");
	if (s.length > maxLength) s=s.slice(0, maxLength) + "\u2026";
	return s;
}

export async function writeMessage(message:string){
	await writer.write(encoder.encode(harden(message,8e6)));
	await writer.ready;
}

const prompt="]";

// slopPrompt
// returns a line of keyboard input while refreshing background tasks
// leaves raw mode on to fix Windows scroll issue
// fuzzy readPromise life time seems to work well allows read timeouts
let readPromise;
let counter=0;
const decoderStream=new TextDecoder("utf-8",{stream:true});

// [slop] sleep

async function sleep(ms:number) {
	await new Promise(function(resolve) {setTimeout(resolve, ms);});
}

function processUtf8(value: Uint8Array, i: number, bytes: number[]): number {
	const byte = value[i];
	let bytesNeeded = 1;
	if ((byte & 0xE0) === 0xC0) bytesNeeded = 2;
	else if ((byte & 0xF0) === 0xE0) bytesNeeded = 3;
	else if ((byte & 0xF8) === 0xF0) bytesNeeded = 4;
	if (i + bytesNeeded <= value.length) {
		const sequence = value.subarray(i, i + bytesNeeded);
		try {
			const charText = decoder.decode(sequence);
			addInput(charText);
			bytes.push(...sequence);
// TODO: better unicode support for raw windows consoles
//			console.log("[RAW] skipping ",bytesNeeded,sequence,charText);
			return bytesNeeded - 1;
		} catch (e) {
			console.log("[RAW] decoder error");
			// Fall through to single byte handling
		}
	}
	console.log("[RAW] decoder underflow");
	return 0;
}

async function writeString(message:string){
	try{
		await writer.write(encoder.encode(harden(message,1e6)));
		await writer.ready;
	}catch (e){
		console.log("[RAW] writeString failure");
		throw e;
	}
}

// main egress for discord ssh stdin users
// returns response as messages or line

export async function slopPrompt(message:string,interval:number,refreshHandler?:(num:number,msg:string)=>Promise<void>) {
	Deno.stdin.setRaw(true);
	let response={};
	if(message){
		await writeString(message)
	}
	let busy=true;
	while(true){
		let bytes=[];
		if(!readPromise) readPromise=reader.read();
		let winner=null;
		while(true){
			const timerPromise=new Promise<null>(res => setTimeout(() => res(null), interval));
			const receivers=Object.values(receivePromises);
			const race=listenerPromise?[readPromise,timerPromise,listenerPromise,...receivers]:[readPromise,timerPromise,...receivers];
//			const race=listenerPromise?[readPromise,timerPromise,listenerPromise,...receivers]:[readPromise,timerPromise,...receivers];
//			const race=listenerPromise?[readPromise,timerPromise,listenerPromise]:[readPromise,timerPromise];
			winner=await Promise.race(race);
			if(winner==null){
				if(!busy) {
					const line=grapheme.join("").trimEnd();
					grapheme=[];
					response={line};
					promptHistory.push(line);
					historyIndex=promptHistory.length;
					break;
				}
				const line=grapheme.join("");
				await refreshHandler(counter++,prompt+line);
				continue;
			}
			break;
		}
		if(!winner) {
			break;// we break for break breaks, result has been loaded due to above timeout
		}
		// helter skelter race result
		const { value, done, connection, name, source, receive, error }=winner;
		if(error){
			// Address already in use (os error 98)
			echo("[PROMPT] oh no error from",name,error.message);
			delete slopConnections[name];
			delete receivePromises[name];
			throw(error); // this will cause a crash - an existing slop fountain process can cause this
		}
		// 
		if (connection) {
			if(name in receivePromises){
				echo("promise already exists for",name);
			}
			if(name in slopConnections){
				echo("connection already exists for",name);
			}
			echo("connection received for",name);
			slopConnections.set(name,connection);
			// TODO: call listenService helper
			if(sloppyListen){
				riffPromise=listenPort(8082,"riff");
				listenerPromise=riffPromise;
				sloppyListen=false;
			}else{
				sloppyPromise=listenPort(8081,"sloppy");
				listenerPromise=sloppyPromise;
				sloppyListen=true;
			}
			const receiver=readNamedConnection(name,connection);
			receivePromises[name]=receiver;
			//echo("reading connection 1",name);
			continue;
		}
		if(source){
			//echo("receivePromise name,source",name,source);//,receive
			delete receivePromises[name];
			const receiver=readNamedConnection(name,source);
			receivePromises[name]=receiver;
			const messages=[];
			// TODO: test with discontinuous stream of messages
			if(receive){
				const n=receive.length;
				const text=rxDecoder.decode(receive);
				//echo("receivePromise",n,text);//,receive
				try{
					const blob=JSON.parse(text);
					if(blob.command){
						const command=blob.command;
						const line=(command.name+" "+command.args).trim();
						const from=command.from;
						echo("COMMAND blob received",line,from);
						messages.push({command:line,from});
					}
					if(blob.messages){
						for(const message of blob.messages){
							messages.push({message,from:message.from});
						}
					}
				}catch(error){
					echo("slopPrompt JSON error",text,error);
				}
				if(messages){
					response={messages};
					break;
				}
			}
			continue;
		}
		// under investigation
		readPromise=null;
		busy=true;
		if (done || !value) break;
		const n=value.length;
		for(let i=0;i<n;i++){
			const byte=value[i];
			if (byte >= 0x80) { // Multi-byte UTF-8
				const skip = processUtf8(value, i, bytes);
				i += skip;
				continue;
			}
			if (byte === 0x7F || byte === 0x08) { // Backspace
				backspace(bytes);
			} else if (byte === 0x1b) { // Escape sequence
				if (value.length === 1) {
					return null;
				}
				if (value.length >= 3) {
					if (value[1] === 0xf4 && value[2] === 0x50) {
						console.log("[RAW] F1");
					}
					if (value[1] === 0x5b) { // cursor and past handlers
						onCSI(bytes,value);
					}
				}
				break;
			} else if ((byte==0x0D) || (byte==0x0A)) { // Enter key
				bytes.push(0x0D,0x0A);
				busy=false;
			} else {
				if(byte==3) return null;	// ctrl c triggers a Deno exit
				if(byte<32 && byte!=9){
					console.log("[RAW] bad byte",byte);
					busy=false;
				}
				const char=decoderStream.decode(new Uint8Array([byte]));
				if(!char){
					console.log("[RAW] not char from byte",byte);
					break;
				}
				bytes.push(...encoder.encode(char));
				addInput(char);
//				bytes.push(byte);
//				const char=decoderStream.decode(new Uint8Array([byte])); // Fix: Decode single byte to char
//				addInput(char);
				if (byte === 0x3A) { // Colon ':'
					const n=grapheme.length;
					if(inCode){
						if(n>codePos){
							const words=grapheme.slice(codePos, n - 1).join("");
							const lower=words.toLowerCase();
							if(lower in shortcode){
								const count=stringWidth(words)+2;
								const glyph=shortcode[lower]+"\uFE0F";
								replaceText(bytes,count,glyph);
								grapheme.push(glyph);
							}
						}
						inCode=false;
					}else{
						inCode=true;
						codePos=n;
					}
				}
			}
		}
		if (bytes.length) {
			const rawBytes=new Uint8Array(bytes);
			try{
				const text=streamDecoder.decode(rawBytes);
				await writeString(text);
//				await writer.write(text);
//				await writer.ready;
			}catch(e){
				console.log("[RAW] writer exception",e.message);
				console.log(e.stack);
			}
		}
	}
	inCode=false;
	return response;
}
