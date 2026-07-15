import { DEMO_ANNOUNCEMENTS, DEMO_PRODUCTS } from "@/lib/demo-data";

export function getDemoAdminData() {
  return {
    products: DEMO_PRODUCTS.map((product) => ({ id: product.id, name: product.name, description: product.description, category: product.category, channel: product.channel, basePrice: product.price, stock: product.stock, imageUrl: product.imageUrl, isAvailable: product.isAvailable })),
    orders: [
      { id: "d1", orderNumber: "CB2607151320A3F1", status: "PAID", totalAmount: 6800, pickupName: "林墨", pickupAt: new Date().toISOString(), items: [{ productName: "黑白拿铁", quantity: 1 }, { productName: "原味巴斯克", quantity: 1 }] },
      { id: "d2", orderNumber: "CB2607151255C6D2", status: "PREPARING", totalAmount: 3600, pickupName: "周然", pickupAt: new Date().toISOString(), items: [{ productName: "青提冷萃", quantity: 1 }] },
    ],
    announcements: DEMO_ANNOUNCEMENTS.map((item) => ({ id: item.id, title: item.title, summary: item.summary, status: "PUBLISHED" })),
    revenue: 128600,
    paymentCount: 32,
  };
}
