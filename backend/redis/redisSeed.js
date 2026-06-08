import client from "./redis.js";
import supabase from "../db.js";

export async function seedFromSupabase() {
    const { data: products, error } = await supabase.from("Items").select("*");
    if (error)
        throw error;
    for (const product of products) {
        await client.json.set(`product:${product.id}`, "$", {
            id: product.id,
            name: product.name ?? "",
            description: product.description ?? "",
            price: product.price ?? 0,
            quantity: product.quantity ?? 0,
            sold_qt: product.sold_qt ?? 0,
            rating: product.rating ?? null,
            category: product.category ?? [],
            shop_id: product.shop_id,
            images: product.images ?? [],
        });
    }
    console.log(`Redis seeded with ${products.length} products`);
    // console.log(products[0]);
}