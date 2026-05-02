// sloppylisten.ts - a sloppy ssh telnet server for Slop Fountain
// Copyright (c) 2025 Simon Armstrong

// Licensed under the MIT License - See LICENSE file

//import { Client } from "https://deno.land/x/ssh2@0.9.0/mod.ts";
import { readFileSync } from "node:fs";
import { Buffer, Client, Server } from "npm:ssh2";

import {wrapText,onSystem,readSystem,readFountain,writeFountain,disconnectFountain,connectFountain} from "./sloppyutils.ts";
																																																												  
export const ANSI={
	Reset:"\x1BC",
	Defaults:"\x1B[0m",//"\x1B[39;49m",//\x1B[0m",
	Clear:"\x1B[2J",
	Home:"\x1B[H",
	White:"\x1B[37m",
	NavyBackground:"\x1b[48;5;24m",
	Aqua:"\x1B[38;5;122m",
	Pink:"\x1B[38;5;206m",
	HideCursor:"\x1b[?25l",
	ShowCursor:"\x1b[?25h",
	Cursor:"\x1B["//+ row + ";1H"
}

const sloppyStyle=ANSI.NavyBackground+ANSI.White+ANSI.Clear;

const sloppyLogo="✴ slopcity";
const sloppyNetVersion=0.7;

// raw key handling work in progress
// ssh-keygen -t rsa -f hostkey_rsa -N ''.

// TODO: make multi planetary
const HomeDir=Deno.env.get("HOME")||Deno.env.get("HOMEPATH");
const rsaPath=HomeDir+"/.ssh/id_rsa";
//const rsaPath=HomeDir+"/fountain_key_skidnz"

// sloppyNet uses slopfeed workers in a responsible manner

const sshClient=new Client();
const connections={};
const users={};

let slopPail:unknown[]=[];
let connectionCount=0;
let sessionCount=0;
let connectionClosed=0;

const greetings=[sloppyStyle,"Welcome to ",sloppyLogo,sloppyNetVersion].join("");
const notice="type exit to quit";

function logSlop(_result:any) {
	const message=JSON.stringify(_result);
	console.error("[LISTEN]",message);
	slopPail.push(message);
}

async function sleep(ms:number) {
	await new Promise(function(resolve) {setTimeout(resolve,ms);});
}

const encoder=new TextEncoder();
async function writeSloppy(message:string,from:string){
	const text="["+from+"] "+message+"\r\n";
	for(const key of Object.keys(connections)){
		const session=connections[key];
		await session.print(text);
	}
}

export async function onFountain(message:string){
	const line=message;
	if(line.startsWith("/announce ")){
		const message=line.substring(10);
		await writeSloppy(message,"fountain");
	}
	if(line.startsWith("{")||line.startsWith("[")){
		try{
			let cursor=0;
			while(cursor<line.length){
				const delim=line.indexOf("}\n{",cursor);// less than healthy
				const json=(delim==-1)?line.substring(cursor):line.substring(cursor,delim+1);
				cursor+=json.length;
				const payload=JSON.parse(json);
				for(const {message,from} of payload.messages){
					await writeSloppy(message,from);
				}
			}
		}catch(error){
			console.log("JSON parse error",error);
			console.log("JSON parse error",line);
		}
	}else{
		console.log("non json line",line);
	}
}

class SSHSession {
	name: string;
	stream: any;
	env:Record<string,string>;
	private lineBuffer: string;
	private terminalSize: { cols: number; rows: number } | null;
	private decoder=new TextDecoder("utf-8");

	constructor(name: string) {
		this.env={};
		this.name = name;
		this.lineBuffer = "";
		this.terminalSize = null;
	}

	setEnv(key:string,value:string){
		this.env[key]=value;
	}

	async print(data: string): Promise<void> {
		const cols=(this.terminalSize?.cols||40)-4;
		if (this.stream&&this.stream.writable) {
			const lines=wrapText(data,cols);
			const text=lines.join("\r\n");
//			console.log("print",text,cols);
			await this.stream.write(text);
		}else{
			logSlop({ error: "SSHSession print error" });		
		}
	}

	async onEnd(): Promise<void> {
		if (this.stream) {
			await this.stream.end();
		}
	}

	setTerminalSize(cols: number, rows: number): void {
		this.terminalSize = { cols, rows };
		logSlop({ status: "Terminal size updated", name: this.name, terminalSize: this.terminalSize });
	}

	async onEnter(){
		const line = this.lineBuffer;
		this.lineBuffer = "";
		await this.print("\r\n");
		if (line=="exit") {
			await this.print("Goodbye!\r\n");
			this.stream?.end();
			return;
		}
		if (line=="/termsize") {
			if (this.terminalSize) {
				await this.print(`Terminal size: ${this.terminalSize.cols} columns x ${this.terminalSize.rows} rows\r\n`);
			} else {
				await this.print("Terminal size not available\r\n");
			}
			return;
		}
		if (line.length){
			if(line.startsWith("/")) {
				const from=this.name;
				const blob={messages:[{command:line,from}]};
				const ndjson=JSON.stringify(blob,null,0)+"\n";
				await writeFountain(ndjson);
			}else{
				const from=this.name;
				const blob={messages:[{message:line,from}]};
				const ndjson=JSON.stringify(blob,null,0)+"\n";
				await writeFountain(ndjson);
			}
		}
	}

	async onShell(data: Buffer): Promise<void> {
		const text=this.decoder.decode(data);
		const chars=[];
		for (const char of text) {
			const byte=char.charCodeAt(0);
			switch(byte){
				case 3: // CTRL-C handler
					this.lineBuffer="";
					this.stream?.end();
					break;
				case 127: // BACKSPACE handler
					this.lineBuffer=this.lineBuffer.slice(0,-1);
					await this.print("\b \b");
					break;
				case 13: // ENTER handler
					await this.onEnter();
					break;
				default:{
					const printable=(byte==9)||(byte==27)||(byte>=32);
					if(printable){
						this.lineBuffer += char;
						chars.push(char);
					}
				}
			}
		}
		if(chars.length){
			const test=String.fromCharCode(...chars);
			await this.print(text);
		}
	}

	end(): void {
		delete connections[this.name];
		logSlop({ status: "Session closed", name: this.name });
	}
}

async function onSSHConnection(sshClient: any, name: string) {
	sshClient.on("authentication", (context: any) => {
		sshClient.username=context.username;
		console.log("authenticating "+context.username);
		if (context.method === "password") {
			context.accept();
		} else {
			context.reject();
		}
	});
	sshClient.on("ready", () => {
		const connection = new SSHSession(name);
		logSlop({ status: "SSH client authenticated", name });
		connections[name]=connection;
		users[name]=sshClient.username;
		// TODO: env signal exec sftp x11 subsystem

		sshClient.on("session", (accept: any, reject: any) => {
			const session = accept();
			session.on("shell", (accept: any) => {
				const stream = accept && accept();
				stream.write(greetings + "\r\n");
				stream.write(notice + "\r\n");
				stream.on("data", (data:Buffer) => {connection.onShell(data);});
				stream.on("end", () => {connection.end();});
				connection.stream=stream;
			});
			session.on("pty", (accept: any, reject: any, info: any) => {
				accept && accept();
				const { cols, rows } = info;
				connection.setTerminalSize(cols, rows);
			});
			session.on("window-change", (accept: any, reject: any, info: any) => {
				accept && accept();
				const { cols, rows } = info;
				connection.setTerminalSize(cols, rows);
			});
			session.on("signal", (accept: any, reject: any, info: any) => {
				accept && accept();
				const { name } = info;
				logSlop({ status: "Signal received", name: connection.name, signal: name });
				if (name === "INT") {
					connection.lineBuffer = "";
					connection.write("\r\nInterrupted\r\n");
				} else if (name === "TERM") {
					connection.write("\r\nTerminated\r\n");
					connection.stream?.end();
				}
			});
			session.on("env", (accept: any, reject: any, info: any) => {
				accept && accept();
				const {key,value}=info;
				connection.setEnv(key,value);
			});
		});
	});

	sshClient.on("error", (err: any) => {
		logSlop({ error: "SSH client error", message: err.message });
	});

	sshClient.on("end", () => {
		logSlop({status:"SSH ending connection",name});
		const connection=connections[name];
		connection?.end();
	});
}

const algorithms={
	cipher: [
		'aes128-ctr',
		'aes192-ctr',
		'aes256-ctr',
		'aes128-gcm',
		'aes128-gcm@openssh.com'
//		'aes256-gcm',
//		'aes256-gcm@openssh.com'
	]
};

async function startSSHServer(port: number = 6669) {
	try {
		const hostKey = readFileSync(rsaPath, "utf8");
		const server = new Server({ hostKeys: [hostKey], algorithms });
		server.on("connection", (sshClient) => {
			const name="ssh_session:"+(++connectionCount);
			logSlop({status:"SSH connected",name});
			onSSHConnection(sshClient,name).catch((err) => {
				logSlop({error:"Connection error",message:err.message,connectionCount});
			});
		});
		await new Promise((resolve) => server.listen(port, "localhost", () => resolve(undefined)));
		logSlop({ status: "SSH Server listening", port });
	} catch (error) {
		console.error("Failed to start SSH Server:", error);
	}
}

startSSHServer();

try {
	await connectFountain();
	await writeFountain('{"action":"connect"}');
	let portPromise=readFountain();
	let systemPromise=readSystem();

	while(true){
		const race=[portPromise,systemPromise];
		const result=await Promise.race(race);
		if (result == null) break;

		if(result.system) {
			await onSystem(result.system);
			systemPromise=readSystem();
		}
		if(result.message) {
			await onFountain(result.message);
			portPromise=readFountain();
		}
		await sleep(500);
	}
} catch (error) {
	console.error("Error in main loop:",error);
} finally {
	console.log("bye");
	disconnectFountain();
	Deno.exit(0);
}
