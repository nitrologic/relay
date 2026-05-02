// sloppyutils.ts - refactored fluffups
// Copyright (c) 2025 Simon Armstrong
// Licensed under the MIT License

// receive message from fountain relay /announce and echo to discord bot
// keep json flat single line

const sloppyBanner="[SLOPPY] slopchat discord bot by nitrologic 0.04";

const quotes=[
	"🤖 I am sloppy the janitor",
	"did thing thing call for a plunge? 🪠",
	"frump system prompt you say?"
];

// system stdin support for sloppies

const systemDecoder = new TextDecoder();
export async function onSystem(rx:Uint8Array){
	const message:string=systemDecoder.decode(rx);
	const lines=message.split("\n"); // sloppypipe was here ("\r\n");
	lines.pop();//ignore the incomplete
	for(const line of lines){
//		console.log("[STDIO]",line);
		if(line=="exit") Deno.exit(0);
		if(line.startsWith("/announce ")){
			const message=line.substring(10);
// todo hook to extern			
//			await postSloppyBot(client,message,"system");
		}
		if(!line.startsWith("/")){
			const messages=[{message:line,from:"system"}];
			await writeFountain(JSON.stringify({messages}));
//			await writeFountain(line);
		}
	}
}

const systemBufferSize=1e6;
let readingSystem:boolean=false;
const systemBuffer = new Uint8Array(systemBufferSize);
export async function readSystem(){
	if(!slopPipe) return;
	readingSystem=true;
	let n=null;
	try{
		n = await Deno.stdin.read(systemBuffer);
	}catch(e){
		echo("readFountain",e);
	}
	readingSystem=false;
	if (n == null) {
		// TODO: share exit hatch with below
		const disconnected=disconnectFountain();
		return null;
	}else{
		const received = systemBuffer.subarray(0, n);
		return {system:received};
	}
}

// borrowed from slophole

async function sleep(ms:number) {
	await new Promise(function(resolve) {setTimeout(resolve, ms);});
}

export function wrapText(content:string,wide:number):string[]{
	const lines=[];
	let cursor=0;
	while(cursor<content.length){
		let line=content.slice(cursor,cursor+wide);
		if(line.length>=wide){
			let n=line.lastIndexOf("\n");
			if(n==-1) n=line.lastIndexOf(" ");
			if(n!=-1) line=line.substring(0,n+1);
		}
		cursor+=line.length;
		lines.push(line);
	}
	return lines;
}

const ANSI={
	ESC:"\x1B[",
	RESET: "\x1b[0m",
	BLANKLINE: "\x1B[0K",
	DEVICE_STATUS:"\x1b[5n",
	DSR:"\x1b[6n",
	FG:{
		WHITE:"\x1b[38;5;255m"		
	},
	BG:{
		GREY:"\x1b[48;5;232m",
		GREEN:"\x1b[48;5;23m",
		TEAL:"\x1b[48;5;24m"
	},
	COLOR:[
		"\x1b[30m", // Black: Deep black (#333333), subtle on light, visible on dark
		"\x1b[31m", // Red: Muted red (#CC3333), clear on white and black
		"\x1b[32m", // Green: Forest green (#2D6A4F), good contrast on both
		"\x1b[33m", // Yellow: Golden yellow (#DAA520), readable on dark and light
		"\x1b[34m", // Blue: Medium blue (#3366CC), balanced visibility
		"\x1b[35m", // Magenta: Soft magenta (#AA3377), distinct on any background
		"\x1b[36m", // Cyan: Teal cyan (#008080), contrasts well without glare
		"\x1b[37m"	// White: Light gray (#CCCCCC), subtle on light, clear on dark
	]
};

const sloppyBreak="━".repeat(500);

function wrapMarkdown(md:string,cols:number) {
	const lines=md.split("\n");
	let inCode=false;
	let table=[];
	const result=[];
	let poplast=false;
	for (let line of lines) {
		line=line.trimEnd();
		const trim=line.trim();
		poplast=line.length==0;
		if (trim.startsWith("```")) {
			inCode=!inCode;
			if(inCode){
				const codeType=trim.substring(3).trim();
				result.push(ANSI.BG.GREEN+ANSI.FG.WHITE);
			}else{
				result.push(ANSI.RESET);
			}
		}else{
			if (!inCode) {
				// rules
				if(line.startsWith("---")||line.startsWith("***")||line.startsWith("___")){
					line=sloppyBreak.substring(0,cols-10);
				}
				if(line.startsWith("|")){
					const split=line.split("|");
					const splits=split.length;
					if(splits>2){
						const trim=split.slice(1,splits-1);
						table.push(trim);
//						echo("[TABLE]",trim)
					}
					continue;
				}else{
					if(table.length) {
						insertTable(result,table);
//						echo("[TABLE] inserted",table.length)
						table.length=0;
					}
				}
				// headershow
				const header=line.match(/^#+/);
				if (header) {
					const level=header[0].length;
					line=line.substring(level).trim();
					const ink=Deno.noColor?"":ANSI.COLOR[(colorCycle++)&7];
					line=ink + line + ANSI.RESET;	//ansiPop
				}
				// quotes
				if (line.startsWith("> ")) {
					line=quoteString(line.substring(2));
				}
				// bullets
				if (line.startsWith("*") || line.startsWith("+")) {
					line="• " + line.substring(1).trim();
				}
				// bold
				if (line.includes("**")) {
					line=line.replace(/\*\*(.*?)\*\*/g, "\x1b[1m$1\x1b[0m");
				}
				// italic
				line=line.replace(/\*(.*?)\*/g, "\x1b[3m$1\x1b[0m");
				line=line.replace(/_(.*?)_/g, "\x1b[3m$1\x1b[0m");
				// wordwrap
				line=wordWrap(line,cols);
			}
			result.push(line.trimEnd());
		}
	}
	if(poplast){
		result.pop();
	}
	// yuck - duplicate path way from above
	if(table.length) {
		insertTable(result,table);
		table.length=0;
	}
	result.push(ANSI.RESET);
	return result.join("\r\n");
}

// fountain connection goes PEEP

function echo(...data: any[]){
	console.error("[PEEP]",data);
}

const encoder = new TextEncoder();
export async function writeFountain(message:string){
	if(!slopPipe) return;
	const data=encoder.encode(message);	
	let offset = 0;
	while (offset < data.length) {
		const written = await slopPipe.write(data.subarray(offset));
		offset += written;
	}
//	echo("wrote",message);
}

let slopPipe:Deno.Conn;

export async function connectFountain():Promise<boolean>{
	try{
		slopPipe = await Deno.connect({hostname:"localhost",port:8081});
		echo("connected","localhost:8081");
		slopPipe.setNoDelay(true);
		return true;
	}catch(error){
		if (error instanceof Deno.errors.ConnectionRefused) {
			echo("Connection Refused",error.message);
		}else{
			const message=JSON.stringify(error,null,0);
			echo("Connection Error",message);
		}
	}
	return false;
}

export function disconnectFountain(){
	if(!slopPipe) return false;
	slopPipe.close();
	echo("Disconnected");
	slopPipe=null;
	return true;
}

const rxBufferSize=1e6;
const rxBuffer = new Uint8Array(rxBufferSize);
let readingSlop:boolean=false;
const fountainDecoder = new TextDecoder();
let fountainBuffer = "";
export async function readFountain(){
	if(!slopPipe) return;
	while(true){
		readingSlop=true;
		let n=null;
		try{
			n = await slopPipe.read(rxBuffer);
		}catch(e){
			echo("readFountain error",e);
		}
		readingSlop=false;
		if (n == null) {
			const disconnected=disconnectFountain();
			return null;
		}else{
			if(n){
				const received = rxBuffer.subarray(0, n);
				const chars = fountainDecoder.decode(received);
				fountainBuffer=fountainBuffer+chars;
				// NDJSON is the rule
				// sloppyutil readfountaing work in progress
				const pos=fountainBuffer.indexOf("\n");
//				echo("readFountain",fountainBuffer,pos);
				if(pos!=-1){
					const line=fountainBuffer.substring(0,pos);
					fountainBuffer=fountainBuffer.substring(pos+1);
					return {message:line};
				}
			}
		}
	}
}
