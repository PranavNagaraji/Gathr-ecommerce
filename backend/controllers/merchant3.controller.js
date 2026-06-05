import supabase from "../db.js";
import { Clerk } from "@clerk/clerk-sdk-node";
import dotenv from "dotenv";

dotenv.config();
const clerk = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY });
const calculateOrderTotalForShop = (order, shop) => {
    if (!order.Cart || !order.Cart.Cart_items) return 0;
    
    const shopItems = order.Cart.Cart_items.filter(item => 
        item.order_id === order.id && item.Items?.shop_id === shop.id
    );
    
    const subtotal = shopItems.reduce((sum, item) => sum + (item.Items?.price || 0) * item.quantity, 0);
    const gst = subtotal * 0.18;
    
    // Calculate distance and delivery fee
    let deliveryFee = 0;
    if (shop.Location && order.Addresses?.location) {
        const toRad = (v) => (v * Math.PI) / 180;
        const getDistanceKm = (lat1, lon1, lat2, lon2) => {
            const R = 6371;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };
        
        const shopLat = shop.Location.latitude ?? shop.Location.lat;
        const shopLong = shop.Location.longitude ?? shop.Location.long;
        const destLat = order.Addresses.location.lat ?? order.Addresses.location.latitude;
        const destLong = order.Addresses.location.long ?? order.Addresses.location.longitude;
        
        if (shopLat != null && shopLong != null && destLat != null && destLong != null) {
            const distanceKm = getDistanceKm(Number(shopLat), Number(shopLong), Number(destLat), Number(destLong));
            const extraKm = Math.max(0, distanceKm - 2);
            deliveryFee = 30 + Math.ceil(extraKm) * 10;
        }
    }
    
    return subtotal + gst + deliveryFee;
};

export const getPendingCarts = async (req, res) => {
    try {
        const { clerkId } = req.params; 
        const { data: user, error: userError } = await supabase
            .from('Users')
            .select('id, role')
            .eq('clerk_id', clerkId)
            .single();
        if (userError || !user) {
            return res.status(404).json({ message: "User not found." });
        }
        
        if (user.role !== "merchant") {
            return res.status(403).json({ message: "User is not a merchant." });
        }

        const { data: shop , error: shopError } = await supabase
            .from("Shops")
            .select("*")
            .eq("owner_id", user.id)
            .single();
        if (shopError || !shop) {
            return res.status(404).json({ message: "Shop not found for this user." });
        }

        const { data: carts, error } = await supabase
            .from("Orders")
            .select("*, Cart(* , Cart_items(* , Items(*))), Addresses(*)")
            .eq("status", "pending")
            .eq("shop_id", shop.id)
            .order("created_at", { ascending: false });
        if (error) {
            return res.status(500).json({ message: "Failed to fetch carts.", error: error.message });
        }

        // Filter and map order details
        const processedCarts = (carts || []).map(order => {
            console.log(`[DEBUG] getPendingCarts - Order ID: ${order.id}, Cart ID: ${order.cart_id}`);
            
            if (order.Cart && order.Cart.Cart_items) {
                // Filter cart items by order_id and shop_id
                order.Cart.Cart_items = order.Cart.Cart_items.filter(item => 
                    item.order_id === order.id && item.Items?.shop_id === shop.id
                );
                
                // Recalculate amount_paid for this merchant's shop items
                order.amount_paid = calculateOrderTotalForShop(order, shop);
            }
            return order;
        });

        return res.status(200).json({ carts: processedCarts });
    } catch (err) {
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { clerkId, orderId, status } = req.body;
        const { data: user, error: userError } = await supabase
            .from('Users')
            .select('id, role')
            .eq('clerk_id', clerkId)
            .single();
        if (userError || !user) {
            return res.status(404).json({ message: "User not found." });
        }
        if (user.role !== "merchant") {
            return res.status(403).json({ message: "User is not a merchant." });
        }
        const { data: order, error } = await supabase
            .from("Orders")
            .select("*")
            .eq("id", orderId)
            .single();
        if (error) {
            return res.status(500).json({ message: "Failed to fetch order.", error: error.message });
        }
        if (!order) {
            return res.status(404).json({ message: "Order not found." });
        }

        const { data: shop , error: shopError } = await supabase
            .from("Shops")
            .select("*")
            .eq("owner_id", user.id)
            .single();
        if (shopError || !shop) {
            return res.status(404).json({ message: "Shop not found for this user." });
        }
        if (shop.id !== order.shop_id) {
            return res.status(403).json({ message: "You are not authorized to update this order." });
        }

        await supabase.from("Orders").update({ status: status }).eq("id", orderId);
        return res.status(200).json({ message: "Order status updated successfully." });
    } catch (err) {
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

export const get_all_carts = async (req,res)=>{
    const { clerkId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit) || 10));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: user, error: userError } = await supabase
        .from('Users')
        .select('id, role')
        .eq('clerk_id', clerkId)
        .single();

    if (userError || !user) {
        return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== 'merchant') {
        return res.status(403).json({ message: "Unauthorized: Only logged in users can get cart history" });
    }

    const { data: shop , error: shopError } = await supabase
            .from("Shops")
            .select("*")
            .eq("owner_id", user.id)
            .single();
    if (shopError || !shop) {
        return res.status(404).json({ message: "Shop not found for this user." });
    }

    const { data: carts, error, count } = await supabase
        .from("Orders")
        .select("*, Cart(* , Cart_items(* , Items(*))), Addresses(*), Users:carrier_id(*)", { count: 'exact' })
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false })
        .range(from, to);
    if (error) {
        return res.status(500).json({ message: "Failed to fetch carts.", error: error.message });
    }

    // Filter and map order details
    const processedCarts = (carts || []).map(order => {
        // console.log(`[DEBUG] getAllCarts - Order ID: ${order.id}, Cart ID: ${order.cart_id}`);
        
        if (order.Cart && order.Cart.Cart_items) {
            // Filter cart items by order_id and shop_id
            order.Cart.Cart_items = order.Cart.Cart_items.filter(item => 
                item.order_id === order.id && item.Items?.shop_id === shop.id
            );
            
            // Recalculate amount_paid for this merchant's shop items
            order.amount_paid = calculateOrderTotalForShop(order, shop);
        }
        return order;
    });

    return res.status(200).json({ carts: processedCarts, total: count || 0, page, limit });
        
}

export const getBanStatus = async (req, res) => {
    try {
        const { clerkId } = req.params;
        if (!clerkId) return res.status(400).json({ message: "Missing clerkId" });
        try {
            const u = await clerk.users.getUser(clerkId);
            const banned = !!u?.publicMetadata?.shop_banned;
            const reason = u?.publicMetadata?.shop_ban_reason || null;
            return res.status(200).json({ banned, reason });
        } catch (e) {
            return res.status(500).json({ message: "Failed to read ban status" });
        }
    } catch (err) {
        return res.status(500).json({ message: "Internal server error" });
    }
}