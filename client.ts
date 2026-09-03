// talk to godot display terminal 
// startg json rpc protocol

class startgClient {
	ws: WebSocket;

	constructor() {
		this.connect();
		console.log("startg websocket");
	}

	connect() {
		console.log("connecting...");
		this.ws = new WebSocket("ws://localhost:8080");
		this.ws.onopen = this.onOpen.bind(this);
		this.ws.onmessage = this.onMessage.bind(this);
		this.ws.onclose = this.onClose.bind(this);
		this.ws.onerror = this.onError.bind(this);
	}

	sendCount=0;

	readonly OPEN=1;

	send(method:string,params:any){
		const state=this.ws.readyState;
		if(state!=WebSocket.OPEN){
			console.log("send not OPEN");
		}else{
			const id = ++this.sendCount;
			const payload = { jsonrpc: "2.0", id, method, params };
			this.ws.send(JSON.stringify(payload));
		}
	}

	onOpen() {
		console.log("connected to startg");
		this.send("init",{cols: 80, rows: 24 });
	}

	onMessage(event: MessageEvent) {
		let payload=JSON.parse(event.data);
//		console.log("onMessage", payload);		
		this.send("echo",{payload});
	}

	onClose() {
		console.log("disconnected");
		setTimeout(this.connect.bind(this), 1000);
	}

	onError(err: Event) {
		console.error("ws error:", err);
	}
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const client = new startgClient();

let running=true;
let count=0;

while(running){
	client.send("tick",{count});
	count++;
	await sleep(100);
	if (count>100) running=false;
}

