import { connect } from "jsr:@db/redis";

const password:string = getEnv(VALKEY_REDIS_KEY);
const redis = await connect({ hostname: "127.0.0.1", port: 6379 , password});

async function dumpNitroRedis(){
	const keys = await redis.keys("*");
	console.log("keys:",keys);
	const banner = await redis.get("wiki.banner");
	console.log("banner:",banner);
	for(const key of ["connection","session"]){
		const dspkey="nitrodsp."+key;
		const len = await redis.llen(dspkey);
		const range = await redis.lrange(dspkey,0,-1);
		console.log(key,len);	
	}
}

console.log("sloppyredis 0.1");

await dumpNitroRedis();

