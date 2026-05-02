// sloppypipe.ts - a socket server for Slop Fountain
// Copyright (c) 2025 Simon Armstrong

// Licensed under the MIT License - See LICENSE file

import {onSystem,readSystem,readFountain,writeFountain,disconnectFountain,connectFountain} from "./sloppyutils.ts";

const sloppypipeName="SloppyPipe";
const sloppypipeVersion="1.2.1";

const sockPath="/tmp/sloppy.sock";

const appDetails=sloppypipeName+" "+sloppypipeVersion+" @ "+sockPath;
const greetings=["Welcome to",sloppypipeName,sloppypipeVersion].join(" ");
const notice="type exit to quit";


console.log(appDetails);

async function readStream(connection) {
	const rid=connection.rid;
	const decoder = new TextDecoder();
	const session = connections[rid];
	if (!session) return;
	const buffer = new Uint8Array(1024);
	try {
		while (true) {
			const n = await connection.read(buffer);
			if (n === null) break; // EOF
			const text = decoder.decode(buffer.subarray(0, n));
			const lines = text.split('\n');
			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed === 'exit') {
					await session.print('SloppyPipe Closed\r\n');
					delete connections[rid];
					return;
				}
				if (trimmed.length) {
					const blob = {messages: [{message: trimmed, from: 'pipe:' + rid}]};
					await writeFountain(JSON.stringify(blob) + '\n');
				}
			}
		}
	} catch (err) {
		console.error('Stream error:', err);
	} finally {
		delete connections[rid];
	}
}

class SocketSession{
	constructor(conn){
		this.encoder=new TextEncoder();
		this.connection=conn;
	}
	async read(){
		const connection=this.connection;
		return readStream(connection);
	}
	async print(text:string){
		const bytes=this.encoder.encode(text);
		// TODO: check partial writes
		await this.connection.write(bytes);
	}
};

const connections: Record<string, SocketSession> = {};

let slopPail:unknown[]=[];
let connectionCount=0;
let sessionCount=0;
let connectionClosed=0;

async function sleep(ms:number) {
	await new Promise(function(resolve) {setTimeout(resolve,ms);});
}

async function writeSloppy(message:string,from:string){
	const text="["+from+"] "+message+"\r\n";
	for(const key of Object.keys(connections)){
		const session=connections[key];
		await session.print(text);
	}
}

export async function onFountainPipe(message:string){
	const blob=JSON.parse(message);
	for(const message of blob.messages){
		const line=message.message||message.content||"[BLANK]";
		const from=message.from;
		console.log("["+from+"] "+line);
		await writeSloppy(line, from);
	}
}

async function onConnection(connection) {
	const rid=connection.rid;
	const session = new SocketSession(connection);
	connections[rid]=session;
	connectionCount++;
	await session.print(greetings+"\r\n");
	return session.read();

}

function startConnectionListener(server) {
	function listenerLoop() {
		(async function() {
			for await (const connection of server) {
				onConnection(connection);
			}
		})();
	}
	listenerLoop();
}

let sloppySocket=null;

async function openSloppyPipe() {
	// todo: assert sloppySocket is null
	await Deno.remove(sockPath).catch(() => {});
	sloppySocket = Deno.listen({transport: "unix", path: sockPath});
	startConnectionListener(sloppySocket);
}

function closeSloppyPipe(){
	if(sloppySocket){
		sloppySocket.close();
		sloppySocket=null;
	}
}

try {
	await connectFountain();
	await writeFountain('{"action":"connect"}');
	let portPromise=readFountain();
	let systemPromise=readSystem();
	
	openSloppyPipe();

	while(true){
		const race=[portPromise,systemPromise];
		const result=await Promise.race(race);
		if (result == null) break;
//		console.log("[PIPE] race result",result);
		if(result.system) {
			await onSystem(result.system);
			systemPromise=readSystem();
		}
		if(result.message) {
			await onFountainPipe(result.message);
			portPromise=readFountain();
		}
		await sleep(500);
	}
} catch (error) {
	console.error("Error in main loop:",error);
} finally {
	console.log("[PIPE] bye");
	disconnectFountain();
	closeSloppyPipe();
	Deno.exit(0);
}
