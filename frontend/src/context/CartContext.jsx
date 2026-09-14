import { createContext, useContext, useEffect, useState } from "react";

const CartCtx = createContext(null);
export const useCart = () => useContext(CartCtx);

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem("zupi_cart")) || null; } catch { return null; }
  });

  useEffect(() => {
    if (cart) localStorage.setItem("zupi_cart", JSON.stringify(cart));
    else localStorage.removeItem("zupi_cart");
  }, [cart]);

  const addItem = (restaurant, product, addons, qty, notes) => {
    if (cart && cart.restaurantId !== restaurant.id) return "conflict";
    const unit = (product.promo_price || product.price) + addons.reduce((s, a) => s + a.price, 0);
    const key = `${product.id}|${addons.map((a) => a.id).sort().join(",")}|${notes || ""}`;
    setCart((prev) => {
      const base = prev && prev.restaurantId === restaurant.id
        ? prev
        : { restaurantId: restaurant.id, restaurantName: restaurant.name, deliveryFee: restaurant.delivery_fee, minOrder: restaurant.min_order, items: [] };
      const existing = base.items.find((i) => i.key === key);
      const items = existing
        ? base.items.map((i) => (i.key === key ? { ...i, qty: i.qty + qty } : i))
        : [...base.items, { key, product_id: product.id, name: product.name, image: product.image, unit_price: unit, qty, addons, notes: notes || "" }];
      return { ...base, items };
    });
    return "ok";
  };

  const replaceCart = (restaurant, items) => {
    setCart({
      restaurantId: restaurant.id, restaurantName: restaurant.name,
      deliveryFee: restaurant.delivery_fee, minOrder: restaurant.min_order,
      items: items.map((i) => ({
        key: `${i.product_id}|${(i.addons || []).map((a) => a.id || a).sort().join(",")}|${i.notes || ""}`,
        product_id: i.product_id, name: i.name || "", image: i.image || "",
        unit_price: i.unit_price || 0, qty: i.qty, addons: i.addons || [], notes: i.notes || "",
      })),
    });
  };

  const updateQty = (key, delta) => {
    setCart((prev) => {
      if (!prev) return prev;
      const items = prev.items
        .map((i) => (i.key === key ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0);
      return items.length ? { ...prev, items } : null;
    });
  };

  const removeItem = (key) => {
    setCart((prev) => {
      if (!prev) return prev;
      const items = prev.items.filter((i) => i.key !== key);
      return items.length ? { ...prev, items } : null;
    });
  };

  const clear = () => setCart(null);

  const subtotal = cart ? cart.items.reduce((s, i) => s + i.unit_price * i.qty, 0) : 0;
  const count = cart ? cart.items.reduce((s, i) => s + i.qty, 0) : 0;

  return (
    <CartCtx.Provider value={{ cart, addItem, updateQty, removeItem, clear, replaceCart, subtotal, count }}>
      {children}
    </CartCtx.Provider>
  );
}
