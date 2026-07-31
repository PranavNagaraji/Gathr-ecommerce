import { createClient } from "redis";

const client = createClient({ url: process.env.REDIS_URL });;

client.on("error", (err) => console.log("Redis error", err));

try {
    await client.connect();
    console.log("Redis connected");
    // await client.set("test", "Redis running in backend!");
    // console.log(await client.get("test"));
    // await client.del("test");
} catch (error) {
    console.warn("Redis connection failed. Running backend without Redis cache:", error.message);
}

export default client;