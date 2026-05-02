// sloppyhost.ts - http file server and jsonrpc for slop fountain egress ingress

// (c)2025 Simon Armstrong
// Licensed under the MIT License - See LICENSE file

// see slophole.ts for singleton worker based transport

import { serveFile } from "https://deno.land/std@0.224.0/http/file_server.ts";

const slopPid=Deno.pid;
const sessionName="slophost"+slopPid;
let sessionCount=0;
let slopMessage="";	// guard against repeating results

let slopPail:unknown[]=[];

function sloppyEvent(message:string){
	slopPail.push({content:message,from:"sloppyhost"});
}

function sloppyEvent(message:string){
	slopPail.push({content:message,from:"sloppyhost"});
}

function logSlop(_result:any){
	const message=JSON.stringify(_result);
	if(message!=slopMessage){
		console.error("[HOST]",message);
		slopMessage=message;
	}
	slopPail.push(message);
}

function emptySlop(){
	const slop=slopPail;
	slopPail=[];
	return slop;
}

const greet=sessionName+" server says hello into the slop hole";

// [slop] sleep

async function sleep(ms:number) {
	await new Promise(function(resolve) {setTimeout(resolve, ms);});
}

// [slop] serve files

async function servePath(request:Request,path:string):Promise<Response>{
//	console.log("[HOST] servePath",path);
	return await serveFile(request,path);
}

// [slop] host session

const hostName=Deno.hostname();
const userName=Deno.env.get("USERNAME")||"root";
const platform=(Deno.uid()||"Windows")+" "+Deno.osRelease();

interface JsonRPCRequest{
	jsonrpc:string, //"2.0"
	id:string,
	error?:string,
	method: string;
	params?: Record<string, unknown> | unknown[];
}

interface JsonRPCResponse {
	jsonrpc: string;
	id: string;
	result: Record<string, unknown> | unknown[];
}

function sysInfo(request:JsonRPCRequest):JsonRPCResponse{
	++sessionCount;
	const session=sessionName+"."+sessionCount;
	const result={hostName,userName,platform,session};
//	logSlop("sysInfo",request,result);
	return {jsonrpc:request.jsonrpc,id:request.id,result};
}

interface Tick{
	session:string;
	events:string[];
};

function sysTick(request:JsonRPCRequest):JsonRPCResponse{
	const tick:Tick=request.params;
	const session=tick.session;
	for(const event of tick.events){
		logSlopEvent(event);
	}
	const _result=emptySlop();
	logSlop({request,result:_result});
	return {jsonrpc:request.jsonrpc,id:request.id,result:{messages:_result}};
}
function sysPorts(request:JsonRPCRequest):JsonRPCResponse{
	const _result:unknown[]=[];
	return {jsonrpc:request.jsonrpc,id:request.id,result:_result};
}
function sysConnect(request:JsonRPCRequest):JsonRPCResponse{
	const result={};
	return {jsonrpc:request.jsonrpc,id:request.id,result};
}
function sysConnections(request:JsonRPCRequest):JsonRPCResponse{
	const result={};
	return {jsonrpc:request.jsonrpc,id:request.id,result};
}

const slopVersion=0.1;

// Creating a basic worker (main.ts)
let worker:Worker = new Worker(new URL("./slophole.ts", import.meta.url).href, {type: "module"});

function closeSlopHole(){
	worker.postMessage({ command: "close" });
}

function writeSlopHole(content:string){
	worker.postMessage({ command: "write", data:{slop:[content]} });
}

function readSlopHole(){
	worker.postMessage({ command: "read", data:{} });
}

worker.onmessage = (message) => {
	const payload=message.data;//ports,origin.lastEventId JSON.stringify(payload)
	logSlop(payload);
	if(payload.connected){
		writeSlopHole(greet);
		readSlopHole();
//		worker.postMessage({ command: "write", data:greet });
	}
	if(payload.disconnected){
		worker.terminate(); // Stop the worker when done
		worker=null;
	}
	if(payload.received){
		const rx=payload.received;
		logSlop(rx);
	}
};

worker.onerror = (e) => {
	console.error("Worker error:", e.message);
};

await sleep(6e3);

worker.postMessage({ command: "open", data: [1, 2, 3, 4] });


// [slop] serve http requests

Deno.serve(async (request) => {
	const url = new URL(request.url);
	const path = decodeURIComponent(url.pathname);
	if (path.startsWith("/api")) {
		if (request.method !== "POST") {
			return new Response("POST Method Not Allowed", { status: 405 });
		}
		const bytes = await request.arrayBuffer();
		const text = new TextDecoder().decode(new Uint8Array(bytes));
		const rpc=JSON.parse(text);
		const method=rpc.method;
		let result=null;
		switch(method){
			case "sys.info":
				result=sysInfo(rpc);
				break;
			case "sys.tick":
				result=await sysTick(rpc);
				break;
			case "sys.ports":
				result=await sysPorts(rpc);
				break;
			case "sys.connect":
				result=await sysConnect(rpc);
				break;
			case "sys.connections":
				result=await sysConnections(rpc);
				break;
			default:
				return new Response("Not Found", { status: 404 });
		}
		console.error("[HOST]",method,JSON.stringify(result));
		const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*"};
		return new Response(JSON.stringify(result),{headers});
	}
	switch(path){
		case "/":{
			const response=await servePath(request,"../web/slop.html");
			return response;
		}
		case "/slopstudio.js":
		case "/slopdom.js":
		case "/slop.css":
		case "/favicon.ico":{
			const response=await servePath(request,"../web/"+path);
			return response;
		}
	}
	console.log("[HOST] File Not Found path:",path);
	return new Response("Not Found",{status:404});
});
