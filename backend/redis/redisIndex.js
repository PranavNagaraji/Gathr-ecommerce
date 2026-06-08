import client from "./redis.js";
export async function createIndex() {
    try {
        await client.ft.create(
            "idx:products",
            {
                "$.id": { type: "NUMERIC", AS: "id", SORTABLE: true },
                "$.name": { type: "TEXT", AS: "name", WEIGHT: 5 },
                "$.description": { type: "TEXT", AS: "description" },
                "$.price": { type: "NUMERIC", AS: "price", SORTABLE: true },
                "$.quantity": { type: "NUMERIC", AS: "quantity", SORTABLE: true },
                "$.sold_qt": { type: "NUMERIC", AS: "sold_qt", SORTABLE: true },
                "$.category": { type: "TAG", AS: "category" },
                "$.shop_id": { type: "NUMERIC", AS: "shop_id" },
            },
            {
                ON: "JSON",
                PREFIX: "product:",
            }
        );
        console.log("Redisearch index created");
    } catch (err) {
        if (err.message.includes("Index already exists")) {
            console.log("RediSearch index already exists, skipping");
        } else {
            throw err;
        }
    }
}