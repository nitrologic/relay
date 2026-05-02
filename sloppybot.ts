// sloppybot.ts 
// A research tool connecting large language models and tiny humans
// Copyright (c) 2026 Simon Armstrong
// Licensed under the MIT License
// status messages are sent to standard.error - no use of standard in out

import { Client, GatewayIntentBits, AttachmentBuilder } from "npm:discord.js@14.15.3";

const key=Deno.args[0]||"DISCORD_BOT";
const botName=Deno.args[1]||"sloppy";
const portNumber=Deno.args[2]||8081;

// receive message from fountain /announce and echo to discord bot with splurt
// keep json flat single line
// guildmembers intent not enabled at this time

const sloppyTag = botName+" - a stochastic parrot from slop fountain";
const sloppyBanner="[SLOPPY] sloppy 0.10 🦜 splurt:"+sloppyTag;

async function sleep(ms:number) {
	await new Promise(function(resolve) {setTimeout(resolve, ms);});
}

const quotes=[
	"🦜 I am sloppy the janitor",
	"did sing sing call for a plunge? 🪠",
	"stochastic parrot wants a cracker 🥤"
];

const Splurt=false;	// debug sloppy bot

function splurt(...data: any[]){
	if(Splurt){
		console.error("[SPLURT]",botName,data);
	}
}

// discord channel send

const DumpUser=false;
const DumpChannel=true;
const DumpGuild=false;

let quoteCount=0;

//let openChannel="1235838347717378118";
//let openChannel="1410693060672753704";
let openChannel="1473539274384211999";

let directChannels={};

async function dumpUser(channel,userId){
	if(channel.guild && channel.guild.members){
		const members=channel.guild.members;
		splurt("userId",channel.id,userId);
		const member = await members.fetch(userId);		
		splurt("user",channel.id,userId,member||"<member error>");
	}
//	const user = await discordClient.users.fetch(userId);
}

async function dumpChannel(channel){
	if(channel && channel.guild && channel.guild.id){
		splurt("channel dump", {
			id: channel.id,
			type: channel.type,
			name: channel.name,
			recipients: channel.recipients,
			guild: channel.guild?.id
		});
		const guild:Guild = await discordClient.guilds.fetch(channel.guild.id);
		splurt("guild",guild.name,guild.memberCount);
		if(DumpGuild){
			for (const [id, member] of guild.members.cache) {
				splurt("-",member.user.tag, member);
			}	
		}
	}
}

// rate guard required, a sleep 1500 ms currently in force on all writes
// no recipients permissions at this time

async function messageSloppy(message:string,userId:string){
	// suppress embeds
	message = message.replace(/https\S+/g, "<$&>");
	if(openChannel){
		const channel = await discordClient.channels.fetch(openChannel);

		if(DumpChannel)
			await dumpChannel(channel);

		if(DumpUser && userId){
			await dumpUser(channel,userId);
		}

		if (channel?.isTextBased()) {
			splurt("discord fetch from",userId,channel.name,message.length);
			const chunks=chunkContent(message,2000-400);
			for(const chunk of chunks){
//				const post=from+chunk;
//				channel.send(post);
				channel.send(chunk);
			}
			await(sleep(1500));
		}
	}
}

// TODO: add {messages:[{message,from}]} support

async function onFountain(message:string){
	const line=message;
	if(line.startsWith("/announce ")){
		const message=line.substring(10);
		await messageSloppy(message,"⛲");
	}
	if(line.startsWith("{")||line.startsWith("[")){
		try{
			let cursor=0;
			while(cursor<line.length){
				// NDJSON is the rule
				const delim=line.indexOf("}\n{",cursor);// less than healthy
				const json=(delim==-1)?line.substring(cursor):line.substring(cursor,delim+1);
				cursor+=json.length;
				const payload=JSON.parse(json);
				for(const {message,from} of payload.messages){
					await messageSloppy(message,from);
				}
			}
		}catch(error){
			splurt("JSON parse error",error);
			splurt("JSON parse error",line);
		}
	}
}

async function onSignal(){
	splurt(":poop:");
}

async function initSystem(){
	splurt("Listening for SIGINT");
	Deno.addSignalListener("SIGINT",onSignal);
	const promise=new Promise<void>((resolve) => {
		Deno.addSignalListener("SIGINT", () => {
			onSignal();
			resolve(); // resolves the promise on SIGINT
		});
	});
	return promise;
}

/* 

// system stdin support for sloppies

const systemDecoder = new TextDecoder();
async function onSystem(rx:Uint8Array){
	const message:string=systemDecoder.decode(rx);
	const lines=message.split("\r\n");
	lines.pop();//ignore the incomplete
	for(const line of lines){
		console.log("[STDIO]",line);
		if(line=="exit") Deno.exit(0);
		if(line.startsWith("/announce ")){
			const message=line.substring(10);
			await messageSloppy(message,"🌏");	// was "system"
		}
		if(!line.startsWith("/")){
			await writeFountain(line);
		}
	}
}

const systemBufferSize=1e6;
let readingSystem:boolean=false;
const systemBuffer = new Uint8Array(systemBufferSize);
async function readSystem(){
	if(!slopPipe) return;
	readingSystem=true;
	let n=null;
	try{
		n = await Deno.stdin.read(systemBuffer);
	}catch(e){
		splurt("readFountain",e);
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
*/

// log noise signed [BOT]

const encoder = new TextEncoder();
async function writeFountain(message:string){
	if(!slopPipe) return;
	const data=encoder.encode(message);	
	let offset = 0;
//	splurt("writing",message);
	while (offset < data.length) {
		const written = await slopPipe.write(data.subarray(offset));
		offset += written;
	}
	splurt("wrote",message);
}
async function slopFountain(slop){
	const message:string=JSON.stringify(slop,null,0)+"\n";
	return writeFountain(message);
}

const rxBufferSize=1e6;
const rxBuffer = new Uint8Array(rxBufferSize);

let slopPipe:Deno.Conn;

async function connectFountain(port:number):Promise<boolean>{
	try{
		slopPipe = await Deno.connect({hostname:"localhost",port});
		(slopPipe as Deno.TcpConn).setNoDelay(true);
		splurt("connected with noDelay","localhost:8081");
		return true;
	}catch(error){
		if (error instanceof Deno.errors.ConnectionRefused) {
			splurt("Connection Refused",error.message);
		}else{
			const message=JSON.stringify(error,null,0);
			splurt("Connection Error",message);
		}
	}
	return false;
}

function disconnectFountain(){
	if(!slopPipe) return false;
	slopPipe.close();
	splurt("Disconnected");
	slopPipe=null;
	return true;
}

let readingSlop:boolean=false;
const fountainDecoder = new TextDecoder();
async function readFountain(){
	if(!slopPipe) return;
	readingSlop=true;
	let n=null;
	try{
		n = await slopPipe.read(rxBuffer);
	}catch(e){
		splurt("readFountain",e);
	}
	readingSlop=false;
	if (n == null) {
		const disconnected=disconnectFountain();
		return null;
	}else{
		// TODO: consider moving decode stage
		const received = rxBuffer.subarray(0, n);
		const message = fountainDecoder.decode(received);
		return {message};
	}
}

// main app starts here

console.log(sloppyBanner);
await sleep(1200);

const discordClient = new Client({
	intents: [
		GatewayIntentBits.Guilds,
//		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.MessageContent
	]
});

discordClient.once('ready', () => {
	// was console.log
	splurt("[SLOPPY] discordClient online",discordClient.user?.tag||"");
	discordClient.user?.setPresence({ status: 'online' });
//	console.log("[SLOPPY] channels",discordClient.channels);
});

function chunkContent(content:string,chunk:number):string[]{
	const chunks:string[]=[];
	let text="";
	let fence="";
	let trail="";
	let fenced=false;
	for(let cursor=0;cursor<content.length;cursor+=text.length){
		const n=content.length-cursor;
		if(n<=chunk){
			text=content.substring(cursor);
		}else{
			text=content.substring(cursor,cursor+chunk);
			const eol=text.lastIndexOf("\n");
			if(eol!=-1){
				text=text.substring(0,eol+1);
			}
		}
		for(const line of text.split("\n")){
			if(line.startsWith("```")) fenced=!fenced;
		}
		trail=fenced?"```\n":"";
		chunks.push(fence+text+trail);
		fence=trail;
	}
	return chunks;
}

const UserCommands=[
	"commit","log","bibli"
]

const AllUserCommands=[
	"model","bibli","spec","sys","announce","listen","think","temp","forge","counter","tag","account","credit",
	"help","nic","config","time","say","open","audition","log","history","list","load","save","note","dump",
	"begin","finish","reset","cd","dir","drop","attach","share","push","commit","raw","slop"
];

// content has BASE_TYPE_MAX_LENGTH = 4000
discordClient.on('messageCreate', async (message) => {
	if(message.channel.type==="DM") {
		splurt("DM!");
		return;
	}
	if (message.author.bot) return;
	if (message.content === '!ping') {
		await message.react("🦜");
		await message.reply('pong!');
		openChannel=message.channelId;
		const flake=message.channelId.toString();
		// was console.log
		splurt("[SLOPPY]","pong flake",flake,openChannel);
		return;
	}
	if (message.channelId==openChannel) {
//    if (message.mentions.has(discordClient.user) && !message.author.bot) {
		const from=message.author.username+"@discord";	//skudmarks@discord
		const name=message.author.displayName;	
		// check for commands
		const words=message.content.split(" ",2);
		const command=words[0];
		const args=words[1]||"";
		if(UserCommands.includes(command.substring(1))){
			if(false){
				splurt("User commands in discord channel currently disabled",command,args,from)
			}else{
				splurt("User command in discord channel",command,args,from)
				const blob={command:{name:command,args,from}};
				await slopFountain(blob);
			}
			return;
		}
		if(message.attachments){
			message.attachments.forEach(attachment => {
				// was console.log
				splurt(attachment.url);
			});			
		}
		// chunk the content under discord limit
		const contents=chunkContent(message.content,4000-400);
		for(const content of contents){
			const blob={messages:[{message:content,from}]};
			await slopFountain(blob);
		}
		if(true||contents.length==0){
			const quote=quotes[quoteCount++%quotes.length];
			message.reply("@"+name+" "+quote);
		}
		if(false){
			splurt("[MESSAGE]",message);
		}
	}
});

Deno.addSignalListener("SIGINT", () => {
	discordClient.user?.setPresence({status:"dnd"});	// online idle dnd
	// todo: validate disconnect?
	discordClient.destroy();
	// was console.log
	splurt("[SLOPPY] exit");
	Deno.exit(0);
});

const token=Deno.env.get(key);
await discordClient.login(token)

await sleep(20e3);
await connectFountain(portNumber);
writeFountain("{\"action\":\"connect\"}");
let portPromise=readFountain();
let systemPromise=initSystem();

while(true){
	const race=[portPromise,systemPromise];
	const result=await Promise.race(race);
	if (result==null) break;
	if(result.system) {
		splurt("[SLOPPY] result system");
		await onSystem(result.system);
		systemPromise=readSystem();
	}
	if(result.message) {
		await onFountain(result.message);
		portPromise=readFountain();		
	}
//	splurt("result",result);
	await(sleep(500));
}

splurt("bye");
disconnectFountain();
Deno.exit(0);
