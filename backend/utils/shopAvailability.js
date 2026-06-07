import supabase from "../db.js";

export const INACTIVE_SHOP_CART_MESSAGE =
  "Some items in your cart are from shops that are currently unavailable. Please remove them before proceeding.";

const toKey = (value) => String(value);

export const getShopStatusMap = async (shopIds = []) => {
  const uniqueShopIds = Array.from(new Set(shopIds.filter(Boolean)));
  if (!uniqueShopIds.length) return new Map();

  const { data: shops, error } = await supabase
    .from("Shops")
    .select("id, shop_name, active")
    .in("id", uniqueShopIds);

  if (error) throw error;

  return new Map(
    (shops || []).map((shop) => [
      toKey(shop.id),
      {
        id: shop.id,
        shop_name: shop.shop_name,
        active: shop.active !== false,
      },
    ])
  );
};

export const getCartShopAvailability = async (cartItems = []) => {
  const shopIds = cartItems
    .map((cartItem) => cartItem?.Items?.shop_id)
    .filter(Boolean);

  const shopStatusMap = await getShopStatusMap(shopIds);

  const annotatedCartItems = cartItems.map((cartItem) => {
    const itemShopId = cartItem?.Items?.shop_id;
    const shopStatus = itemShopId ? shopStatusMap.get(toKey(itemShopId)) : null;
    const shopActive = shopStatus ? shopStatus.active : false;

    return {
      ...cartItem,
      Items: cartItem?.Items
        ? {
            ...cartItem.Items,
            shop_active: shopActive,
            shop_name: shopStatus?.shop_name || null,
          }
        : cartItem?.Items,
    };
  });

  const inactiveCartItems = annotatedCartItems
    .filter((cartItem) => cartItem?.Items?.shop_active === false)
    .map((cartItem) => ({
      item_id: cartItem.item_id || cartItem.Items?.id,
      name: cartItem.Items?.name || "Item",
      shop_id: cartItem.Items?.shop_id,
      shop_name: cartItem.Items?.shop_name || "Shop",
    }));

  return { cartItems: annotatedCartItems, inactiveCartItems };
};
