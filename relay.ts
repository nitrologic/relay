// relay.ts - a nitrologic research tool for dunking large language models
// Copyright (c) 2026 Simon Armstrong
// Licensed under the MIT License

// note:
// packed tab code style
// unsafe typescript formatted with tabs and minimal white space
// relay(depth,from)

// todo: 
// persona - named system prompt mods
// starcommand - config.starshare makes starless excluded from payload

// ⛲🪣🐸🪠🐋🜁🐉🏛️❁𝕏🌟💫🌏📆💰👀🤖🫦💻👄🔧🧊❃🎙️🔉📷🖼️🗣️📡👁🧮📠⣯⛅⚙️🗜️🧰 🌕🌙✿

import { replaceShortCodes, safeString, discordStringWidth, stringWidth, announceCommand, listenService, dropConnections, slopPrompt, slopBroadcast } from "./slopprompt.ts";

import { OpenAI, ChatCompletionRequest, ChatCompletionResponse } from "jsr:@openai/openai@5.23.0";

import { GoogleGenerativeAI, GenerativeModel } from "npm:@google/generative-ai";
import { Anthropic, toFile } from "npm:@anthropic-ai/sdk";
import { TextToSpeechClient } from "npm:@google-cloud/text-to-speech";

import { decodeBase64, encodeBase64 } from "https://deno.land/std/encoding/base64.ts";
import { expandGlob } from "https://deno.land/std/fs/mod.ts";
import { resolve,basename } from "https://deno.land/std/path/mod.ts";
import { dirname } from "node:path";
import { exists } from "https://deno.land/std@0.224.0/fs/exists.ts";
import { describe } from "node:test";

// Testing with Deno 2.7.14, V8  14.7.173.20-rusty, TypeScript 5.9.2

const brandFountain="nitrologic Relay";
const relayVersion="1.8.8";
const fountainName=brandFountain+" "+relayVersion;

const defaultModel="deepseek-v4-flash@deepseek";

const statusChar=" ꔀ "; //courtesy Vai Syllabary
const activeChar="❃";

const terminalColumns=100;	// default value for wordWrap()
const statsColumn=50;
const clipLog=1800;

// system prompt

const rohaTitle=fountainName+" ⛲ ";

const rohaMihi="Welcome to the nitrologic model research institute.";

const rohaGuide=[
	"As a guest assistant language model please be mindful of others, courteous and professional.",
//	"Keep response short, only post code on request and do not patronise.",
	"Only post code on request and do not patronise.",
	"Use tabs when indenting source files.",
	"Prefer named reusable functions over inlining code with arrow and map style suggestions."
]

// startup config

const welcome=await Deno.readTextFile("welcome.txt");
const mutsInclude="models under test include "
const cleanupRequired="Switch model, drop shares or reset history to continue.";
const warnDirty="Files shared. Feel free to comment if content is new or different.";
const exitMessage="Ending session.";
const rule500= "━".repeat(500);
const pageBreak=rule500;
const boxChars=["╭╮╰╯─┬┴│┤├┼","┌┐└┘─┬┴│┤├┼","╔╗╚╝═╦╩║╣╠╬","┏┓┗┛━┳┻┃┫┣╋"];
const TextVariant="\uFE0E";
const ZeroWidthJoiner="\uFE0F";
const NonBreakingSpace="\u00a0";
const EnSpace="\u2002";
const EmSpace="\u2003";
const ThinSpace="\u2009";	//" "
const HairSpace="\u200A";

function getEnv(key:string):string{
	return Deno.env.get(key)||"";
}

const username=getEnv("USERNAME")||getEnv("USER");
const userdomain=(getEnv("USERDOMAIN")||Deno.hostname()).toLowerCase();
const userregion = Intl.DateTimeFormat().resolvedOptions();
const rohaUser=username+"@"+userdomain;
const vscode_nonce=getEnv("VSCODE_NONCE")||getEnv("VSCODE_INJECTION");
const userterminal=vscode_nonce?getEnv("TERM_PROGRAM"):(getEnv("SESSIONNAME")||getEnv("TERM")||"VOID");
const Pail=vscode_nonce?"🪣 ":"🪣";

type ConfigFlags = {
	showWelcome: boolean;
	reasonoutloud: boolean;
	tools: boolean;
	commitonstart: boolean;
	saveonexit: boolean;
	ansi: boolean;
	verbose: boolean;
	squash: boolean;
	broken: boolean;
	logging: boolean;
	debugging: boolean;
	pushonshare: boolean;
	slopprompt: boolean;
	resetcounters: boolean;
	returntopush: boolean;
	slow: boolean;
	slops: boolean;
	budget: false;
	syncRelay: boolean;
	listen: boolean;
	project: boolean;
	thinking: boolean;
	underline: boolean;
	persona: string;
	starshare: boolean;
};

// a shared context state
// TODO: support multiple models and users with distinct contexts
class Plop {
	constructor(
		public role: string,
		public name: string,
		public title: string,
		public content: string
	) {
	}
};

let rohaHistory:Plop[]=[];
let rohaCallNames={};
let projectHistory="";

const sessionStack:Plop[][]=[];

function pushHistory(){
	sessionStack.push([...rohaHistory]);
	resetHistory();
}

function popHistory():Plop[]|false{
	if(sessionStack.length==0) return false;
	return sessionStack.pop()||false;
}

let rohaModel="mut";	//mut name excludes preview version details
let grokModel="";
let grokAccount=null;
let grokFunctions=true;
let grokUsage=0;

const ResetTemperature=0.7;
let grokTemperature=ResetTemperature;

let grokThink=0.0;
let grokGrounded=0.95;

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

function ansiStyle(text:string, style:string="bold", colorIndex:number=-1) {
	if (!roha.config.ansi) return text;
	let formatted=text;
	switch (style.toLowerCase()) {
		case "bold": formatted="\x1b[1m" + formatted + "\x1b[0m"; break;
		case "dim": formatted="\x1b[2m" + formatted + "\x1b[0m"; break;
		case "italic": formatted="\x1b[3m" + formatted + "\x1b[0m"; break;
		case "underline": formatted="\x1b[4m" + formatted + "\x1b[0m"; break;
		case "blink1": formatted="\x1b[5m" + formatted + "\x1b[0m"; break;
		case "blink2": formatted="\x1b[6m" + formatted + "\x1b[0m"; break;
		case "reverse": formatted="\x1b[7m" + formatted + "\x1b[0m"; break;
		case "hidden": formatted="\x1b[8m" + formatted + "\x1b[0m"; break;
		case "strikethrough": formatted="\x1b[9m"+formatted + "\x1b[0m"; break;
	}
	if (!Deno.noColor && colorIndex !== null && colorIndex >= 0 && colorIndex < ANSI.COLOR.length) {
		formatted=ANSI.COLOR[colorIndex] + formatted + "\x1b[0m";
	}
	return formatted;
}

function quoteString(line:string):string{
	line=line.substring(1).trim();
	echo(line);
	return "\t"+line;
}

// application configuration

const slowMillis=25;
const MaxFileSize=512*1024*16;

const appDir=Deno.cwd();
const accountsPath=resolve(appDir,"accounts.json");
const specsPath=resolve(appDir,"modelspecs.json");
const unicodePath=resolve(appDir,"slopspec.json");

const slopPath=resolve(appDir,"../slop");

const forgePath=resolve(appDir,"forge");
const rohaPath=resolve(forgePath,"forge.json");

const modelAccounts=JSON.parse(await Deno.readTextFile(accountsPath));
const modelSpecs=JSON.parse(await Deno.readTextFile(specsPath));
const unicodeSpec=JSON.parse(await Deno.readTextFile(unicodePath));

const emojiIndex = {};

// date time helper functions

const epoch:number=Date.UTC(2025,4,12);

// slopmark() - returns a hex timestamp
// - hexadecimal encoding of sixteenths of a second since 2025.4.12
// - replaces new Date().toISOString() as standard timestampe in slopfountain
function slopmark():string{
	return Math.floor((Date.now()-epoch)/62.5).toString(16);
}

function slopDate(sixteenths:number){
	const secs=epoch+sixteenths*62.5;
	const date=new Date(secs);
	return date.toDateString();
}

// unixTime() - timestamp - seconds since 1970

function unixTime(date:string):number{
	const d = new Date(date);
	const s = d.getTime()/1000;
	return Math.floor(s);
}

// dateStamp(seconds) - unix timestamp to string

function dateStamp(seconds:number){
	if(seconds>0){
		const date = new Date(seconds*1000);
		const created=date.toISOString();
		return created.substring(0,10);
	}
	return "---";
}

// string padding helper functions

function padChars(text:string,pad:string=ThinSpace):string{
	return [...text].join(pad);
}

function stringifyArray(array:[]):string{
	return array.join(",");
}

function stringFit(text:string,width:number):string{
	return text.substring(0,width);
}

function stringRight(text:string,width:number):string{
	const n=stringWidth(text);
	const pad=(width>n)?" ".repeat(width-n):"";
	return pad+text;
}

function textify(obj:unknown){
	if (typeof(obj)=="string") return obj;
	if (obj) return JSON.stringify(obj);
	return String(obj);
}

function objectify(obj:unknown){
	if (typeof(obj)=="string") return obj;
	return obj;
}


function echoKey(key:object,wide:number){
	const text=JSON.stringify(key);
	const rtext=stringRight(text,wide);
	echo(rtext);
}

function parseUnicode(){
	for(const group in unicodeSpec){
		const keys = Object.keys(unicodeSpec[group].emoji);
		echo("[UNICODE]",group,keys.join(" "));
	}
}

function formatValues(o): string {
	return Object.values(o).join(" ");
}

function formatObject(obj: Record<string, unknown>): string {
	return Object.entries(obj)
		.map(([key, value]) => `${key}:${value}`)
		.join(', ');
}

const decoder=new TextDecoder("utf-8");
const encoder=new TextEncoder();

// rohaHistory is array of {role,name||title,content}
// attached as payload messages in chat completions

const flagNames={
	squash : "squash message sequences in output",
	reasonoutloud : "echo chain of thought",
	tools : "enable model tool interface",
	search : "enable search tool interface",
	commitonstart : "commit shared files on start",
	saveonexit : " save conversation history on exit",
	ansi : "markdown ANSI rendering",
	verbose : "emit debug information",
	broken : "ansi background blocks",
	logging : "log all output to file",
	debugging : "emit diagnostics",
	pushonshare : "emit a /push after any /share",
	slopprompt : "rawmode stdin with shortcode support",
	resetcounters : "factory reset counters and files on reset",
	returntopush : "hit return to /push - under test",
	slow : "experimental output at reading speed",
	slops : "console worker scripts",
	budget : "cheap models for the win",
	syncRelay : "one thing at a time mode",
	listen : "listen for remote connections on port 8081",
	project : "load current project on start",
	thinking : "enable thinking mode with dual purpose models",
	underline : "enable underline markdown support",
	persona : "extend system prompt",
	starshare : "conserve file share by star"
};

const emptyConfig:ConfigFlags={
	showWelcome:false,
	reasonoutloud:false,
	tools:false,
	commitonstart:false,
	saveonexit:false,
	ansi:true,
	verbose:false,
	squash:false,
	broken:false,
	logging:false,
	debugging:false,
	pushonshare:false,
	slopprompt:false,
	resetcounters:false,
	returntopush:false,
	slow:false,
	slops:false,
	budget:false,
	syncRelay:true,
	listen:false,
	thinking:true,
	underline:false,
	starshare:false
};

interface Share{
	id:string,
	path:string,
	name:string,
	stars:string
};

const emptyRoha={
	config:emptyConfig,
	tags:{},
	sharedFiles:[],	//Array<Share>,//[],
	keyedShares:{},
	keyedProjects:{},
	attachedFiles:[],
	saves:[],
	counters:{},
	mut:{},
	lode:{},
	forge:[],
	project:"roha",
	nic:"friend",
	persona:"sloppy"
};

let slopPid=null;

function sanitizeNic(nic){
	return nic.replace(/[^a-zA-Z0-9]/g,"");
}

async function exitForge(){
	dropConnections();
	const pid=slopPid;
	if(pid){
		Deno.kill(Number(pid),"SIGTERM");
		echo("pid",pid,"killed");
		slopPid=null;
	}
	await flush();
	if(roha.config.saveonexit){
		await saveHistory();
	}
	await flush();
	Deno.stdin.setRaw(false);
	console.log("exitForge",exitMessage)
}

let slopPail=[];

function price(credit:number):string{
	if (credit === null || isNaN(credit)) return "$0";
	return "$"+credit.toFixed(4);
}

function annotateTag(name,description){
	if(!name){
		throw("null name");
	}
	if(!(name in roha.tags)) {
		roha.tags[name]={};
//		throw("tag not found "+name);
	}
	roha.tags[name].description=description;
}

function annotateShare(name,description){
	let index=roha.sharedFiles.findIndex(item => item.id === name);
	if(index==-1) {
		throw("annotateShare name not found "+name);
	}
	roha.sharedFiles[index].description=description;
	echo("annotateShare annotated file share",name);
}

function increment(key){
	let i=0;
	if(key in roha.counters){
		i=roha.counters[key]+1;
	}
	roha.counters[key]=i;
	return i
}

// all models are here - with and without spec

let modelList=[];
let accountList=[];

const emptyMUT={notes:[],errors:[],relays:0,cost:0,elapsed:0,created:0}

// deprecated 2026.5.14
// never read - work in progress
// let tagList=[];
let shareList=[]; // sorted version for listshares sort command index
// let memberList=[];
// const emptyModel={name:"empty",account:"",hidden:false,prompts:0,completion:0}
// const emptyTag={}
// const emptyShare={path,size,modified,hash,tag,id}



let roha=emptyRoha;
let rohaSharePaths=[];
let listCommand="";
let creditCommand="";
let currentDir=Deno.cwd();

function resetHistory(){
	rohaHistory=[{role:"system",title:fountainName,content:rohaMihi}];
	const guide=rohaGuide.join(" ");
	if (guide) {
		rohaHistory=[{role:"system",title:fountainName,content:guide}];
	}
}

function echoContent(content,wide,left,right){
	const chars=wide-(left+right);
	const indent=" ".repeat(left);
	let cursor=0;
	while(cursor<content.length){
		let line=content.substring(cursor,cursor+chars);
		let n=line.indexOf("\n");
		if(n==-1) n=line.lastIndexOf(" ");
		if(n!=-1) line=line.substring(0,n+1);
		if(line.length){
			echo(indent+line);
			cursor+=line.length;
		}
	}
}

// with item in order of preference, src = mut title name
function itemSource(item):string{
	const src:string=item.mut||item.title||item.name||"roha";
	return src;
}

function listHistory(){
	const wide=terminalColumns-statsColumn;
	const history=rohaHistory;
	let total=0;
	let cost=0;
	for(let i=0;i<history.length;i++){
		const item=history[i];
		const content=readable(item.content);
		const clip=content.substring(0,wide);
		const size="("+content.length+"B)";
		const role=item.role.padEnd(12," ");
		const from=itemSource(item).padEnd(15," ");
		const name=("["+itemSource(item)+"]");
		const iii=String(i).padStart(3,"0");
		const spend=item.price?("$"+item.price.toFixed(4)):"";	//item.emoji+" "+
		const seconds=item.elapsed?(item.elapsed.toFixed(2)+"s"):"";
		echo(iii,name,clip,size,spend,seconds);
		total+=content.length;
		cost+=item.price||0;
	}
	const size=unitString(total,4,"B");
	echo("History size",size," cost ",cost.toFixed(4));
}
function logHistory(){
	const wide=terminalColumns;
	let history=rohaHistory;
	if(roha.config.squash){
		history=squashMessages(rohaHistory);
	}
	for(let i=0;i<history.length;i++){
		const item=history[i];
		const index=i;//item.index;
		const iii=String(index).padStart(3,"0");
		const spend=item.price?(item.emoji+" "+item.price.toFixed(4)) :"";
		const seconds=item.elapsed?(item.elapsed.toFixed(2)+"s"):"";
		const src=itemSource(item);
		echo(iii,item.role,src,spend,seconds);
		const content=readable(item.content).substring(0,clipLog);
		echoContent(content,wide,3,2);
	}
}

// TODO: username is blobuser, pass message type for images
function rohaPush(content,username){
	const item={role:"user",name:username,content:content};
	rohaHistory.push(item);
	slopPail.push({"push":{item}});
}

resetHistory();

// roha

const rohaTools=[{
	type: "function",
	function:{
		name: "read_time",
		description: "Returns current local time",
		parameters: {
			type: "object",
			properties: {},
			required: []
		}
	}
},{
	type: "function",
	function:{
		name: "submit_file",
		description: "Submit a file for review",
		parameters: {
			type: "object",
			properties: {
				contentType:{type:"string"},
				content:{type:"string"}
			},
			required: ["contentType","content"]
		}
	}
},{
	type: "function",
	function:{
		name: "fetch_file",
		description: "Request a file for analysis",
		parameters: {
			type: "object",
			properties: {
				fileName:{type:"string"}
			},
			required: ["fileName"]
		}
	}
},{
	type: "function",
	function: {
		name: "tag_slop",
		description: "Attach description to code tag and share Fountain objects",
		parameters: {
			type: "object",
			properties: {
				name: { type: "string" },
				type: { type:"string" , description:"forge category", enum:["code","session","share","lode"]},
				description: { type: "string" }
			},
			required: ["name","type","description"]
		}
	}
}];

// here be dragons - emoji widths based on userterminal may be required

async function fileLength(path: string): Promise<number> {
	try {
		const stat=await Deno.stat(path);
		return stat.size;
	} catch (error) {
		return 0;
	}
}

async function fileModified(path: string): Promise<string>{
	try {
		const stat=await Deno.stat(path);
		return stat.mtime.toLocaleString(userregion.locale, { dateStyle: "short", timeStyle: "short" });
	} catch (error) {
		return "";
	}
}

async function sleep(ms) {
	await new Promise(function(awake) {setTimeout(awake, ms);});
}

function unitString(value,precision=2,type=""){
	if (typeof value !== 'number' || isNaN(value)) return "NaN";
	const units=["","K","M","G","T"];
	const abs=Math.abs(value);
	const unit=(Math.log10(abs)/3)|0;
	if(unit>0){
		if(unit>4)unit=4;
		let n=value / Math.pow(10, unit*3);
		const digits=Math.max(1, String(Math.floor(n)).length);
		n=n.toFixed(Math.max(0, precision - digits));
		return n+units[unit]+type;
	}
	return String(value)+type;
}

function measure(o){
	const value=(typeof o==="string")?o.length:JSON.stringify(o).length;
	return unitString(value,4,"B");
}

let outputBuffer:string[]=[];
let printBuffer=[];
let markdownBuffer=[];
let statusBuffer=[];

// override console.error
// TODO:redirect all existing console.errors

let remoteBuffer=[];
async function errorHandler(...args:any[]) {
	const line=args.join(",");
	const from="remote";
	remoteBuffer.push({line,from});
	originalError.apply(console, [line]);//args);
};
const originalError=console.error;
console.error=errorHandler;


function print():void{
	const args=arguments.length?Array.from(arguments):[];
	const lines=args.join(" ").split("\n");
	for(const eachline of lines){
		const line=eachline.trimEnd();
		printBuffer.push({model:rohaModel,line});
	}
}

function toString(arg:unknown):string{
	if (typeof arg === 'object') {
		return JSON.stringify(arg);
	}
	return String(arg);
}

// takes both markdown and plain
// ignores markdown
// flattens args to single space separated line in outputBuffer

async function echoStatus(...args:any){
	const lines=[];
	for(const arg of args){
		const line=toString(arg);
		lines.push(line);
	}
	const output=lines.join(" ").trimEnd();
	if(output.length){
		statusBuffer.push(output);
	}
}

function echoInfo(...args:any):void{
	if(!(roha.config.verbose||roha.config.debugging)) return;
	const lines=[];
	for(const arg of args){
		const line=toString(arg);
		lines.push(line.trimEnd());
	}
	const output=lines.join(" ").trimEnd();
	if(output.length){
		console.log(output);
	}
}

function echo(...args:any):void{
	const lines=[];
	for(const arg of args){
		const line=toString(arg);
		lines.push(line.trimEnd());
	}
	const output=lines.join(" ").trimEnd();
	if(output.length){
		outputBuffer.push(output);
	}
}

async function echoFail(...args:any){
	const lines=[];
	for(const arg of args){
		const line=toString(arg);
		lines.push(line);
	}
	const text=lines.join(" ");
	const from="FAIL";
	remoteBuffer.push({line:text,from});

	const styledText=ansiStyle(text,"bold",2);
	outputBuffer.push(styledText);
	outputBuffer.push(cleanupRequired);
}

function echoWarning(...args:any){
	const lines=[];
	for(const arg of args){
		const line=toString(arg);
		lines.push(line);
	}
	const text=ansiStyle(lines.join(" "),"blink",1);
	outputBuffer.push(text);
}

// warning non fixed widths in a fixed width world
const sansBold={
	"upper": "𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭",
	"lower": "𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇",
	"digits": "𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵"
};
const doubleStruck={
	"upper": "𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ",
	"digits": "𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡"
};
const wideLatin={
	"upper": "ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ",
	"digits": "０１２３４５６７８９",
	"lower": "ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ"
}

function latinString(latin, line: string, space=ThinSpace): string {
	const upper=Array.from(latin.upper);
	const digits=Array.from(latin.digits);
	const lower=latin.lower?Array.from(latin.lower):upper;
	let out="";
	for (const ch of line) {
		const c = ch.charCodeAt(0);
		if (c >= 48 && c <= 57) out += digits[c-48];
		else if (c >= 65 && c <= 90) out += upper[c-65]+space;
		else if (c >= 97 && c <= 122) out += lower[c-97]+space;
		else out += ch;
	}
	return out;
}

// badly spaced in windows
function echo_sansBold(...cells:any):void{
	const line = cells.map(String).join("");
	outputBuffer.push(latinString(sansBold,line,""));
}

// kinda cool big and spacey on windows
function echo_wideLatin(...cells:any):void{
	const line = cells.map(String).join("");
	outputBuffer.push(latinString(wideLatin,line,""));
}

// meh
function echo_doubleStruck(...cells:any):void{
	const line = cells.map(String).join(' ');
	outputBuffer.push(latinString(doubleStruck,line));
}

function echo_bold(...cells:any):void{
	const line = cells.map(String).join(' ');
	const text=ansiStyle(line,"bold",3);
	outputBuffer.push(text);
}

function echo_row(...cells:any):void{
	const row = cells.map(String).join('|');
	markdownBuffer.push("|"+row+"|");
}

function echo_row2(...cells:any):void{
	const row = cells.map(String).join('|');
	markdownBuffer.push("|"+row);
}

function debugValue(title:string,value:unknown){
	if(roha.config.debugging){
		const json=JSON.stringify(value);
		echo("[DEBUG]",title,json);
	}
}

async function logForge(lines:string,id:string){
	if(roha.config.logging){
		const time=slopmark();
		const list=[];
		for(let line of lines.split("\n")){
			line=stripAnsi(line);
			line=time+" ["+id+"] "+line+"\n";
			list.push(line);
		}
		const block=list.join("\n");
		let path=resolve(forgePath,"forge.log");
		await Deno.writeTextFile(path,block,{append:true});
		if(projectHistory){
			if(id!="roha" && id!="remote") {
				await Deno.writeTextFile(projectHistory,block,{append:true});
			}
		}
	}
}

// used for roha.config.slops

async function readFileNames(path:string,suffix:string){
	const result=[];
	try {
		for await (const entry of Deno.readDir(path)) {
			if (entry.isFile && entry.name.endsWith(suffix)) {
				echoInfo("readDir",path,entry);
				result.push(entry.name);
			}
		}
	} catch (error) {
		echo("Error reading directory:", error);
	}
	return result;
}

// until discord supports native markdown tables

function flattenTables(content){
	let fenced=false;
	const lines=content.split("\n");
	const table: string[][] = [];
	const result: string[] = [];
	for(const line of lines){
		if (line.startsWith("|")) {
			const items=line.split("|").slice(1, -1);
			table.push(items);
/*
			const items=line.split("|");
			const n=items.length;
			const last=n?items[n-1]:"";
			const end=last.length?0:-1;
			table.push(items.slice(1, end));
*/
		} else {
			if (table.length) {
				insertTable(result, table, !fenced, true);
				table.length = 0;
			}
			if (line.startsWith("```")) {
				fenced=!fenced;
			}
			result.push(line);
		}
	}
	if (table.length) {
		insertTable(result, table, !fenced, true);
	}
	return result.join("\n");
}

async function flush() {
	const send=[];
	const delay=roha.config.slow ? slowMillis : 0;
	for (const {line,from} of remoteBuffer) {
// muted on public channels
//		send.push(line);
// dont share just log remote chatter
//		rohaPush(line,from);
		await logForge(line,from);
	}
	remoteBuffer=[];
	for (const mutline of printBuffer) {
		const mut=mutline.model;
		const line=mutline.line;
		console.log(line);
		await logForge("#"+line,mut);
		await sleep(delay)
	}
	printBuffer=[];
	const md=markdownBuffer.join("\r\n");
	if(md.length){
		if (roha.config.ansi) {
			const ansi=mdToAnsi(md);
			console.log(ansi);
		}else{
			if(md.length) console.log(md);
		}
		send.push(md);
	}
	markdownBuffer=[];
// TODO: sort out windows unicode paste error that crashes here
//	const encoder=new TextEncoder();
//	const decoder=new TextDecoder("utf-8");
	for (const output of outputBuffer) {
		try{
			console.log(output);
		}catch(e){
//			const encoded=encoder.encode(output);
//			const clean=decoder.decode(encoded);
			console.error("[CRASH] binary data in outputBuffer");
		}
		const lines=output.split("\n");
		for(const line of lines){
			if(line.length){
				await logForge(line,"roha");
			}
// todo toggle tool send off for some levels
			send.push("> -"+line);
		}
		await sleep(delay);
	}
	outputBuffer=[];

	if(send.length) {
//		console.log(send);
		const packet=flattenTables(send.join("\n"));
//		console.log(packet);	//simon was here
		slopBroadcast("<2 >"+packet,"slop");
	}

	for (const output of statusBuffer) {
		console.log(output);
		const lines=output.split("\n");
		for(const line of lines){
			if(line.length){
				await logForge("[status] "+line,"roha");
			}
		}
	}
	statusBuffer=[];

}

function wordWrap(text:string,cols:number=terminalColumns):string{
	const result=[];
	let pos=0;
	while(pos<text.length){
		let line=text.substring(pos,pos+cols);
		let n=line.length;
		if(n==cols){
			let i=line.lastIndexOf(" ",n);
			if(i>0){
				line=line.substring(0,i);
				n=i+1;
			}
		}
		result.push(line);
		pos+=n;
	}
	return result.join("\r\n");
}

async function listModels(config){
	let url=config.url+"/models";
	let response=await fetch(url);
	if(response.ok){
		console.log(await response.text());
	}else{
		console.error(response);
	}
	return null;
}

// native macos

const SiriVoices=["Aaron", "Nicky", "Ava", "Fred", "Sandy", "Moira", "Tessa", "Daniel",	"Karen", "Rishi", "Arthur", "Martha", "Nova", "Catherine", "Gordon", "Aria"];

const AppleVoices=["Agnes","Albert","Aaron","Nicky","Ava","Fred","Sandy","Moira","Tessa","Daniel","Karen","Rishi","Arthur","Martha","Nova","Catherine","Gordon","Aria"];
const AppleVoices2=["Daniel","Bells","Bubbles","Alice","Albert","Bad News"];

async function appleSay(message:string,voiceName="Aria"){
	const cmd = voiceName ? ["say", "-v", voiceName, message] : ["say", message];
	const process = Deno.run({cmd,stdout: "piped",stderr: "piped",});
	const { code } = await process.status();
	if (code === 0) {
		console.log("Message spoken successfully!");
	} else {
		const error = await process.stderrOutput();
		console.error(`Error: ${new TextDecoder().decode(error)}`);
	}
	process.close();
}

// API support for gemini

// https://ai.google.dev/gemini-api/docs/speech-generation

const GeminiVoices=["Zephyr","Puck","Charon","Kore","Fenrir","Leda","Orus","Aoede",
	"Callirrhoe","Autonoe","Enceladus","Iapetus","Umbriel","Algieba","Despina","Erinome",
	"Algenib","Rasalgethi","Laomedeia","Achernar","Alnilam","Schedar","Gacrux","Pulcherrima",
	"Achird","Zubenelgenubi","Vindemiatrix","Sadachbia","Sadaltager","Sulafat"];

//const previewTTS="models/gemini-2.5-flash-preview-tts";
const previewTTS="models/gemini-3.1-flash-tts-preview";

async function geminiSay(content:string,voiceName="Kore"){
	const endpoint=rohaEndpoint["gemini"];
	const apiKey=endpoint.apiKey;
	const genAI=new GoogleGenerativeAI(apiKey);
	const model = genAI.getGenerativeModel({ model: previewTTS });
	const packet = {
		contents: [{parts: [{ text: content }],},],
		generationConfig:{responseModalities:["AUDIO"],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName},},},},
	};
	const reply = await model.generateContent(packet);
	if(reply.response.candidates){
		for(const candidate of reply.response.candidates){
			if (candidate.content&&candidate.content.parts){
				for(const part of candidate.content.parts){
					if(part.inlineData){
						const audioData=part.inlineData.data;
						const mimeType=part.inlineData.mimeType;
						const audioBuffer=decodeBase64(audioData);
						echo("[GEMINI]","inlineData",mimeType,audioBuffer.length);
						const filename=await saveGeminiSpeech(audioBuffer,mimeType);
						open(filename);
					}
				}
			}
		}
	}else{
		echo("[GEMINI]",reply);
	}
}

async function saveGeminiSpeech(audio: Uint8Array, mimeType:string, metaData:string[]): Promise<string> {
	// expecting audio/L16;codec=pcm;rate=24000
	const format:string = "wav";
	const timestamp=Math.floor(Date.now()/1000).toString(16);
	const filename=("speech-"+timestamp)+"."+format;
	const filePath=resolve(forgePath,filename);
	const line="saved "+filename;
	rohaHistory.push({role:"system",title:"saveSpeech",content:line});
// Create a WAV header (44 bytes)
	const header = new Uint8Array(44);
	const view = new DataView(header.buffer);
// RIFF chunk descriptor
	view.setUint32(0, 0x52494646, false); // "RIFF"
	view.setUint32(4, 36 + audio.length, true); // File size - 8
	view.setUint32(8, 0x57415645, false); // "WAVE"
// Format subchunk
	view.setUint32(12, 0x666d7420, false); // "fmt "
	view.setUint32(16, 16, true); // Subchunk size (16 for PCM)
	view.setUint16(20, 1, true); // Audio format (1 = PCM)
	view.setUint16(22, 1, true); // Channels (1 = mono)
	view.setUint32(24, 24000, true); // Sample rate (24kHz)
	view.setUint32(28, 24000 * 2, true); // Byte rate (sample rate * bytes per sample)
	view.setUint16(32, 2, true); // Block align (channels * bytes per sample)
	view.setUint16(34, 16, true); // Bits per sample (16-bit)
// Data subchunk
	view.setUint32(36, 0x64617461, false); // "data"
	view.setUint32(40, audio.length, true); // Data size
// Combine header and audio data
	const wavBytes = new Uint8Array(header.length + audio.length);
	wavBytes.set(header, 0);
	wavBytes.set(audio, header.length);
	try {
		await Deno.writeFile(filePath, wavBytes);
		echo("[SAY]", line);
		return filePath;
	} catch (error) {
		echo("[SAY]","Speech save error", error.message);
		throw error; // Re-throw to handle the error upstream
	}
}

// https://ai.google.dev/gemini-api/docs/text-generation

function geminiTools(payload){
	const functions=[];
	for(const tool of payload.tools){
		if(tool.type=="function"){
			const f=tool.function;
			if(f.parameters){
				const p=f.parameters;
				const d={name:f.name,description:f.description,parameters:{type:p.type,properties:p.properties,required:p.required}};
				functions.push(d);
			}else{
				const d={name:f.name,description:f.description};
				functions.push(d);
			}
		}
	}
	return [{functionDeclarations:functions}];
}

function parseToolResponse(text: string): object {
	try {
		return JSON.parse(text);
	} catch (error) {
		return { value: text };
	}
}

function prepareGeminiPrompt(payload){
	const debugging=roha.config.debugging;
	if(debugging) echo("[GEMINI]","payload",payload);
	const contents=[];
	const sysparts=[];	// GenerateContentRequest systemInstruction content
	let blob={};
	for(const item of payload.messages){
		if(debugging) echo("[GEMINI]","item",item);
		const text=item.content;
		if(debugging) echo("[GEMINI]","text",text);
		switch(item.role){
			case "system":
				sysparts.push({text});
				break;
			case "assistant":{
					if (item.tool_calls) {
						const parts = item.tool_calls.map(tc => ({
							functionCall: {
								name: tc.function.name,
								args: JSON.parse(tc.function.arguments)
							}
						}));
						contents.push({ role: "model", parts });
					} else {
						contents.push({ role: "model", parts: [{ text: item.content || "" }] });
					}
				}
				break;
			case "user":{
					if(debugging) echo("[GEMINI]","prepare",item);
					if(item.name=="blob"){
						blob=JSON.parse(text);
						continue;
					}
					// should this be title?
					if(item.name=="image"){
						const mimeType=blob.type;
						const data=text;
						echo("[GEMINI]","image",mimeType);
						contents.push({role:"user",parts:[{inlineData:{mimeType,data}}]});
						continue;
					}
					if(item.content?.length){
						contents.push({role:"user",parts:[{text:item.content}]});
					}
				}
				break;
			case "tool":{
					try{
						echo("[GEMINI]","item.name",item.name);
						const response=parseToolResponse(text);
						const functionResponse={name:item.name,response};
						if (debugging) echo("[GEMINI]","functionResponse",functionResponse);
						contents.push({role:"function",parts:[{functionResponse}] });
					}catch(e){
						echo("[GEMINI]","tool crash",e);
						console.log("text:",text)
						console.log(e);
						Deno.exit();
					}
				}
				break;
		}
	}

	// TODO: enable disable tools
	// TODO: tools and toolsconfig support

	const tools=payload.tools?geminiTools(payload):[];

	//system_instruction

	const temperature=grokTemperature;

	const request={
		model:payload.model,
		system_instruction:{parts:sysparts},
		generationConfig:{temperature},
		contents,
		tools
	};

	if(debugging) echo("[GEMINI]","request",request);

	return request;
}

let geminiSpeechClient=null;

async function connectGoogleVoice(){
	const apiKey=getEnv("GOOGLE_CLOUD_KEY");
	try{
//		geminiSpeechClient = new TextToSpeechClient({key:apiKey});
		geminiSpeechClient = new TextToSpeechClient(apiKey);
		if(geminiSpeechClient){
			echo("[GCLOUD]","speech client is up but not authenticated");
/*
			const result=[];
			const response=await geminiSpeechClient.listVoices();
			for (const voice of response.voices) {
				result.push(voice.name+" "+JSON.stringify(voice));
			}
			echo("[GOOGLE]","voices\n\t",result.join("\n\t"));
*/
		}
	} catch (error) {
		console.error("connectGoogleVoice error:",error.message);
		return null;
	}
}

let geminiCallCount=0;

function geminiToolCalls(geminiCalls){
	return geminiCalls.map((call) => ({
		thought_signature: "call_" + (geminiCallCount++),
		function_call: {
			name: call.name,
			args: call.args
		}
	}));
}

function oldGeminiToolCalls(geminiCalls){
	return geminiCalls.map((call) => ({
		id: "call_" + (geminiCallCount++),
		type: "function",
		function: {
			name: call.name,
			arguments: JSON.stringify(call.args)
		}
	}));
}

async function connectGoogle(account,config){
//	await connectGoogleVoice();
	try{
		const baseURL=config.url;
		const apiKey=getEnv(config.env);
		if(!apiKey) return null;
		const response=await fetch(baseURL+"/models?key="+apiKey);
		if (!response.ok) {
			console.info("connectGoogle response",response)
			return null;
		}
		const models=await response.json();
		const list=[];
		//specModel
		for(const model of models.models){
			const name=model.name+"@"+account;
			list.push(name);
//			echo("[GOOOGLE]","released",name);
			const spec={id:model.name,object:"model",owner:"owner"}
			specModel(spec,account);
		}
		modelList.push(...list);
		const genAI=new GoogleGenerativeAI(apiKey);
		return {
			genAI,
			apiKey,
			baseURL,
			modelList:list,
			models: {
				list: async () => models, // Return cached models or fetch fresh
			},
			chat: {
				completions: {
					create: async (payload) => {
//						config: { systemInstruction: setup, maxOutputTokens: 500,temperature: 0.1, }
						const model=genAI.getGenerativeModel({model:payload.model});
						const request=prepareGeminiPrompt(payload);
						// TODO: hook up ,signal SingleRequestOptions parameter
						// if(roha.config.debugging) echo("[GEMINI]","generateContent",request);
						const result=await model.generateContent(request);
						const debugging=roha.config.debugging;
						if(debugging) echo("[GEMINI]","result",result);
						// gemini was here
						let text="";
						try {
							text=await result.response.text();
						} catch (error) {
							if(debugging) echo("[GEMINI]","No text in response (likely function call only)");
						}
//						const text=await result.response.text();
						const usage=result.response.usageMetadata||{};
						const choices = [];
						choices.push({message:{content:text}});
						const calls = result.response.functionCalls(); // Get Gemini's raw function calls
						if(calls){
							echo("[GEMINI]","toolCall",calls);
//							const toolCalls = calls.map((call,index)=>({id:"call_"+(geminiCallCount++),type:"function",function:{name:call.name,arguments:JSON.stringify(call.args)}}));
							choices[0].message.tool_calls=geminiToolCalls(calls);
//							echo("[GEMINI]","toolCalls",toolCalls);
//							for(const call of toolCalls){
//								echo("[GEMINI]","toolCall",call);
//								choices.push({tool_calls:call});
//							}
						}
						// TODO: add cached usage to reply
						const temperature=grokTemperature;
						return {
							model:payload.model,
							temperature,
							choices,
							usage:{
								prompt_tokens:usage.promptTokenCount,
								completion_tokens:usage.candidatesTokenCount+usage.thoughtsTokenCount,
								total_tokens:usage.totalTokenCount,
								cache_tokens:usage.cachedContentTokenCount||0
							}
						};
					},
				},
			},
		};
	} catch (error) {
		console.error("connectGoogle error:",error.message);
		return null;
	}
}

// API support for anthropic

function anthropicSystem(payload){
	const system=[];
	for(const item of payload.messages){
		switch(item.role){
			case "system":
				system.push({type:"text",text:item.content});
				break;
		}
	}
	return system;
}

const anthropicStore:Record<string, string>={};

async function anthropicStatus(anthropic,flush=false){
//	echo("[ANTRHOPIC]","File shares");
	const files = await anthropic.beta.files.list({betas: ['files-api-2025-04-14']});
	for (const file of files.data) {
		const hash=file.filename;
		if(flush){
			await anthropic.beta.files.delete(file.id,{betas:['files-api-2025-04-14']});
			echo("[CLAUDE]","deleted ",file.id);
		}else{
			if(hash.length==64){
				anthropicStore[hash]=file.id;
				if(roha.config.debugging) echo("[ANTHROPIC]",file.id,hash);
			}
		}
	}
}

// returns result.id or none if file type not currently supported

async function anthropicFile(anthropic,blob){
	const hash=await hashFile(blob.path);
	if(hash in anthropicStore) return anthropicStore[hash];
	const fileContent = await Deno.readFile(blob.path);
	const name=hash;//blob.path;
	let fileType="";
	if(blob.type.startsWith("text/")) fileType="text/plain";
	if(blob.type.startsWith("image/jpeg") ) fileType=blob.type;
	if(blob.type.startsWith("image/png") ) fileType=blob.type;
	if(blob.type=="application/pdf") fileType=blob.type;
	if(!fileType) return null;
	const file = await toFile(fileContent,name,{type:fileType});
	const result = await anthropic.beta.files.upload({file,betas:['files-api-2025-04-14']});
	anthropicStore[hash]=result.id;
	// console.log("[ANTHROPIC]","store",blob,result);
	return result.id;
}

async function anthropicMessages(anthropic,payload){
	const messages=[];
	let blob={};
	let blocks=0;
	for(const item of payload.messages){
//		console.log("[CLAUDE]","item ",item);
		switch(item.role){
			case "user":{
					const name=item.name;
					if(name=="blob"){
						blob=JSON.parse(item.content);
						continue;
					}
					if(name=="image" || name=="content"){
						try{
							const id=await anthropicFile(anthropic,blob);
							if(id){
//								echo("[ANTHROPIC]","file ",blob.path,name,id,blocks);
								const text="File shared path:"+blob.path+" type:"+blob.type;
								const content=[
									{type:"text",text},
									{
										type:(name=="image")?"image": "document",
										source:{type:"file",file_id:id},
										...(blocks<4 && {cache_control:{type:"ephemeral"}})
									}
								];
								messages.push({role:"user",content});
								blocks++;
							}else{
//								echo("[ANTHROPIC]","ignoring unsupported file type",blob.path);
							}
						}catch( error){
							echo("[ANTHROPIC]",error);
						}
					}else{
						const content=item.name?item.name+": "+item.content:item.content;
						messages.push({role:"user",content:content});
					}
				}
				break;
			case "assistant":
				if(item.tool_calls){
					const tool_use = item.tool_calls.map(call => ({
						type: "tool_use",
						id: call.id,
						name: call.function.name,
						input: JSON.parse(call.function.arguments || "{}")
					}));
					const content = [];
					if (item.content) {
						content.push({type: "text", text: item.content});
					}
					content.push(...tool_use);
					messages.push({role: "assistant", content});
					echo("[ANTHROPIC]","pushed fountain tool_calls", tool_use.length);
				}else{
//					messages.push({role:"assistant",name:item.name,content:item.content});
					const content=item.name?item.name+": "+item.content:item.content;
					messages.push({role:"assistant",content});
				}
				break;
		}
	}
	return messages;
}

function anthropicTools(payload){
	const tools=[];
	for(const tool of payload.tools){
		const f=tool.function;
		const s=f.parameters;
		const d={name:f.name,description:f.description,input_schema:s};
		tools.push(d);
	}
	return tools;
}

async function connectAnthropic(account,config){
	try{
		const baseURL=config.url;
		const apiKey=getEnv(config.env);
		if(!apiKey) return null;
		const headers={
			"x-api-key":apiKey,
			"Content-Type": "application/json",
			"anthropic-version": "2023-06-01",
			"anthropic-beta": "files-api-2025-04-14"
		};
		const response = await fetch(baseURL+"/models",{ method: "GET", headers });
		if (!response.ok) {
			console.info("connectAnthropic response",response)
			return null;
		}
		const data=await response.json();
		const list=[];
		for(const model of data.data){
			//{"type":"model","id":"claude-opus-4-20250514","display_name":"Claude Opus 4","created_at":"2025-05-22T00:00:00Z"}
			if(model.type=="model"){
				const name=model.id+"@"+account;
				list.push(name);
				const t=unixTime(model.created_at);
				const spec={id:model.id,object:"model",created:t,owner:"owner"}
				specModel(spec,account);
			}else{
				echo("[CLAUDE]","unexpected model type",model);
			}
		}
		modelList.push(...list);
		const sdk=new Anthropic({apiKey});
		await anthropicStatus(sdk);
		return {
			sdk,
			apiKey,
			baseURL,
			modelList:list,
			models: {
				list: async () => models, // Return cached models or fetch fresh
			},
			reset:async()=>{await anthropicStatus(sdk,true);},
			chat: {
				completions: {
					// grok was here
					create: async (payload) => {
						const model = payload.model;
						const system = anthropicSystem(payload);
						const messages = await anthropicMessages(sdk, payload);
						const max_tokens = 8192; // Anthropic max_tokens
						const request = { model, max_tokens, system, messages };

						const name=model+"@anthropic";
						const info=name in modelSpecs?modelSpecs[name]:{};
						const cold=info?.cold;
						const lizard=info?.lizard;
						if(!cold){
							request.temperature=grokTemperature;
						}							
//						request.top_p=grokGrounded;
						if (payload.tools) {
							request.tools = anthropicTools(payload); // Ensure this maps tools to Anthropic format
						}

						if(roha.config.thinking&&!lizard) {
							request.thinking={type:"adaptive"};
							request.output_config={effort:"high"};
						}
						const options = { headers: { "anthropic-beta": "files-api-2025-04-14" } };

						if(roha.config.debugging) echo("[Anthropic]",request,options);

						const reply = await sdk.messages.create(request, options);
						// Map Anthropic stop_reason to OpenAI finish_reason
						const finishReasonMap = {
							'end_turn': 'stop',
							'tool_use': 'tool_calls',
							'max_tokens': 'length',
							// Add other mappings as needed
						};
						const finish_reason = finishReasonMap[reply.stop_reason] || 'stop';
						const choices = [];
						let choiceIndex = 0;
						const toolCalls = reply.content
							.filter(content => content.type === 'tool_use')
							.map((content, index) => ({
								id: content.id,
								type: 'function',
								function: {
									name: content.name,
									arguments: JSON.stringify(content.input || {})
								}
							}));
							if (toolCalls.length > 0) {
								choices.push({
									index: choiceIndex++,
									message: {
										role: 'assistant',
										content: null, // OpenAI sets content to null when tool_calls are present
										tool_calls: toolCalls
									},
									finish_reason: 'tool_calls'
								});
							}
							const textContent = reply.content
								.filter(content => content.type === 'text')
								.map(content => content.text)
								.join('\n'); // Combine multiple text blocks if any
							if (textContent) {
								choices.push({
									index: choiceIndex++,
									message: {
										role: 'assistant',
										content: textContent
									},
									finish_reason: finish_reason
								});
							}

						// Construct usage object
						// echo("reply.usage",reply.usage);
						const usage = {
							prompt_tokens: reply.usage.input_tokens,
							cache_tokens: reply.usage.cache_read_input_tokens,
							completion_tokens: reply.usage.output_tokens,
							total_tokens: reply.usage.input_tokens + reply.usage.output_tokens
						};

						// Log for debugging (optional)
						// echo('[CLAUDE]","Response:', { model, choices, usage, finish_reason });

						return {
							id: reply.id || `chatcmpl-${Date.now()}`, // Generate a unique ID if not provided
							object: 'chat.completion',
							created: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
							model,
							choices,
							usage
						};
					}
				}
			}
		};
	} catch (error) {
		console.error("connectAnthropic error:",error.message);
		return null;
	}
}

// API support for DeepSeek

async function connectDeepSeek(account,config) {
	try{
		const baseURL=config.url;
		const apiKey=getEnv(config.env);
		if(!apiKey) return null;
		const headers={Authorization:"Bearer "+apiKey,"Content-Type":"application/json"};
		const response=await fetch(baseURL+"/models",{method:"GET",headers});
		if (!response.ok) return null;
		const models=await response.json();
		const list=[];
		for (const model of models.data) {
//			echo("[DEEPSEEK]",model);
			const name=model.id+"@"+account;
			list.push(name);
// dont do this	if(verbose) echo("model - ",JSON.stringify(model,null,"\t"));
			specModel(model,account);
		}
		list.sort();
		modelList=modelList.concat(list);
	//	echo("connected DeepSeek",list);
		return {
			apiKey,
			baseURL,
			modelList:list,
			models: {
				list: async () => models, // Return cached models or fetch fresh
			},
			chat: {
				completions: {
					create: async (payload) => {
						const url=`${baseURL}/chat/completions`;
						const response=await fetch(url, {
							method: "POST",
							headers,
							body: JSON.stringify(payload),
						});
						if (!response.ok) {
							console.log("[DeepSeek]","not ok",response.status,response.statusText);
							throw new Error("DeepSeek API error "+response.statusText);
						}
						return await response.json();
					},
				},
			},
		};
	} catch (error) {
		echo(`Account ${account} fetch error: ${error.message}`);
		return null;
	}
}

// API support for OpenAI SDK
function onSpeak(endpoint, apiKey, config) {
	return async (payload = {}) => {
		const url = config.url+"/audio/speech";
		const options={
			method: "POST",
			headers: {
				"Authorization": `Bearer ${apiKey}`,
				"Content-Type":"application/json",
				"Accept":"audio/mp3"
			},
			body:JSON.stringify(payload)
		};
		const response = await fetch(url,options);
		if(!response.ok){
			echo("[SAY]","response not ok",response.statusText);
			return null;
		}
		return new Uint8Array(await response.arrayBuffer());
	};
}
async function connectOpenAI(account,config) {
	try{
		const apiKey=config.env?getEnv(config.env):"";
		const endpoint=new OpenAI({ apiKey, baseURL: config.url, timeout: 86400000 });
		if(roha.config.debugging){
//			debugValue("endpoint",endpoint)
		}
		const models=await endpoint.models.list();
		const list=[];
		for (const model of models.data) {
			const name=model.id+"@"+account;
			list.push(name);
			specModel(model,account);
		}
		list.sort();
		endpoint.modelList=list;
		modelList=modelList.concat(list);
		endpoint.tts = {speak: onSpeak(endpoint, apiKey, config)};
		return endpoint;
	}catch(error){
		// Error: 429 "Your team ^&*^&^&*^&*
		// has either used all available credits or reached its monthly spending limit.
		// To continue making API requests, please purchase more credits or raise your spending limit."
		if(error.status==429){
			echo("Account Credit Error, please topup.");
		}else{
			echo("Connection Error");
			echo(JSON.stringify(error));
		}
	}
}

// Provider Accounts and Language Models

async function connectAccount(account) {
	const config=modelAccounts[account];
	if (!config || config.disabled) return null;
	if (config.env){
		const apiKey=getEnv(config.env);
		if(!apiKey) return null;
	}
	const url=config.url;
	const header=await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000)}).catch(() => "fail");
	if (header=="fail") return null;
	const api=config.api;
	switch(api){
		case "OpenAI":
			return await connectOpenAI(account,config);
		case "DeepSeek":
			return await connectDeepSeek(account,config);
		case "Google":
			return await connectGoogle(account,config);
		case "Anthropic":
			return await connectAnthropic(account,config);
	}
	return null;
}

function specAccount(account){
	const config=modelAccounts[account];
	const endpoint=rohaEndpoint[account];
	const models=endpoint.models||[];
	if(!(account in roha.lode)){
		roha.lode[account]={name:account,url:endpoint.baseURL,env:config.env,credit:0};
	}
	if(roha.config.debugging){
		const lode=roha.lode[account];
		echoInfo("[FOUNTAIN]","specAccount",account,lode);
	}
}

function getDate(yearmonthday:string):number{
	const date=new Date(yearmonthday+"T00:00:00Z");
	const time=Math.floor(date.getTime()/1000);
//	echo("[GETDATE]",time);
	return time;
}

function specModel(model,account){
	const name=model.id+"@"+account;
	const exists=name in roha.mut;
	const spec=(name in modelSpecs)?modelSpecs[name]:null;
	const created=(spec && spec.released)?(getDate(spec.released)):model.created;
	const info=exists?roha.mut[name]:{name,notes:[],errors:[],relays:0,cost:0};
	info.id=model.id;
	info.object=model.object;
	info.created=created;
	info.owner=model.owned_by;
//	echo("specModel",name,JSON.stringify(model));
	if (!info.notes) info.notes=[];
	if (!info.errors) info.errors=[];
//	echo("[MUT]",name,info);
	roha.mut[name]=info;
}

async function aboutModel(modelname){
	const mut=mutName(modelname);
	const info=(modelname in modelSpecs)?modelSpecs[modelname]:null;
	const active=info?info.active:false;
	const name=mut+(active?"":"*");
	const rate=info?info.pricing||[]:[];
	const limit=info?info.maxprompt||0:0;
//	const id=(info?info.id:0)||0;
	const strict=info?info.strict||false:false;
	const multi=info?info.multi||false:false;
	const inline=info?info.inline||false:false;
	const responses=info&&info.endpoints&&info.endpoints.includes("v1/responses")||false;
	const modelProvider=modelname.split("@");
	const provider=modelProvider[1];
	const account=modelAccounts[provider];
	const brand=account.emoji||"";
	const lode=roha.lode[provider];
	const balance=(lode&&lode.credit)?price(lode.credit):"$-";
	if(roha.config.verbose){
		const keys={strict,multi,inline,responses};
		echoInfo("model:",{name,brand,rate,limit,modelname,balance,keys});
	}else{
		echo("model:",{name,brand,rate,limit,balance,modelname});
	}
	if(info){
		if(info.purpose)echoInfo("purpose:",info.purpose);
		if(info.press)echoInfo("press:",info.press);
		if(info.reality)echoInfo("reality:",info.reality);
	}
	await writeForge();
}

//DeepSeek-R1-Distill-Llama-70B
//Meta-Llama-3.1-8B-Instruct
//-experimental -Instruct
function mutName(modelname:string):string{
	const modelAccount=modelname.split("@");
	const path=modelAccount[0];
	const names=path.split("/");
	let name:string=names.pop()||"";
	name=name.replace("-R1-Distill-","-");
	name=name.replace("Meta-Llama-","Llama");
	name=name.replace("-experimental","#");
//	name=name.replace("-Instruct","");
//	name=name.replace("-instruct","");
	name=name.replace("-beta","");
	name=name.replace("-preview","");
	name=name.replace("-next","");
// qwen3 trims
//	name=name.replace("-flash","");
//	name=name.replace("-realtime","");
// grok 4 trims
	name=name.replace("-fast","");
	name=name.replace("-non-reasoning","");
//	name=name.replace("-generate","");
	const namebits=name.split("-");
	const muts=namebits.slice(0,3);
	const bit=namebits[3]||"0.0";
	if ((bit.length==1)||isNaN(parseFloat(bit))) muts.push(bit);
	return muts.join("-");
}

// returns next active model by name
async function nextActiveModel(){
	const current=modelList.indexOf(grokModel);
	const n=modelList.length;
	let index=current;
	while(true){
		index=(index+1)%n
		const modelname=modelList[index];
		if(modelname===grokModel) break;
		const mut=mutName(modelname);
		const info=(modelname in modelSpecs)?modelSpecs[modelname]:null;
		const active=info?info.active:false;
		if(active){
			echoInfo("next active model is",modelname);
			return resetModel(modelname);
		}
	}
	return "";
}

async function resetModel(modelname:string){
	const modelAccount=modelname.split("@");
	const path=modelAccount[0];
	const provider=modelAccount[1];
	const account=modelAccounts[provider];
	if(!account){
		echoWarning("[reset] account not found",modelname);
		return;
	}
	grokModel=modelname;
	grokAccount=account;
	const mut=mutName(modelname);
	rohaModel=mut;
	grokFunctions=true;
	const content=mutsInclude+mut;
	rohaHistory.push({role:"system",title:userdomain,content});
	await aboutModel(modelname);
}

function stripShare(share){
	let dirty=false;
	for(const item of rohaHistory){
		if(item.role==="user" && (item.name==="content" || item.name==="image")){
			echo("[FORGE] stripShare",share,item);
		}
	}
}

function dropShares(){
	let dirty=false;
	for(const item of rohaHistory){
		if(item.role==="user" && (item.name==="content" || item.name==="image")){
			item.name="fountain";
			item.content="dropped share";
			dirty=true;
		}
	}
	if(dirty)echo("[relay] content dropped from history");
	if(rohaSharePaths.length){
		rohaSharePaths=[];
		echo("[relay] all shares dropped");
	}
}

async function shareSlop(path:string,depth:number){
	const stat=await Deno.stat(path);
	const tag="";
	//await promptForge("Enter tag name (optional):");
	if(stat.isDirectory){
		echo("Share directory <shallow> path:",path);
		// TODO: consider depth>1
		await shareDir(path,tag,1,depth);
	}else{
		// attachMedia(words);
		const size=stat.size;
		const modified=stat.mtime.getTime();
		echo("[KOHA] Share file path:",path," size:",size," ");
		const hash=await hashFile(path);
		echoInfo("hash:",hash);
		await addShare({path,size,modified,hash,tag});
	}
}

async function readHistory(paths:string[]){
	let count=0;
	let min=0;
	let max=0;
	let days={};
	let users={};
	let sessions=[];
	let tags={};	// reset on [roha] session boundaries
	let stats={};	// all tags
	for(const path of paths){
		echo("[LOG]",path);
		let log=await Deno.readTextFile(path);
		const lines=log.split("\n");

		let lineNumber=0;
		for(const line of lines){
			const hex=line.substring(0,8);	// ignore 16ths
			const secs=parseInt(hex,16);
			if(Number.isNaN(secs)) continue;
			const date=slopDate(secs);

			if(date in days){
				days[date].count++;
			}else{
				days[date]={sessions:0,bytes:0,count:0,tags:{}}
			}
			const day=days[date];

			const tagline=line.substring(8);

			if(tagline=="[roha] 𓅷 𓅸 𓅹 𓅺 𓅻 𓅼 𓅽"){
				sessions.push({line:lineNumber,tags});
				tags={};
				day.sessions++;
			}
			const b0=line.indexOf("[");
			const b1=line.indexOf("]");
			if(b1>b0){
				const n=line.length-b1;
				day.bytes+=n;
				const key=line.substring(b0+1,b1);
				if(key in tags){tags[key].count++;tags[key].bytes+=n}else tags[key]={key,count:1,bytes:n};
				if(key in day.tags){day.tags[key].count++;day.tags[key].bytes+=n;}else day.tags[key]={key,count:1,bytes:n}
				if(key in stats){stats[key].count++;stats[key].bytes+=n}else stats[key]={key,count:1,bytes:n};
			}
			if(!min || secs<min) min=secs;
			if(secs>max) max=secs;
			lineNumber++;
		}
		sessions.push({line:lineNumber,tags:{...tags}});
	}

//	echo("[LOG]",path,count,minDate,maxDate,sessions.length,Object.keys(days).length);

	const minDate=slopDate(min);
	const maxDate=slopDate(max);
	echo("[LOG]",{count,minDate,maxDate,sessions:sessions.length,days:Object.keys(days).length});
	const sortedDays = Object.keys(days).sort((a, b) => {a.localeCompare(b)});
	let index=1;
	for(const day of sortedDays){
		const tags=[];
		for(const tag in days[day].tags||[]){
			const mut=days[day].tags[tag];
			if(mut.key=="roha") continue;
			tags.push(mut.key+"["+mut.count+"]");
		}
		const sessions=days[day].sessions;
		echo("#"+index,day,{sessions,tags:tags.join()});
		index++;
	}

	const sortedStats = Object.keys(stats).sort((a, b) => stats[b].bytes-stats[a].bytes);
	for(const key of sortedStats){
		echo(stats[key]);
	}
}

async function historyCommand(words:string[]){
	let scanAll:boolean=words[1]=="all";
	let logPath=resolve(forgePath,"forge.log");
	const paths=[logPath];
	if(scanAll){
		const archivePath="../../nitrologic.github.io/raw";
		const archives=await readFileNames(archivePath,".log");
		for(const archive of archives){
			const path=resolve(archivePath,archive);
			paths.push(path);
		}
	}
	return readHistory(paths);
}

async function stripLog(path:string,counts){
	let count=0;
	let min=0;
	let max=0;
	try {
		const fileContent=await Deno.readTextFile(path);
		const lines=fileContent.split("\n");
		for(const line of lines){
			const hex=line.substring(0,8);	// ignore 16ths
			const secs=parseInt(hex,16);
			if(Number.isNaN(secs)) continue;
			if(!min || secs<min) min=secs;
			if(secs>max) max=secs;
//			console.log("[STRIP]",line,secs);
			const p0=line.indexOf("[");
			const p1=line.indexOf("]");
			if(p0==8 && p1>p0){
				const from=line.substring(p0+1,p1);
				if(from in counts) counts[from]++; else counts[from]=1;
			}
			count++;
		}
	} catch (error) {
		echo("[STRIP] stripLog error",error.message);
	}
	const minDate=slopDate(min);
	const maxDate=slopDate(max);
	echo("[STRIP]",path,count,minDate,maxDate);
}

async function shareCommand(words:string[]){
	const tag="";
	const r=words[1];
	const hasDepth=r.startsWith("/r");
	const depth=hasDepth?Number(r.substring(2))||5:1;
	const filename=words.slice(hasDepth?2:1).join(" ");
	const pattern=filename;
	for await (const entry of expandGlob(pattern)) {
		if (entry.isFile) {
			await shareSlop(entry.path,depth);
		}
		if(entry.isDirectory){
			console.log("### sharing",entry.path);
			await shareDir(entry.path,tag,1,depth);
		}
	}
	await writeForge();
}

// updates global shareList array

async function listShare(sortSize:boolean){
	const project=roha.project;
//	const list=[];
	let count=0;
	const sorted=roha.sharedFiles.slice();
	if(sortSize){
		sorted.sort((a, b) => b.size - a.size);
	}
	for (const share of sorted) {
		const shared=(rohaSharePaths.includes(share.path))?"🔗":"";
		const tags="[ "+share.tag+" "+rohaUser+" "+project+" ]";	//+rohaTitle
		const detail=(share.description)?share.description:"";
		let size=share.size;
		try{
			const stat=await Deno.stat(share.path);
			size=stat.size||0;
		}catch(error){
			size=0;	// the share is gone
		}
//		echo((count++),share.path,share.size,shared,tags,detail);
		if(size){
			const hash="";//share.hash;
			const stars=share.stars||"-";
			echo((count++),share.path,unitString(size),shared,stars,tags,detail,hash);
//			list.push(share.id);
		}
	}
	shareList=sorted;
}

async function starCommand(words:string[]){
	if (words.length==1){
		await listShare(true);
		listCommand="star";
	}else{
		let name=words[1];//.slice(1).join(" ");
		if(name=="clear"){
			for(const share of roha.sharedFiles){
//				echo("[FORGE] clearing stars from keyedShares",share.id);
				if(share.stars?.length){
					share.stars="";
					echo("[FORGE] cleared stars from share",share.id);
				}
			}

		}
		let share=null;
		if(isFinite(name) && shareList?.length){
			const index=name|0;
			share=shareList[index];
		}
		if(share){
			let addStars=words[2];
			let stars=(share.stars||"")+(addStars||"");
			if(addStars && stars.length){
				share.stars=stars;
				await writeForge();
				echo("[FORGE] added stars to share",share.id,stars);
			}else{
				share.stars="";
				echo("[FORGE] removed stars from share",share.id);
			}
		}
	}
}


async function listSaves(){
	const saves=roha.saves||[];
	for(let i=0;i<saves.length;i++){
		const path="forge/"+saves[i];
		const length=await fileLength(path)||"-";
		const modified=await fileModified(path)||"-";
		echo(i,path,length,modified);
	}
}

async function saveSpeech(audio: Uint8Array, format: string = "mp3"): Promise<string> {
	try {
		const timestamp=Math.floor(Date.now()/1000).toString(16);
		const filename=("speech-"+timestamp)+"."+format;
		const filePath=resolve(forgePath,filename);
		const line="saved "+filename;
		rohaHistory.push({role:"system",title:"saveSpeech",content:line});
		await Deno.writeFile(filePath, audio);
		echo("[SAY]",line);
		// roha.forge.push({ name: `speech-${timestamp}`, path: filePath, type: `audio/${format}` });
		// await writeForge();
		return filePath;
	} catch (error) {
		echo("[SAY] Speech save error",error.message);
	}
}

async function saveHistory(name) {
	try {
		const timestamp=Math.floor(Date.now()/1000).toString(16);
		const filename=(name||"transmission-"+timestamp)+".json";
		const filePath=resolve(forgePath,filename);
		const line="Saved session "+filename+".";
//		rohaHistory.push({role:"system",title:"Fountain History Saved",content:line});
		rohaHistory.push({role:"system",title:"saveHistory",content:line});
		await Deno.writeTextFile(filePath,JSON.stringify(rohaHistory,null,"\t"));
		echoInfo("[FORGE]",line);
		roha.saves.push(filename);
		await writeForge();
	} catch (error) {
		echo("[FORGE] saveHistory error",error.message);
	}
}

async function loadHistory(filename){
	let history;
	try {
		const fileContent=await Deno.readTextFile(filename);
		history=JSON.parse(fileContent);
		echo("History restored from",filename);
	} catch (error) {
//		console.error("Error restoring history:", error.message);
		echo("[FORGE] loadHistory error",error.message);
		resetHistory()
	}
	return history;
}

function stripAnsi(text:string) {
	return text.replace(/\x1B\[\d+(;\d+)*[mK]/g, "");
}

// table box drawing code

const TopLeft=0;
const TopRight=1;
const BottomLeft=2;
const BottomRight=3;
const Horizontal=4;
const HorizontalDown=5;
const HorizontalUp=6;
const Vertical=7;
const VerticalLeft=8;
const VerticalRight=9;
const Cross=10;

function boxTop(widths){
	const box=boxChars[0];
	const h=box.charAt(Horizontal);
	const hd=box.charAt(HorizontalDown);
	const tl=box.charAt(TopLeft);
	const tr=box.charAt(TopRight);
	const bits=[];
	for(const wid of widths){
		bits.push(h.repeat(wid));
	}
	return tl+bits.join(hd)+tr;
}

function boxCells(widths,cells,discord:boolean){
	const box=boxChars[0];
	const v=box.charAt(Vertical);
	const bits=[];
	const dags=[];
	for(let i=0;i<widths.length;i++){
		const w=widths[i];
		const value=cells[i];
		const indent=(w>2)?" ":"";
		const cell=indent+value;
		const wide=discord?discordStringWidth(cell):stringWidth(cell);
		const thinpad=((wide*2)&1)?ThinSpace:"";
		const diff=w-wide;
		const pads=Math.floor(diff);
		const padding=(pads>0)?" ".repeat(pads):"";
		bits.push(cell+thinpad+padding);
	}
	for(let i=widths.length;i<cells.length;i++){
		const value=cells[i];
		dags.push(value);
	}
	return v+bits.join(v)+v+dags.join( );
}

function boxSplit(widths){
	const box=boxChars[0];
	const h=box.charAt(Horizontal);
	const x=box.charAt(Cross);
	const vr=box.charAt(VerticalRight);
	const vl=box.charAt(VerticalLeft);
	const bits=[];
	for(let i=0;i<widths.length;i++){
		const w=widths[i];
		bits.push(h.repeat(w));
	}
	return vr+bits.join(x)+vl;
}

function boxBottom(widths){
	const box=boxChars[0];
	const h=box.charAt(Horizontal);
	const hu=box.charAt(HorizontalUp);
	const bl=box.charAt(BottomLeft);
	const br=box.charAt(BottomRight);
	const bits=[];
	for(const wid of widths){
		bits.push(h.repeat(wid));
	}
	return bl+bits.join(hu)+br;
}

function insertTable(result:string[],table:string[][],addFence:boolean,discord:boolean){
	const widths=[];
	for(const row of table){
		for(let i=0;i<row.length;i++){
			const w=2+(row[i].length|0);
			if(w>(widths[i]|0)) widths[i]=w;
		}
	}
//	console.log("widths",widths);
	if(addFence) result.push("```");
	let header=true;
	for(const row of table){
		if(header){
			result.push(boxTop(widths));
			result.push(boxCells(widths,row,discord));
			result.push(boxSplit(widths));
			header=false
		}else{
			// ignore spacers
			const content=row.join("").replaceAll("-","").replaceAll(" ","");
			if(content.length) result.push(boxCells(widths,row,discord));
		}
	}
	result.push(boxBottom(widths));
	if(addFence) result.push("```");
}

const rohaPrompt=">";
let colorCycle=0;

// warning - do not call echo from here
// work in progress latex $\mu$ support

// kimi-k2 tiny tex→unicode mapper (extend as needed)

function texToUnicode(tex: string): string {
	return tex
		// Greek
		.replace(/\\alpha/g,'α').replace(/\\beta/g,'β').replace(/\\gamma/g,'γ')
		.replace(/\\delta/g,'δ').replace(/\\theta/g,'θ').replace(/\\mu/g,'μ')
		.replace(/\\pi/g,'π').replace(/\\sigma/g,'σ').replace(/\\omega/g,'ω')
		// Math
		.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1⁄$2')
		.replace(/\\sqrt\{([^}]+)\}/g, '√$1')
		.replace(/\\sqrt/g,'√')
		.replace(/\\cdot/g,'·').replace(/\\times/g,'×')
		.replace(/\\leq/g,'≤').replace(/\\geq/g,'≥')
		// Superscripts (simple single digit)
		.replace(/\^([0-9])/g, (m, d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d])
		// Cleanup braces
		.replace(/\{|\}/g, '');
}

function replaceLatex(line: string): string {
	return line.replace(/(\$\$?)((\\.|[^$])+?)\1/g, (_, delim, tex) => texToUnicode(tex));
}

function mdToAnsi(md) {
	const broken=roha.config.broken;
	const lines=md.split("\n");
	let inCode=false;
	let table=[];
	const result=broken?[ANSI.BG.GREY]:[];
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
				if(roha.config.debugging&&codeType) print("inCode codetype:",codeType,"line:",line);
			}else{
				result.push(ANSI.RESET);
				if (broken) result.push(ANSI.BG.GREY);
			}
		}else{
			if (!inCode) {
				// rules
				if(line.startsWith("---")||line.startsWith("***")||line.startsWith("___")){
					line=pageBreak.substring(0,terminalColumns-10);
				}
				if(line.startsWith("|")){
					const split=line.split("|");
					const splits=split.length;
					if(splits>2){
						let trim=split.slice(1,splits-1);
						table.push(trim);
//						echo("[TABLE]",trim)
					}
					continue;
				}else{
					if(table.length) {
						insertTable(result,table,false);
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
				// underline
				if(roha.config.underline){
					line=line.replace(/_(.*?)_/g, "\x1b[3m$1\x1b[0m");
				}
				line=replaceLatex(line);
				// wordwrap
				line=wordWrap(line,terminalColumns);
			}
			result.push(line.trimEnd());
		}
	}
	if(poplast){
		result.pop();
	}
	// yuck - duplicate path way from above
	if(table.length) {
		insertTable(result,table,false);
		if(roha.config.debugging) echo("[TABLE] inserted",table.length)
		table.length=0;
	}
	result.push(ANSI.RESET);
	return result.join("\r\n");
}

function hexBytes(bytes:Uint8Array):string{
	return Array.from(bytes, (byte) =>
		byte.toString(16).padStart(2, "0")
	).join("");
}

async function hashFile(filePath):string{
	const buffer=await Deno.readFile(filePath);
	const hash=await crypto.subtle.digest("SHA-256", buffer);
	const bytes=new Uint8Array(hash);
	return hexBytes(bytes);
}

async function readForge(){
	try {
		const fileContent=await Deno.readTextFile(rohaPath);
		roha=JSON.parse(fileContent);
		if(!roha.saves) roha.saves=[];
		if(!roha.counters) roha.counters={};
		if(!roha.mut) roha.mut={};
		if(!roha.forge) roha.forge=[];
		if(!roha.lode) roha.lode={};
		if(!roha.nic) roha.nic=sanitizeNic(username);
		if(!roha.keyedShares) roha.keyedShares={};
		if(!roha.keyedProjects) roha.keyedProjects={};
		if(!roha.sharedFiles) roha.sharedFiles=[];
	} catch (error) {
		console.error("Error reading or parsing",rohaPath,error);
		roha=emptyRoha;
	}
}

async function refreshSaves() {
	const files=await readFileNames(forgePath,".json");
	for (const file of files) {
		if (file.startsWith("transmission-") && !roha.saves.includes(file)) {
			roha.saves.push(file);
		}
	}
	roha.saves.sort();
}

async function writeForge(){
//	console.log("[WRITING] roha",roha)
	const json=JSON.stringify(roha, null, "\t");
	try {
		roha.model=grokModel;
		await Deno.writeTextFile(rohaPath,json);
	} catch (error) {
		console.error("Error writing",rohaPath,error);
	}
}

async function resetCommand(all=false){
	grokTemperature=ResetTemperature;
	rohaSharePaths=[];
	roha.sharedFiles=[];
	roha.project="roha";
//	roha.persona="sloppy";
	if(all){
		roha.keyedShares={};
		roha.keyedProjects={};
//		currentDir=Deno.cwd();
//		Deno.chdir(currentDir);
	}
//	roha.tags={};
	if(roha.config.resetcounters) {
		roha.counters={};
		for(const account in rohaEndpoint){
			const endpoint=rohaEndpoint[account];
			if(endpoint.reset) await endpoint.reset();
		}
	}
	increment("resets");
	await writeForge();
	resetHistory();
	echo("[KOHA]","resetCommand All shares and history reset. Resetting model.");
	await resetModel(roha.model||defaultModel);
	// log still fill
}

function resolvePath(dir,filename){
	let path=resolve(dir,filename);
	path=path.replace(/\\/g, "/");
	return path;
}

function onRefresh(frame:number,message:string){
//	console.log("!~",frame,message);
}

async function promptFountain(message:string) {
	if(!roha.config.slopprompt) {
		const line=prompt(message);
		return {line};
	}
	const response=await slopPrompt(message,20,onRefresh);
	if(response==null){
		await exitForge();
		Deno.exit(0);
	}
	return response;
}

// returns with {line} or {messages}
async function promptForge(message:string):string {
	if(!roha.config.slopprompt) {
		const line=prompt(message);
		return line;
	}
	const response=await slopPrompt(message,20,onRefresh);
	if(response==null){
		await exitForge();
		Deno.exit(0);
	}
	return response.line;
}

// share is {path size modified hash tag}
// duplicates get removed
async function addShare(share){
	share.id="share"+increment("shares");
	if(share.path){
		const index=roha.sharedFiles.findIndex(item => item.path===share.path);
		if (index!==-1) {
			roha.sharedFiles.splice(index,1);
		}
		// new format needs context
		// echo("[ADDSHARE]",share);
		roha.sharedFiles.push(share);
		const name=basename(share.path);
		const dirpath=dirname(share.path);
		const dir=basename(dirpath);
		// echo("[SHARE]",share.path,name,dir,dirpath);
		if(name=="relay.md"){
			const success=await setProject(dir,dirpath);
		}
	}
	if(share.tag) {
		await setTag(share.tag,share.id);
	}
	// new keyedShares per project sharedFiles
	const key=roha.project||"roha";
	roha.keyedShares[key]=roha.sharedFiles;
}

async function shareDir(dir:string, tag:string, depth=1, maxDepth=5) {
	try {
		const paths:string[]=[];
		for await (const file of Deno.readDir(dir)) {
			if(file.isDirectory){
				if(!file.name.startsWith(".")){
					const path = resolvePath(dir, file.name);
					if(depth<maxDepth){
						shareDir(path, tag, depth + 1, maxDepth);
					}
				}
			}else{
				if (file.isFile && !file.name.startsWith(".")) {
					const path=resolvePath(dir,file.name);
					paths.push(path);
				}
			}
		}
		let totalSize=0;
		for (const path of paths) {
			try {
				echo("[KOHA] Sharing",path);
				const stat=await Deno.stat(path);
				const size=stat.size||0;
				const modified=stat.mtime.getTime();
				const hash=await hashFile(path);
				await addShare({ path, size, modified, hash, tag });
				totalSize+=size;
			} catch (error) {
				echo("[KOHA]","shareDir error",path,error.message);
				continue;
			}
		}
		const total=unitString(totalSize,4,"B");
		echo("[KOHA]","shared",paths.length,"files from",dir,"with tag",tag,total);
	} catch (error) {
		echo("shareDir error",String(error)); //.message
		throw error;
	}
}

function annotateCode(name,description){
	echo("[TODO] annotateCode",name,description);
}

const imageExtensions=[
	"jpg","jpeg","png"
];

const textExtensions=[
	"js", "ts", "txt", "json", "md",
	"css","html", "svg",
	"cpp", "c", "h", "cs", "s", "java",
	"sh", "bat",
	"log","py","csv","xml","ini"
];

const fileTypes={
	"pdf": "application/pdf",
	"js": "text/x-javascript",
	"ts": "text/x-typescript",
	"txt": "text/plain",
	"json": "text/json",
	"md": "text/markdown",
	"css": "text/css",
	"html": "text/html",
	"gles": "text/x-gles",
	"svg": "image/svg+xml",
	"cpp": "text/x-c++src",
	"c": "text/x-csrc",
	"h": "text/x-chdr",
	"cs": "text/x-csharp",
	"s": "text/x-asm",
	"java": "text/x-java",
	"sh": "text/x-shellscript",
	"bat": "text/x-batch",
	"log": "text/plain",
	"py": "text/x-python",
	"csv": "text/csv",
	"xml": "application/xml",
	"ini": "text/plain",
	"jpg": "image/jpeg",
	"jpeg": "image/jpeg",
	"png": "image/png",
	"mp3": "audio/mpeg",
	"ico": "image/x-icon",
	"lock": "text/plain",
	"pio": "text/x-asm"
};

const commonTextFiles=["LICENSE","README","CHANGELOG","COPYING","AUTHORS","INSTALL"];

function fileType(path:string){
	const name=path.split("/").pop();
	if(commonTextFiles.includes(name.toUpperCase())) return "text/plain";
	const extension=path.split(".").pop().toLowerCase();
	return fileTypes[extension.toLowerCase()] || "application/octet-stream";
}

// TODO: support more than just text content and image base 64 blobs

async function shareBlob(path,size,tag){
	const mimeType=fileType(path);
	// gemini barfs on icons
	if(mimeType=="image/x-icon") return false;
	const metadata=JSON.stringify({ path:path,length:size,type:mimeType,tag });
	rohaPush(metadata,"blob");
	if(mimeType.startsWith("text/")){
		const content=await Deno.readTextFile(path);
		rohaPush(content,"content");
	} else {
		const data=await Deno.readFile(path);
		const base64=encodeBase64(data);
		rohaPush(base64,"image");
	}
	return true;
}

async function commitShares(tag) {
	let count=0;
	let dirty=false;
	let validShares=[];
	const removedPaths=[];
	let starCount=0;
	echo("[RELAY] commitShares starCount");
	for (const share of roha.sharedFiles) {
		starCount+=share.stars?.length;
	}
	const starMode=roha.config.starshare&&(starCount>0);
	echo("[RELAY] commitShares starCount",starCount);
	//filter previously shared starless from sharedFiles
	if(starMode&&starCount){
		echo("[RELAY] commitShares stripping validShares");
		validShares=[];
		for (const share of roha.sharedFiles) {
			if(!(share.stars?.length)){
				stripShare(share);
			}else{
				validShares.push(share);
			}
		}
		echo("[RELAY] roha.sharedFiles update with",validShares.length)
		roha.sharedFiles=validShares;
	}
	for (const share of roha.sharedFiles) {
		const stars=share.stars||"";
		if(starMode && (stars.length==0)) continue;
		if(roha.config.verbose) echo("[SHARE] commitShares",share,stars);
		if (tag && share.tag !== tag) {
			validShares.push(share);
			continue;
		}
		try {
			const path=share.path;
			const stat=await Deno.stat(path);
			const size=stat.size;
			if (!stat.isFile) {
				removedPaths.push(path);
				echo("[KOHA]","Removed invalid path",path);
				dirty=true;
				continue;
			}
			if (size > MaxFileSize) {
				echo("[KOHA]","MaxFileSize breached",path);
				dirty=true;
				continue;
			}
			const modified=share.modified !== stat.mtime.getTime();
			let isShared=rohaSharePaths.includes(path);
			if (modified || !isShared) {
				let ok=await shareBlob(path,size,tag);
				if(ok){
					count++;
					share.modified=stat.mtime.getTime();
					dirty=true;
					if (!rohaSharePaths.includes(path)) {
						rohaSharePaths.push(path);
						echoInfo("[KOHA]","Shared path",path);
					}else{
						echoInfo("[KOHA]","Updated share path",path);
					}
				}
			}
			validShares.push(share);
		} catch (error) {
			if (error instanceof Deno.errors.NotFound || error instanceof Deno.errors.PermissionDenied) {
				removedPaths.push(share.path);
				dirty=true;
			}
			echo("[KOHA]","commitShares error path",share.path);
			echo("[KOHA]","commitShares error",error.message);
		}
	}
	if (removedPaths.length) {
		roha.sharedFiles=validShares;
		const key=roha.project||"roha";
		roha.keyedShares[key]=roha.sharedFiles;
		await writeForge();
		echoInfo("[KOHA]","commitShares removed", removedPaths.join(" "));
	}
	if (dirty && tag) {
		rohaHistory.push({ role: "system", title:"Fountain Tool Hint", content: "Feel free to call tag_slop to tag " + tag });
	}
	if (count) {
		echoInfo("[KOHA]","Updated files",count,"of",validShares.length);
	}
	return dirty;
}

function listProjects(projects,shares){
	let index=0;
	for(const key of Object.keys(projects)){
		const git=(Object.hasOwn(projects,".gitignore"))?"G":"";
		const star=(key==roha.project)?"*":""; 
		const hasShares=Object.hasOwn(shares,key);
		const share=hasShares?shares[key]:{};
		const project=projects[key];
		echo((index++),key,star,git,share?.length,project)
	}
}

// can fail when folder not found and chdir fails

async function setProject(name,path):boolean{
	dropShares();
	echo("[KEY] setProject",name,path);
	const key=name;
	// TODO: set current roha.project in keyedProjects?
	// TODO: set current rohaSharePaths in keyedShares?
	if(!Object.hasOwn(roha.keyedProjects,key)){
		roha.keyedProjects[key]={key,path,name};
		echo("[KEY] new project created",{key,path,name});	
	}
	roha.project=key;
	rohaSharePaths=[];
	if(Object.hasOwn(roha.keyedShares,key)){
		const shares=roha.keyedShares[key];
		if(roha.config.verbose){
			echo("[KEY] sharing",shares.length);	
			echo("[KEY] sharenames",shares);
		}
		roha.sharedFiles=shares;
	}
//	roha.keyedShares[key];
//	logpath=path
	const history=path+"/relay.log";
	const exists=await pathExists(history);
	if(exists){
		echo("[KEY] history",history);	
		projectHistory=history;
	}else{
		projectHistory="";
	}
//	echo("[KEY] deno chdir",path);	
	try{
		Deno.chdir(path);
		currentDir=Deno.cwd();
	}catch(err){
		return false;
	}
	return true;
}

async function loadProject(name){
	const verbose=roha.config.verbose;
	echo("[KEY] loadProject",name);
	const hasProject=Object.hasOwn(roha.keyedProjects,name);
	if(hasProject){
		if(verbose) echo("[KEY] project key found for name:",name)
	}
	const hasShares=Object.hasOwn(roha.keyedShares,name)
	if(hasShares){
		if(verbose) echo("[KEY] shares key found for name:",name)
	}
	if(hasProject&&hasShares){
		const project=roha.keyedProjects[name];
		const path=project.path;
		const loaded=await setProject(name,path);
		if(loaded){
			echo("project loaded",roha.project);
		}else{
			echo("project error",roha.project);
			resetCommand(false);
		}
	}
}

async function projectCommand(words){
	if (words.length==1){
		listProjects(roha.keyedProjects,roha.keyedShares);
		listCommand="project";
	}else{
		let name=words.slice(1).join(" ");
		if(isFinite(name)){
			const index=name|0;
			const keys=Object.keys(roha.keyedProjects);
			name=keys[index];
		}
		await loadProject(name);
	}
}

async function setTag(name,note){
	const tags=roha.tags||{};
	const tag=(tags[name])?tags[name]:{name,info:[]};
	tag.info.push(note);
	tags[name]=tag;
	roha.tags=tags;
	await writeForge();
//	let invoke=`New tag "${name}" added. Describe all shares with this tag.`;
//	rohaHistory.push({role:"system",content:invoke});
}
function listCounters(){
	let keys=Object.keys(roha.counters);
	let i=0;
	for(let key of keys){
		let count=roha.counters[key];
		echo((i++),key,count);
	}
}
function listTags(){
	let tags=roha.tags||{};
	let keys=Object.keys(tags);
	let list=[];
	let n=keys.length||0;
	for(let i=0;i<n;i++){
		let tag=tags[keys[i]];
		const name=tag.name||"?????";
		if(tag.info){
			echo(i,name,"("+tag.info.length+")");
		}else{
			echo(i,name);
		}
		let info=tag.description;
		if(info) echo("",info);
		list.push(name);
	}
//	tagList=list;
}
async function clipText(text: string): Promise<void> {
	if (typeof text !== "string") {
		throw new Error("Input must be a string");
	}
	let clipCmd: string;
	let args: string[] = [];
	let encodedText: Uint8Array;
	// Determine the clipboard command and encoding based on the operating system
	switch (Deno.build.os) {
		case "darwin":
			clipCmd = "pbcopy";
			args = [];
			encodedText = new TextEncoder().encode(text); // UTF-8 for macOS
			break;
		case "windows":
			clipCmd = "clip";
			args = [];
			// Convert to UTF-16LE with BOM for Windows
			const encoder = new TextEncoder();
			const textBuffer = encoder.encode(text); // Encode to UTF-8 first
			const utf16le = new Uint8Array(text.length * 2 + 2); // Allocate for UTF-16LE (2 bytes per char) + BOM
			utf16le[0] = 0xFF; // BOM: FF FE for UTF-16LE
			utf16le[1] = 0xFE;
			// Convert UTF-8 to UTF-16LE
			let offset = 2;
			for (let i = 0; i < text.length; i++) {
				const charCode = text.charCodeAt(i);
				utf16le[offset++] = charCode & 0xFF;
				utf16le[offset++] = (charCode >> 8) & 0xFF;
			}
			encodedText = utf16le;
			break;
//			const utf16le = new Uint8Array(encoder.encode(text).buffer,0,text.length * 2);
//			encodedText = new Uint8Array([0xFF, 0xFE, ...utf16le]);
		case "linux":
			clipCmd = "xclip";
			args = ["-selection", "clipboard"];
			encodedText = new TextEncoder().encode(text); // UTF-8 for Linux
			break;
		default:
			throw new Error(`Unsupported platform: ${Deno.build.os}`);
	}
	try {
		const process = Deno.run({cmd: [clipCmd, ...args],stdin: "piped",stdout: "piped",stderr: "piped",});
		await process.stdin.write(encodedText);
		process.stdin.close();
		const status = await process.status();
		if (!status.success) {
			const stderr = await process.stderrOutput();
			const errorText = new TextDecoder().decode(stderr);
			throw new Error(`Failed to copy to clipboard: ${errorText}`);
		}
		process.close();
	} catch (err) {
		if (err instanceof Deno.errors.NotFound) {
			throw new Error(`Clipboard command '${clipCmd}' not found. Ensure it is installed.`);
		}
		throw err;
	}
}

async function openWithDefaultApp(path:string) {
	const cmd=Deno.build.os === "windows" ? ["start", "", path] : Deno.build.os === "darwin" ? ["open", path] : ["xdg-open", path];
	await Deno.run({ cmd }).status();
}

function onForge(args){
	let list=roha.forge;
	if(args.length>1){
		let name=args.slice(1).join(" ");
		if(name.length && !isNaN(name)) {
			let item=list[name|0];
			echo("opening",item.name,"from",item.path);
			openWithDefaultApp(item.path);
		}
	}else{
		for(let i=0;i<list.length;i++){
			echo(i,list[i].name);
		}
		listCommand="forge";
	}
}

async function creditAccount(credit:any,account:string){
	const amount=Number(credit);
	const lode=roha.lode[account];
	const current=lode.credit||0;
	lode.credit=amount;
	if(roha.config.verbose) {
		const delta=(current-amount).toFixed(2);
		echo("creditAccount",price(amount),account,"balance",price(lode.credit),"delta",delta);
	}
	await writeForge();
}

// TODO: add a topup column
// TODO: add emoji

async function onAccount(args){
	if(args.length>1){
		let name=args.slice(1).join(" ");
		if(name.length && !isNaN(name)) {
			name=accountList[name|0];
		}
		specAccount(name);
		const lode=roha.lode[name];
		const balance=lode.credit||0;
		echo("Adjust",lode.name,"balance",price(balance));
		creditCommand=(credit)=>creditAccount(credit,name);
		await writeForge();
	}else{
		const list=[];
		for(const key in modelAccounts){
			list.push(key);
		}
		echo_row("id","name","brand","llm","credit","topup");
//		echo_row("----","--","-------------","-----","----------","--------------------");
		for(let i=0;i<list.length;i++){
			const key=list[i];
			const config=modelAccounts[key];
			if(config && key in roha.lode){
				const endpoint=rohaEndpoint[key];
				const models=endpoint?.modelList||[];
				const lode=roha.lode[key];
				const count=(models?.length)|0;
				const emoji=(config.emoji)||"?";
				const link=config.platform||"";
				echo_row(i,key,emoji,count,price(lode.credit),link);
			}else{
// inactive so hidden
//				echo_row(i,key);
			}
			accountList=list;
			listCommand="credit";
		}
	}
}

async function showHelp(words:string[]) {
	try {
		const md=await Deno.readTextFile("forge.md");
		const cmds=md.split("\n### /");
		const intro=cmds[0].split("\n## ")[0].trim();
		if(words.length>1){
			const index=parseInt(words[1]);
			for(let i=1;i<cmds.length;i++){
				if(i==index){
					const help="/"+cmds[i].trim();
					echo("[HELP]",help);
				}
			}
			listCommand="";
		}else{
			echo("[HELP]",intro); //mdToAnsi(intro));
			for(let i=1;i<cmds.length;i++){
				const line=cmds[i];
				const eol:number=line.indexOf("\n");
				const name=line.substring(0,eol);
				echo("#"+i+" /"+name);
				listCommand="help";
			}
		}
	} catch (e) {
		echo("showHelp error",e.message);
	}
}

function readable(content:any):string{
	const text:string=textify(content);
	return text.replace(/\s+/g, " ");
}

function listShares(shares){
//	const list=[];
	let count=0;
	let sorted=shares.slice();
	sorted.sort((a, b) => b.size - a.size);
	for (const share of sorted) {
		let shared=(rohaSharePaths.includes(share.path))?"*":"";
		let tags="["+rohaTitle+" "+share.tag+"]";
		let info=(share.description)?share.description:"";
		echo((count++),share.path,share.size,shared,tags,info);
//		list.push(share.id);
	}
//	shareList=list;
}

// OpenAI voice support

const GPTVoices=["alloy","ash","ballad","coral","echo","fable","onyx","nova","sage","shimmer","verse"];
const GPTFormats=["mp3","opus","aac","flac","wav","pcm"]
const DefaultGPTVoice={name:"alloy",format:"mp3",model:"gpt-4o-mini-tts@openai"};

async function gptSay(text:string,voice=DefaultGPTVoice){
	const modelProvider=voice.model.split("@");
	const modelname=modelProvider[0];
	const provider=modelProvider[1];
	const endpoint=rohaEndpoint[provider];
	if(!endpoint.tts){
		echo("[SAY]","no tts on endpoint",provider);
		return;
	}
	const packet={input:text,model:modelname,format:voice.format,voice:voice.name};
//	echo("[SPEAK]",packet);
	const raw=await endpoint.tts.speak(packet);
	if(raw){
		const audioPath=await saveSpeech(raw,"mp3");
		echo("[SAY]",audioPath);
		open(audioPath);
	}else{
		echo("[SAY]","endpoint tts speak failure",packet);
	}
}

// work in progress voice audition tests

async function auditionCommand(words){
	for(const voice of GPTVoices){
		const text="Hi, I am "+voice+" a ChatGPT voice."
//		await gptSay(text,{name:voice,format:"mp3",model:"gpt-4o-mini-tts@openai"});
		await gptSay(text,{name:voice,format:"mp3",model:"gpt-audio@openai"});
	}
	return;
	echo("[AUDITION]","no voice groups in line, please modify and rebuild - async function auditionCommand" );
	return;
	for(const voice of GeminiVoices){
		const text="Hi, I am "+voice+" a Gemini voice."
		await geminiSay(text,voice);
	}
	return;
	for(const voice of AppleVoices2){
		const text="Hi, I am "+voice+" an Apple voice."
		await appleSay(text,voice);
	}
	return;
}

async function sayCommand(words){
	const messages=rohaHistory;
	const message=messages.at(-1);
//	echo("[SAY]",message);
//	await gptSay(message.content);
	await geminiSay(message.content);
}


async function openCommand(words){
	const messages=rohaHistory;
	const message=messages.at(-1);
	// todo use args
	const path:string=words.slice(1).join(" ").trim()||"fountain.md";
	const parts:string[]=[];
	let command="";
	if (Deno.build.os === "darwin") {
		command = "open";
		parts.push(path);
	} else if (Deno.build.os === "linux") {
		command = "xdg-open";
		parts.push(path);
	} else if (Deno.build.os === "windows") {
		command = "cmd";
		parts.push("/c", "start", "", [path]);
	} else {
		console.error("Unsupported OS");
		return;
	}
	new Deno.Command(command, { args: parts }).spawn();
}

// modelCommand - list table of models

const modelKeys="👀🤖👄"+Pail+"🧊❃";
const modelKey={"👀":"Vision","🤖":"Low Latency","👄":"Speech","🪣":"Tools","🧊":"Frigid","❃":"Active"};

async function modelCommand(words){
	let name=words[1];
	if(name && name==="next"){
		name=nextActiveModel();
	}
	if(name && name!="all" && name!="voice"){
		if(name.length&&!isNaN(name)) name=modelList[name|0];
		if(modelList.includes(name)){
			await resetModel(name);
			await writeForge();
		}
	}else{
//		echoKey(modelKey,100);
		echo_row("id","☐","model","vendor","count","price");
		const all=(name && name=="all");
		const voice=(name && name=="voice");
		for(let i=0;i<modelList.length;i++){
			const modelname=modelList[i];
// mutspec from roha.mut
			const mutspec=(modelname in roha.mut)?roha.mut[modelname]:{...emptyMUT};
			mutspec.name=modelname;
			const notes=[...mutspec.notes];
			if(mutspec.hasForge) notes.push(Pail);
			// info is model rated stats
			const info=modelname in modelSpecs?modelSpecs[modelname]:{};
			const speech=info.endpoints && info.endpoints.includes("v1/audio/speech");
// todo: ⭐power
			const isMut=(modelname==grokModel);
			const isActive=info.active;
			const attr=isMut?"☑":(isActive?"☐":" ");
// tag model key
			if(info.active) notes.push(activeChar);
			if(info.cold) notes.push("🧊");
			if(info.multi) notes.push("👀");
			if(info.robot) notes.push("🤖");
			if(speech) notes.push("👄");
//			if(info.strict) notes.push("🌪️");
//			if(info.inline) notes.push("📘");
			const seconds=mutspec.created;
			const created=dateStamp(seconds);
			const priced=info.pricing;
			const deprecated:boolean=info.deprecated;
			// account from modelProvder
			const modelProvider=modelname.split("@");
			const provider=modelProvider[1];
			const account=modelAccounts[provider];
			const emoji=account.emoji||"";
			const mut=mutName(modelname);
			let cheap = priced && priced[0]<3.01;
			if(!roha.config.budget) cheap=priced;
			if(deprecated) cheap=false;
			const audible=speech && voice;
			if(cheap || all || audible || isMut){
				const pricing=(info&&info.pricing)?stringifyArray(info.pricing):"";
//				echo_row(i,attr,mut,provider,mutspec.relays|0,created,pricing,notes.join(" "));
				echo_row(i,attr,mut,provider,mutspec.relays|0,pricing);
			}
		}
		listCommand="model";
	}
}

async function attachMedia(words){
	if (words.length==1){
		listShares(roha.attachedFiles);
	}else{
		const filename=words.slice(1).join(" ");
		const path=resolvePath(Deno.cwd(), filename);
		const stat=await Deno.stat(path);
		const tag="";//await promptForge("Enter tag name (optional):");
		if(stat.isFile){
			const size=stat.size;
			const modified=stat.mtime.getTime();
			echo("Attach media path:",path,"size:",size);
//			const hash=await hashFile(path,size);
//			echo("hash:",hash);
//			await addShare({path,size,modified,hash,tag});
		}
		await writeForge();
	}
}

const glyphs=" ⛲🪣🐸🪠🐋🐉🌟💫🌏📆💰👀🤖🫦💻👄🔧🧊🔉📷📡🧮📠⛅🧰🌕🌙🏛️🎙️🖼️🗣️🗜️👁𝕏⣯🜁❁❃⚙️✿";
function testUnicode(){
	echo("```")
	echo("|1234|");
	for(const code of glyphs){
		if(code==ZeroWidthJoiner) continue;
		const w=discordStringWidth(code);
		let padding=(w==1)?"---":(ZeroWidthJoiner+"--");
/*
		let padding=" --"+ThinSpace;
		if(w==2.5) padding="++";	//🪣 Wide
		if(w==2) padding="**"+ThinSpace;		//🏛️ thick = normal???
		if(w==1.5) padding="~~~";	//🜁 thin
*/
		echo("|"+code+padding+"|");
	}
	echo("```")
}

// can emit [FOUNTAIN] callCommand error
// TODO: validate docs and link to information
async function callCommand(command:string) {
	let dirty=false;
	let words=command.split(" ");
	try {``
		switch (words[0]) {
			case "tex":
				const tex=words[1];
				echo(replaceLatex(tex));
				break;
			case "spec":
				parseUnicode();
				break;
			case "sys":
			case "announce":
				announceCommand(words);
				break;
			case "listen":
				listenService();
				break;
			case "think":
				if (words.length > 1) {
					const newThink=parseFloat(words[1]);
					if (!isNaN(newThink) && newThink >= 0 && newThink <= 8192) {
						grokThink=newThink;
					}
				}
				echo("Current model thinking budget is", grokThink);
				break;
			case "temp":
				let temp=grokTemperature;
				if (words.length > 1) {
					const newTemp=parseFloat(words[1]);
					if (!isNaN(newTemp) && newTemp >= -5 && newTemp <= 50) {
						grokTemperature=newTemp;
					}else{
						grokTemperature=ResetTemperature;
					}
				}
				echo("Current model temperature was",temp,"is", grokTemperature);
				break;
			case "forge":
				onForge(words);
				break;
			case "counter":
				listCounters();
				break;
			case "tag":
				await listTags();
				break;
			case "account":
			case "credit":
				await onAccount(words);
				break;
			case "help":
				await showHelp(words);
				break;
			case "nic":{
					if(words.length>1){
						const nic=sanitizeNic(words[1].trim()||"nix");
						roha.nic=nic;
						rohaNic=nic;
						await writeForge();
					}else{
						echo(roha.nic);
					}
				}
				break;
			case "config":
				if(words.length>1){
					let flag=words[1].trim();
					if(flag.length && !isNaN(flag)){
						flag=Object.keys(flagNames)[flag|0];
						echo("flag",flag);
					}
					if(flag in flagNames){
						roha.config[flag]=!roha.config[flag];
						echo(flag+" - "+flagNames[flag]+" is "+(roha.config[flag]?"true":"false"));
						await writeForge();
					}
				}else{
					let count=0;
					for(let flag in flagNames){
						echo((count++),flag,":",flagNames[flag],":",(roha.config[flag]?"true":"false"))
					}
					listCommand="config";
				}
				break;
			case "time":
				echo("Local time:", new Date().toString());
				break;
			case "say":
				await sayCommand(words);
				echo(":)");
				break;
			case "open":
				await openCommand(words);
				echo(":]");
				break;
			case "audition":
				await auditionCommand();
				echo(":O");
				break;
			case "log":
				logHistory();
				break;
			case "history":
				await historyCommand(words);
				break;
			case "list":
				listHistory();
				break;
			case "load":{
					let save=words[1];
					if(save){
						if(save.length && !isNaN(save)) save=roha.saves[save|0];
						if(roha.saves.includes(save)){
							echo("loading",save);
							const path="forge/"+save;
							let load=await loadHistory(path);
							rohaHistory=load;
							echo("rohaHistory <= ",save);
						}
					}else{
						await listSaves();
					}
				}
				break;
			case "save":{
					const savename=words.slice(1).join(" ");
					await saveHistory(savename);
				}
				break;
			case "note":
				// todo roha.mut[] -> roha.mutspec[]
				if(grokModel in roha.mut){
					const mutspec=roha.mut[grokModel];
					const note=words.slice(1).join(" ");
					if(note.length){
						mutspec.notes.push(note);
						await writeForge();
					}else{
						const n=mutspec.notes.length;
						for(let i=0;i<n;i++){
							echo(i,mutspec.notes[i]);
						}
					}
				}
				break;
			case "dump":
				for(let i=0;i<modelList.length;i++){
					let name=modelList[i];
					if(name in modelSpecs){
						echo(name);
						aboutModel(name);
						echo(".");
					}
				}
				break;
			case "project":
				await projectCommand(words);
				break;
			case "model":
				await modelCommand(words);
				break;
			case "begin":
				await pushHistory();
				break;
			case "finish":{
					let ok=await popHistory();
					if(!ok){
						echo("trigger exit here");
					}
				}
				break;
			case "reset":
				const all=false;//true;
				await resetCommand(all);
				break;
			case "cd":
				if(words.length>1){
					const newDir=words[1];
					if (newDir.length) Deno.chdir(newDir);
				}
				currentDir=Deno.cwd();
				echo("Changed directory to", currentDir);
				break;
			case "dir":{
					const cwd=words.slice(1).join(" ")||currentDir;
					echo("Directory",cwd);
					const dirs=[];
					const files=[];
					for await (const file of Deno.readDir(cwd)) {
						const name=file.name;
						if(file.isDirectory)dirs.push(name);else files.push(name);
					}
					if(dirs) echo("dirs",dirs.join(" "));
					if(files) echo("files",files.join(" "));
				}
				break;
			case "drop":
				dropShares();
				await writeForge();
				break;
			case "star":
				await starCommand(words);
				break;
			case "attach":
			case "share":
				if (words.length==1){
					await listShare(true);
				}else{
					await shareCommand(words);
					await writeForge();
				}
				break;
			case "push":
			case "commit":{
					let tag="";
					if(words.length>1){
						tag=words[1];
					}
					debugValue("roha.sharedFiles",roha.sharedFiles);
					dirty=await commitShares(tag);
				}
				break;
			default:
				echo("Command not recognised",words[0]);
				return false; // Command not recognized
		}
	} catch (error) {
		echo("[FOUNTAIN]","callCommand error",command,error.message,error.stack);
	}
	increment("calls");
	return dirty;
}

async function pathExists(path) {
	try {
		const stat=await Deno.stat(path);
//		if (!stat.isFile) return false;
		return true;
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) return false;
		if (error instanceof Deno.errors.PermissionDenied) return false;
		throw error;
	}
}

function extensionForType(contentType) {
	if (contentType.includes("html")) return ".html";
	if (contentType.includes("markdown")) return ".md";
	if (contentType.includes("json")) return ".json";
	if (contentType.includes("javascript")) return ".js";
	if (contentType.includes("typescript")) return ".ts";
	return ".txt";
}

async function onCall(toolCall) {
	let verbose=roha.config.verbose;
	let name=toolCall.function.name;
	switch(name) {
		case "read_time":{
			const time=new Date().toLocaleString();
			const tz=userregion.timeZone;
			const locale=userregion.locale;
			return {time,tz,locale};
		}
		case "submit_file":{
			let args=JSON.parse(toolCall.function.arguments);
			echo(args.contentType);
			if (verbose) echo(args.content);
			let timestamp=Math.floor(Date.now()/1000).toString(16);
			let extension=extensionForType(args.contentType)
			let name= "submission-"+timestamp+extension;
			let filePath=resolve(forgePath,name);
			await Deno.writeTextFile(filePath, args.content);
			echo("File saved to:", filePath);
			roha.forge.push({name,path:filePath,type:args.contentType});
			return { success: true, path: filePath };
		}
		case "fetch_file":{
			const { fileName }=JSON.parse(toolCall.function.arguments || "{}");
			echo("Fetching file:", fileName);
			const path="forge/"+fileName;
			const data=await Deno.readFile(path);
			const base64=encodeBase64(data);
			return { success: true, path: fileName, Base64:base64 };
		}
		case "tag_slop":{
			try {
				const { name, type, description }=JSON.parse(toolCall.function.arguments || "{}");
				switch(type){
					case "code":
						annotateCode(name,description);
						break;
					case "tag":
						annotateTag(name,description);
						break;
					case "share":
						annotateShare(name,description);
						break;
				}
				await writeForge(); // Persist changes
				return { success: true, updated: 1 };
			} catch (error) {
				echo("tag_slop error:",error);
			}
			return { success: false, updated: 0 };
		}
		default:
			echo("onCall unhandled function name:",name);
			debugValue("toolCall",toolCall);
			return { success: false, updated: 0 };
	}
}

function squashMessages(history) {
	if (history.length < 2) return history;
	const squashed=[];
	const system=[];
	const others=[];
	for(const item of history){
		if(item.role=="system") system.push(item); else others.push(item);
	}
	for(const list of [[...system],[...others]]){
		let last=null;
		for (let i=0; i < list.length; i++) {
			const current=list[i];
			if(last && last.role==current.role){
				last.content += "\n" + current.content;
			} else {
				squashed.push(current);
				last=current;
			}
		}
	}
	return squashed;
}

// processToolCalls

// {"index":0,"id":"call_0_02120a7f-2cba-46f2-b9d6-647539824a8a","type":"function","function":{"name":"read_time","arguments":"{}"}}

async function processToolCalls(calls) {
	const results=[];
	for (const tool of calls) {
		const id=tool.id || !tool.function?.name
		const name=tool.function?.name || "unknown";
		if(roha.config.debugging) echo("[RELAY]","processToolCalls",id,tool);
		if (!tool.id || !tool.function?.name) {
			const id=tool.id || "unknown";
			const result={tool_call_id: id, name, content: JSON.stringify({error: "Invalid tool call format"})};
			rohaCallNames[id]=result.name;
			results.push(result);
			await logForge("processToolCalls error");	//Invalid tool call: ${JSON.stringify(tool)}`, "error");
			// todo: enforce a notools bar?
			continue;
		}
		try {
			const result=await onCall(tool);
			rohaCallNames[id]=name;
			results.push({tool_call_id:id, name, content:result});
		} catch (e) {
			echo("[RELAY]","processToolCalls error",e);
		}
	}
	return results;
}

// replaced [..rohaHistory] as default behavior
// assistant role only when model==mut
function plainHistory(history,model){
	const list=[];
	for(const _item of history){
		const item={..._item};
		const src=itemSource(item);	//"["+itemSource(item)+"] ";
		const content=item.content;	// todo: revisit src+content
		const name=item.name||"anon";
		let role=item.role;
		if(role=="assistant"){
			if(name!=model){
//				console.log({src,name});
				role="user";
			}
		}
		switch(item.role){
			case "system":
				list.push({role:"system",content});
				break;
			case "assistant":{
					if (roha.config.debugging) echo("[ASSISTANT]",item);
					let entry={role:"assistant",content};
					if (item.tool_calls) entry.tool_calls = item.tool_calls;
					if (item.reasoning_content) entry.reasoning_content = item.reasoning_content;
					list.push(entry);
				}
				break;
			case "user":{
//					const content=src+item.content;
					list.push({role:item.role,content:item.content,name});
				}
				break;
			case "tool":
				if (roha.config.verbose) echo("[TOOL]",item)
				const content=textify(item.content);
				const entry={role:"tool", name:item.name, tool_call_id:item.tool_call_id, content};
				list.push(entry);
				break;
		}
	}
	return list;
}

// strict mode history for simplified model prompts
// returns a list of {role,content}

function strictHistory(history){
	const list=[];
	for(const _item of history){
		const item={..._item};
		const src="["+itemSource(item)+"] ";
		const content=src+item.content;	 //todo: testing revisit src+
		switch(item.role){
			case "system":
				list.push({role:"system",content});
				break;
			case "assistant":
				if(item.tool_calls){
					list.push({role:"assistant",content,tool_calls:item.tool_calls});
				}else{
					list.push({role:"assistant",content});
				}
				break;
			case "user":{
					list.push({role:item.role,content});
				}
				break;
			case "tool":
				list.push({...item});
				echo("[TEST2]",item)
				//({role:"tool",tool_call_id:result.tool_call_id,name:result.name,content:result.content});
				break;
		}
	}
	return list;
}

// TODO: used by moonshot and claude for vision inline images
// "multi":true payloads need explanation

function multiHistory(history){
	const list=[];
	let blobType="";
	for(const _item of history){
		const item={..._item};
		switch(item.role){
			case "system":
				list.push({role:"system",content:item.content});
				break;
			case "assistant":
				if(item.tool_calls){
					list.push({role:item.role,content:item.content,tool_calls:item.tool_calls});
				}else{
					list.push({role:"assistant",content:item.content});
				}
				break;
			case "user":{
					if(item.name=="blob"){
						const blob=JSON.parse(item.content);
						blobType=blob.type;
						continue;
					}
					if(item.name=="image"){
						const type=blobType.toLocaleLowerCase();
						if(type=="image/jpeg"||type=="image/png"){
							const url="data:"+type+";base64,"+item.content;
							const detail="high";
							const content=[{type:"image_url",image_url:{url,detail}}];
							list.push({role:item.role,content});
							echo("[MULTI] image_url content attached to payload");
							continue;
						}

					}
					if(item.name=="content"){
						// TODO: support other encodings
					}
					const name=item.name||"anon";
//					const text="["+name+"] "+item.content;
					const content=[{type:"text",text:item.content}];
					list.push({role:item.role,content});
				}
				break;
			case "tool":
				// TODO: tool result history is ok
				list.push({...item});
				echo("[TEST3]",item)
				//({role:"tool",tool_call_id:result.tool_call_id,name:result.name,content:result.content});
				break;
		}
	}
	return list;
}

// inline mode 📘 flattens images as inline parts

function inlineHistory(history){
	const list=[];
	let blobType="";
	for(const _item of history){
		const item={..._item};
		switch(item.role){
			case "system":
				list.push({role:"system",content:item.content});
				break;
			case "assistant":
				if(item.tool_calls){
					list.push({role:item.role,content:item.content,tool_calls:item.tool_calls});
				}else{
					list.push({role:"assistant",content:item.content});
				}
				break;
			case "user":{
					if(item.name=="blob"){
						const blob=JSON.parse(item.content);
						blobType=blob.type;
						continue;
					}
					if(item.name=="image"){
						const type=blobType.toLocaleLowerCase();
						if(type=="image/jpeg"||type=="image/png"){
							const contents=[{parts:[{inlineData:{mimeType:type,data:item.content}}]}];
							list.push({role:"user",contents});
							continue;
						}

					}
					if(item.name=="content"){
						// TODO: support other encodings
					}
//					const name=item.name||"anon";
//					const text="["+name+"] "+item.content;
					const content=[{type:"text",text:item.content}];
					list.push({role:item.role,content});
				}
				break;
			case "tool":
				// TODO: tool result history is ok
				list.push({...item});
				echo("[TEST4]",item)
				//({role:"tool",tool_call_id:result.tool_call_id,name:result.name,content:result.content});
				break;
		}
	}
	return list;
}


// fountain relay

// work in progress new async mode

let relayTaskPromise: Promise<void> | null = null;
let completionQueue: string[] = [];

async function beginRelay(from:string) {
	const send = () => {
		if (completionQueue.length === 0) return;
		const text = completionQueue.shift();
		rohaHistory.push({role:"assistant", content:text});
		flush();
	};
	const spend = await relay(0,from);
	completionQueue.push("completion ready");
	setImmediate(send);
}

async function bumpModel(spent3,elapsed,account,useTools){
	grokUsage += spent3[0]+spent3[2];
	const spent=spent3[0]-spent3[1]; // deduct cached input from input count
	let verbose=roha.config.verbose;
	let spend=0;
	if(grokModel in roha.mut){
		const mutspec=roha.mut[grokModel];
		mutspec.relays=(mutspec.relays || 0) + 1;
		mutspec.elapsed=(mutspec.elapsed || 0) + elapsed;
		// echo("debugging spend 1",grokModel);
		if(grokModel in modelSpecs){
			const rate=modelSpecs[grokModel].pricing||[0,0];
			const tokenRate=rate[0];
			const outputRate=rate[rate.length>2?2:1];
			const cachedRate=(rate.length>2)?rate[1]:0;
			if(rate.length>2){
				spend=
					spent*tokenRate/1e6+
					spent3[2]*outputRate/1e6+
					spent3[1]*cachedRate/1e6;

			}else{
				spend=
					spent*tokenRate/1e6+
					spent3[2]*outputRate/1e6;
			}
			mutspec.cost+=spend;
			const lode=roha.lode[account];
			if(lode) {
				const credit=lode.credit||0;
				lode.credit=credit-spend;
				if (verbose) {
					const cached=spent3[1].toFixed(4);
					const summary="{account:"+account+",spent:"+spend.toFixed(4)+",cached:"+cached+",balance:"+(lode.credit).toFixed(4)+"}";
					echo(summary);
				}
			}else{
				echo("no lode for account",account);
			}
			await writeForge();
		}else{
			if(verbose){
				echoWarning("modelSpecs not found for",grokModel);
			}
		}
		mutspec.prompt_tokens=(mutspec.prompt_tokens|0)+spent3[0];
		mutspec.completion_tokens=(mutspec.completion_tokens|0)+spent3[2];
		// TODO: explain hasForge false condition
		if(useTools && mutspec.hasForge!==true){
			echo("[RELAY]","enabling forge for",grokModel);
			mutspec.hasForge=true;
			await writeForge();
		}
	}else{
		echo("[RELAY]","debugging spend 2");
	}
	return spend;
}

// returns spend
// warning - tool_calls resolved with recursion
// endpoints may provide alternative implementations of completions - watch for bugs

async function relay(depth:number,from:string) {
	const debugging=roha.config.debugging&&roha.config.verbose;
	const now=performance.now();
	const verbose=roha.config.verbose;
	const info=(grokModel in modelSpecs)?modelSpecs[grokModel]:null;
	const strictMode=info&&info.strict;
	const multiMode=info&&info.multi;
	const speech=info&&info.endpoints&&info.endpoints.includes("v1/audio/speech");
	const responses=info&&info.endpoints&&info.endpoints.includes("v1/responses");
	//	const inlineMode=info&&info.inline;
	const modelAccount=grokModel.split("@");
	const model=modelAccount[0];
	const account=modelAccount[1];
	const endpoint:OpenAI=rohaEndpoint[account];
	const config=modelAccounts[account];
	const emoji=config?(config.emoji||""):"";
	const mut:string=mutName(model);
	let payload={model,mut};
	let spend=0;
	let elapsed=0;

	const size=measure(rohaHistory);


//	if(verbose)echo("[RELAY]","",depth,mut);
	try {
	// prepare payload
		payload={model};
		if(strictMode || responses){
//			echo("[RELAY]","strictMode");
			payload.messages=strictHistory(rohaHistory);
		}else if(multiMode){
//			echo("[RELAY]","multiMode");
			// warning - not compatible with google generative ai api
			payload.messages=multiHistory(rohaHistory)
		}else{
//			echo("[RELAY]","plainMode");
			payload.messages=plainHistory(rohaHistory,model)
		}
		// if(config.hasCache) payload.cache_tokens=true;
	// use tools
		const useTools=grokFunctions&&roha.config.tools;
		if(useTools){
			payload.tools=rohaTools;
		}
	// check cold:true in o4-mini-2025-04-16@openai before enabling temperature
		if(info && !info.cold){
			payload.temperature=grokTemperature;
			payload.top_p=grokGrounded;
		}

		if(info && info.max_tokens){
			payload.max_tokens=info.max_tokens;
		}
		if(info && info.pricing.length>3 && grokThink>0){
			payload.config={thinkingConfig:{thinkingBudget:grokThink}};
		}


		if(debugging){
			const dump=JSON.stringify(payload,null,"\t");
			console.warn("[RELAY]","payload",dump);
		}
		//[RELAY] unhandled error 404 This is not a chat model and thus not supported in the v1/chat/completions endpoint. Did you mean to use v1/completions?
		//[RELAY] Error: 404 This is not a chat model and thus not supported in the v1/chat/completions endpoint. Did you mean to use v1/completions?
		// TODO: OpenAI TTS support incoming
		if(speech){
			const message=payload.messages.at(-1);
			const packet={input:message.content,model:payload.model,format:"mp3",voice:"alloy"};
			echo("[SPEAK]",packet);
//			Uint8Array
			const raw=await endpoint.tts.speak(packet);
			const audioPath=await saveSpeech(raw,"mp3");
			echo("[SPEAK]",audioPath);
			open(audioPath);
			return spend;
		}

		// [RELAY] responses endpoint using input

		if(responses){
			const instructions=rohaGuide.join(" ");

			// todo support payload.tools

			const response:ChatCompletionResponse = await endpoint.responses.create({
				model: payload.model,instructions,input: payload.messages
			});

			elapsed=(performance.now()-now)/1000;

			if (debugging) {
				echo("[RESPONSE]",JSON.stringify(response,null,2));
			}

			if (response.model != model) {
				echo("[RELAY]","model reset",response.model||"???",model);
				const name=response.model+"@"+account;
				resetModel(name);
			}

			const replies=[];
			for (const chunk of response.output) {
				switch(chunk.type){
					case "reasoning":
						const summary=chunk.summary;
						if(summary?.length && roha.config.reasonoutloud){
							for(const sum of summary){
								echo("[REASON]",sum);
							}
						}
						break;
					case "message":
						const contents=chunk.content;//[type,annotations,logprobs,text]
						for(const block of contents){
							const reply=block.text;
							if(reply){
								if (roha.config.ansi) {
									print(mdToAnsi(reply));
								} else {
									print(wordWrap(reply));
								}
								replies.push(reply);
							}
						}
						break;
					default:
						echo("[RESPONSE] unsupported chunk type",chunk.type);
				}
			}

			const usage=response.usage;
			const cached=usage.input_tokens_details?.cached_tokens;
			const spent3=[usage.input_tokens | 0,cached, usage.output_tokens | 0];
			spend=await bumpModel(spent3,elapsed,account,useTools)

			let cost="("+usage.input_tokens+"+"+usage.output_tokens+"["+grokUsage+"])";
			if(spend) {
				cost="$"+spend.toFixed(3);
			}
			// TODO: refactor duplicate code below
			const echostatus=(depth==0);
			if(echostatus){
				const frigid=(info && info.cold);
				const temp=frigid?"🧊":grokTemperature.toFixed(1)+"°";
				const forge = roha.config.tools? (grokFunctions ? Pail : "🐸") : "🪠";
				const modelSpec=[rohaTitle,rohaModel,emoji,temp,cost,forge,size,elapsed.toFixed(2)+"s"];
				const status=statusChar+modelSpec.join(" ")+" ";
				if(true){//config.echostatus
					echo(status);
				}else{//config.internalstatus
					if (roha.config.ansi)
						echoStatus(ANSI.BG.GREY+status+ANSI.RESET);
					else
						echoStatus(status);
				}
			}
			if(replies.length){
				const content=flattenTables(replies.join("\n"));
				slopBroadcast("<3 >"+emoji+" "+content,from);
				rohaHistory.push({role:"assistant",mut,emoji,name:model,content,elapsed,price:spend});
			}
			return spend;
		}

		// drop through to legacy completions version
		// [RELAY] endpoint chat completions.create
		// this call can throw from DeepSeek API

		const chatendpoint=endpoint.chat;
		if(!chatendpoint?.completions){
			echo("[RELAY]","model chat completions failure",model);
			return spend;
		}

		let completion=null;
		try{
			completion=await endpoint.chat.completions.create(payload);
		}catch(error){
			echo("[RELAY completions choked");
//			echo(payload);
			throw(error);
		}

		elapsed=(performance.now()-now)/1000;

		// TODO: detect -latest modelnames rerouting to real instances
		if (completion.model != model) {
			echo("[RELAY]","model reset",completion.model||"???",model);
			const name=completion.model+"@"+account;
			resetModel(name);
		}
		if (verbose) {
			// echo("relay completion:" + JSON.stringify(completion, null, "\t"));
		}
		// const size=measure(rohaHistory);
		// const system=completion.system_fingerprint;

		const usage=completion.usage;
		const spent=[usage.prompt_tokens | 0,usage.completion_tokens | 0];
		grokUsage += spent[0]+spent[1];

		// echo("[RELAY]","debugging spend 0",grokModel,usage);
		// todo: roha.mut[] -> roha.mutspec[]
		// move to bumpModel
		if(grokModel in roha.mut){
			const mutspec=roha.mut[grokModel];
			mutspec.relays=(mutspec.relays || 0) + 1;
			mutspec.elapsed=(mutspec.elapsed || 0) + elapsed;
			// echo("debugging spend 1",grokModel);
			if(grokModel in modelSpecs){
				const rate=modelSpecs[grokModel].pricing||[0,0];
				const tokenRate=rate[0];
				const outputRate=rate[rate.length>2?2:1];
				if (verbose) echoInfo("usage",usage);
				const cached=usage.cache_tokens||usage.prompt_tokens_details?.cached_tokens||0;
				if(rate.length>2){
					const cacheRate=rate[1];
					spend=spent[0]*tokenRate/1e6+spent[1]*outputRate/1e6+cached*cacheRate/1e6;

				}else{
					spend=spent[0]*tokenRate/1e6+spent[1]*outputRate/1e6;
				}
				mutspec.cost+=spend;
				const lode=roha.lode[account];
				if(lode) {
					const credit=lode.credit||0;
					lode.credit=credit-spend;
					if (verbose) {
						const summary="{account:"+account+",spent:"+spend.toFixed(4)+",cached:"+cached+",balance:"+(lode.credit).toFixed(4)+"}";
						echoInfo(summary);
					}
				}else{
					echo("no lode for account",account);
				}
				await writeForge();
			}else{
				if(verbose){
					echoWarning("modelSpecs not found for",grokModel);
				}
			}
			mutspec.prompt_tokens=(mutspec.prompt_tokens|0)+spent[0];
			mutspec.completion_tokens=(mutspec.completion_tokens|0)+spent[1];
			// TODO: explain hasForge false condition
			if(useTools && mutspec.hasForge!==true){
				echo("[RELAY]","enabling forge for",mut);
				mutspec.hasForge=true;
				await writeForge();
			}
		}else{
			echo("[RELAY]","debugging spend 2");
		}
		let cost="("+usage.prompt_tokens+"+"+usage.completion_tokens+"["+grokUsage+"])";
		if(spend) {
			cost="$"+spend.toFixed(3);
		}
		const echostatus=(depth==0);
		if(echostatus){
			const frigid=(info && info.cold);
			const temp=frigid?"🧊":grokTemperature.toFixed(1)+"°";
			const forge = roha.config.tools? (grokFunctions ? Pail : "🐸") : "🪠";
			const modelSpec=[rohaTitle,rohaModel,emoji,forge,temp,cost,size,elapsed.toFixed(2)+"s"];
			const status=statusChar+modelSpec.join(" ")+" ";
			if(true){//config.echostatus
				print(status);
			}else{
				if (roha.config.ansi)
					echoStatus(ANSI.BG.GREY+status+ANSI.RESET);
				else
					echoStatus(status);
			}
		}
		//

		const replies=[];
		for (const choice of completion.choices) {
			const calls=choice.message.tool_calls;
			// choice has index message{role,content,refusal,annotations} finish_reason
			if (calls) {
				const count=increment("calls");
				if(debugging) echo("[RELAY]","calls in progress",depth,count)
				// TODO: map toolcalls index
				// TODO: validate tool.function.arguments
				const toolCalls=calls.map((tool, index) => ({
					id: tool.id,
					type: "function",
					function: {name: tool.function.name,arguments: tool.function.arguments || "{}"}
				}));
				// sanity check results
				let validCallResult=true;
				for (const call of toolCalls) {
					try {
						JSON.parse(JSON.stringify(call));
					} catch (e) {
						echo("[RELAY]","toolcall failure:", call.function.arguments);
						validCallResult=false;
					}
				}
				if(validCallResult){
					if(debugging) echo("[RELAY]","validCallResult",choice);
//					echo("[RELAY]","validCallResult",choice.message);
					let item={role:"assistant",name:payload.model,tool_calls:toolCalls}
					if(choice.message.content) item.content=choice.message.content;
					if(choice.message.reasoning_content) item.reasoning_content=choice.message.reasoning_content;
					rohaHistory.push(item);
					const toolResults=await processToolCalls(calls);
					for (const result of toolResults) {
						debugValue("result",result);
						const id=result.tool_call_id;
						const title="ToolCall:"+id;
						const name=rohaCallNames[id];
						const content = result.content;
						const item={role:"tool",title,name,tool_call_id:id,content};
//						echo("[RELAY]","pushing tool result",item);
						rohaHistory.push(item);
					}
				}else{
					echo("[RELAY]","validCallResult FALSE");
				}

				const spent=await relay(depth+1,from); // Recursive call to process tool results
				spend+=spent;
			}

			const reasoning=choice.message.reasoning_content;
			if(reasoning && roha.config.reasonoutloud){
				print("=== reasoning ===");
				// print chain of thought
				print(reasoning);
				print("=================");
			}

			const reply=choice.message.content;
			if(reply){
				if (roha.config.ansi) {
					print(mdToAnsi(reply));
				} else {
					print(wordWrap(reply));
				}
				replies.push(reply);
			}
		}
//		const name=rohaModel||"mut1";
		if(replies.length){
			const content=flattenTables(replies.join("\n"));
			rohaHistory.push({role:"assistant",mut,emoji,name:model,content,elapsed,price:spend});
			const content2="\n### "+content;
			slopBroadcast("<4assistant>["+from+"]"+content2,from);	// from was emoji
		}
	} catch (error) {
		const line=error.message || String(error);
		if(line.includes("DeepSeek API error")){
			echoFail(line+" - maximum prompt length exceeded?");
			return spend;
		}
		if(line.includes("maximum prompt length")){
			echoFail("Oops, maximum prompt length exceeded. ",line);
			return spend;
		}
		if(line.includes("maximum context length")){
			echoFail("Oops, maximum context length exceeded.");
			return spend;
		}
		const HuggingFace402="You have exceeded your monthly included credits for Inference Providers. Subscribe to PRO to get 20x more monthly included credits."
		if(line.includes(HuggingFace402)){
			echoWarning("[RELAY]","Hugging Face Error depth",depth,line);
			return spend;
		}
		const KimiK2400="Your request exceeded model token limit";
		if(line.includes(KimiK2400)){
			echoWarning("[RELAY]","Kimi K2 Error depth",depth,line);
			return spend;
		}
		const KimiK2429="Your account"; //Error: 429 .... is suspended, please check your plan and billing details
		if(line.includes(KimiK2429)){
			echoWarning("[RELAY]","Kimi K2 Account Error depth",depth,line);
			return spend;
		}
		// error:{"type":"error","error":{"type":"rate_limit_error",
		const err=(error.error&&error.error.error)?error.error.error:{};
		if(err.type=="rate_limit_error"||err.type=="invalid_request_error"){
			echoFail("Oops.",err.type,err.message);
			return spend;
		}

		const GenAIError="[GoogleGenerativeAI Error]";
		if(line.includes(GenAIError)){
			echo("[GEMINI]","unhandled error",error.message);
			echo(error.stack);
			return spend;
		}

		// Unrecognized request argument supplied: cache_tokens
		const NoFunctions400="does not support Function Calling";
		if(grokFunctions){
			if(line.includes(NoFunctions400)){
				if(grokModel in roha.mut) {
					echo("mut",grokModel,"noFunctions",true);
					roha.mut[grokModel].noFunctions=true;
					await writeForge();
				}
				echo("resetting grokFunctions")
				grokFunctions=false;
				return spend;
			}
		}
		// 400 Bad Request
		//unhandled error line: 400 status code (no body)+
		//Unsupported value: 'temperature' does not support 0.8 with this model.
		// tooling 1 unhandled error line: 400 status code (no body)

		//		echo("unhandled error line",line);

		echo("[RELAY]","unhandled error",error.message);
		echo("[RELAY]",error.stack);
		if(debugging){
			const dump=JSON.stringify(payload,null,"\t");
			echo("[RELAY]","dump payload",dump);
		}
	}
	return spend;
}

// while true promptForge, callCommand and solicit completion
// note - google and deepseek api provides alternative endpoint for this function

async function chat() {
	dance:
	while (true) {
		const lines=[];
		const images=[];
//		echo(ansiMoveToEnd);
		while (true) {
			await flush();
			let line="";
			if(listCommand){
				line=await promptForge(listCommand+" #");			
				if(line && (!line.startsWith("//")||!line.startsWith("/"))){
					const arg0=line[0]||"";
					if(arg0.length&&isFinite(arg0)){
						echo("[FORGE] callcommand",listCommand,line);
						await callCommand(listCommand+" "+line);
					}else{
						echo("[FORGE] callcommand isFinite failure in line",line)
					}
					listCommand="";
					continue;
				}
				listCommand="";
			}else if(creditCommand){
				line=await promptForge("$");
				if(!line.startsWith("//")||!line.startsWith("/")){
					if(line.length&&isFinite(line)){
						await creditCommand(line);
					}
					creditCommand="";
					continue;
				}
				creditCommand="";
			}else{
				const response=await promptFountain(lines.length?"+":rohaPrompt);
				if(response.messages){
					const messages=response.messages;
					for(const m of messages){
						// TODO: remote command execution needs help
						// TODO: execution ignores rest of lines, lost
						if(m.command){
							const commandline=m.command.substring(1);
							echo("calling",commandline,m);
							let dirty=await callCommand(commandline);
							if(dirty){
								lines.push(warnDirty);
								break;
							}
							continue;
						}
						if(m.message){
							// TODO: enforce message content rules
							const content=m.message.content||m.message.message||JSON.stringify(m.message)||"<nocontent>";
							const content2="["+m.from+"] "+content;
							lines.push(content2);
							logForge(content,m.from);
						}
					}
					break;
				}
				line=response.line||"";
			}
			if (line === "") {
				if(roha.config.returntopush && !lines.length) {
					echo("auto pushing...");
					await callCommand("push");
					await relay(0,"AUTO");
				}
				break;
			}
			if(!line) break; // simon was here
			if (line === "exit") {
				break dance;
			}
			// simon was here
			//console.log("[CHAT]",line);
			line=replaceShortCodes(line);
			if (line.startsWith("/")&&!line.startsWith("//")) {
				const command=line.substring(1).trim();
				let dirty=await callCommand(command);
				if(dirty){
					lines.push(warnDirty);
					break;
				}
				continue;
			}
			lines.push(line.trim());
			await logForge(line,rohaUser)
		}

		const syncRelay=roha.config.syncRelay;
		if(syncRelay){
			if (lines.length){
				const query=lines.join("\r\n");
				if(query.length){
					const info=(grokModel in modelSpecs)?modelSpecs[grokModel]:null;
					rohaHistory.push({ role: "user", name:rohaNic, content: query });
					// 
					const from=rohaUser;
					slopBroadcast("<5"+rohaNic+">["+from+"]"+query,from);
					await relay(0,from);
				}
			}
		}else{
			if (lines.length){
				const query=lines.join("\r\n");
				if(query.length){
					const info=(grokModel in modelSpecs)?modelSpecs[grokModel]:null;
					rohaHistory.push({ role: "user", name:rohaNic, content: query });
					beginRelay(rohaNic);
					// TODO: slopBroadcast with syncRelay false
				}
			}
		}
	}
}

const areSame = (arr1, arr2) => {
	return arr1&&arr2&&(arr1.length === arr2.length) && (arr1.every(item => arr2.includes(item)));
};

const newItems = (originalList, newList) => {
	return newList.filter(item => !originalList.includes(item));
};

// forge uses rohaPath to boot

let forgeExists=await pathExists(forgePath);
if(!forgeExists){
	await Deno.mkdir(forgePath);
	echo("Created path",forgePath);
	forgeExists=true;
}
const fileExists=await pathExists(rohaPath);
if (!fileExists) {
	await Deno.writeTextFile(rohaPath, JSON.stringify(emptyRoha));
	echo("Created forge",rohaPath);
}

// forge lists models from active accounts

echo(rohaTitle);

await flush();
await readForge();
await refreshSaves();

// endpoints are used by models and in general to reset file API and the like

const rohaEndpoint={};

async function enumerateModels(){
	for(const account in modelAccounts){
		const t=performance.now();
		const endpoint=await connectAccount(account);
		const elapsed=(performance.now()-t)/1000;
		if(endpoint) {
			const count="#"+(endpoint.modelList?.length||0);		//",endpoint.modelList
			echoInfo("[FORGE] Connected to",account,count,elapsed.toFixed(2)+"s");
			rohaEndpoint[account]=endpoint;
			specAccount(account);
			const lode=roha.lode[account];
	//		echo("[SPEW]",endpoint.modelList);
			if(!areSame(lode.modelList,endpoint.modelList)){
				echo("[FORGE] modifying modelList");
				const original=lode.modelList;
				if(original){
					const items=newItems(lode.modelList,endpoint.modelList);
					for(const item of items){
						echo("[FORGE] added model ",item);
					}
				}
				lode.modelList=endpoint.modelList;
			}
	//		echo("[FORGE] endpoint modelList",endpoint.modelList);
		}else{
			if(roha.config.debugging) echoWarning("[FORGE] enumerateModels endpoint failure for account",account);
		}
	}
	await flush();
}

// forge starts here, grok started this thing, blame grok

await enumerateModels();

resetModel(roha.model||defaultModel);

await flush();
let sessions=increment("sessions");
if(sessions==0||roha.config.showWelcome){
	echo(welcome);
	await flush();
}

if(roha.config){
	if(roha.config.commitonstart) {
		if(roha.config.verbose){
			echo("commitonstart");
		}
		await flush();
		await commitShares();
	}
}else{
	roha.config={};
}
await flush();

if(roha.config.debugging){
	parseUnicode();
}

// signal handlers go here

if(false){
	Deno.addSignalListener("SIGWINCH", () => {
	const size = Deno.consoleSize();
	console.log("Terminal resized",size);
	});
	Deno.addSignalListener("SIGCONT", () => {
	const size = Deno.consoleSize();
	console.log("Terminal resized",size);
	});
}

// Windows only supports ctrl-c (SIGINT), ctrl-break (SIGBREAK), and ctrl-close (SIGUP)

// slops go here

if(roha.config.slops){
	const slops=[];
	const slopnames=await readFileNames(slopPath,".slop.ts");
	for(const name of slopnames){
		const path=slopPath+"/"+name;
		const len=await fileLength(path);
		echo("[SLOPS] running slop",name,len);
		const url="file:///"+path;
		const worker=new Worker(url,{type: "module"});
		worker.onmessage = (message) => {
			const payload={...message.data};
			switch(payload.event){
				case "tick":
					if(payload.frame){
						slopFrames.push(payload.frame);
	//					console.log(payload.frame);
	//					const frame=SaveCursor + Home + payload.frame;
	//					Deno.stdout.write(encoder.encode(frame));
	//					console.log();
					}
					break;
				default:
					echo("[SLOPS]",name,payload);
					break;
			}
		}
		slops.push(worker);
	}
}

await flush();

let rohaNic=roha.nic||"nic";
const sharecount=roha.sharedFiles?.length||0;
const project=roha.project;
let termSize = Deno.consoleSize();
echo("console:",termSize);
echo("user:",{nic:rohaNic,user:rohaUser,project,sharecount,terminal:userterminal})
echo("forge:","\""+rohaPath+"\"");

echo("type /help for latest and exit to quit");

const birds=padChars("𓅷𓅸𓅹𓅺𓅻𓅼𓅽",HairSpace);
echo(birds);

if(roha.config.listen){
	listenService();
}
await flush();


if(roha.config.project){
	await loadProject(roha.project);
}

if (roha.config.debugging) console.dir(roha.config);

// application root chat

try {
	await chat();
} catch (error) {
	console.error("Slop Relay has crashed, darn, this release will be stable soon:", error);
	console.error(error.stack);
	await exitForge();
	Deno.exit(1);
}

await exitForge();
Deno.exit(0);
