import { DEMO_ANNOUNCEMENTS, DEMO_PRODUCTS } from "../src/lib/demo-data";
import { getDb } from "../src/lib/db";
import { getAuth } from "../src/lib/auth";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Vercel/CI provides environment variables directly, so the file is optional.
}

async function main() {
  const db = getDb();
  for (const [sortOrder, item] of DEMO_PRODUCTS.entries()) {
    const groups = item.optionGroups.map((group, groupOrder) => ({
      name: group.name,
      isRequired: group.required,
      minSelect: group.required ? 1 : 0,
      maxSelect: group.maxSelect,
      sortOrder: groupOrder,
      options: { create: group.options.map((option, optionOrder) => ({ name: option.name, priceDelta: option.priceDelta, isDefault: option.isDefault ?? false, sortOrder: optionOrder })) },
    }));
    await db.product.upsert({
      where: { slug: item.slug },
      create: { slug: item.slug, name: item.name, subtitle: item.subtitle, description: item.description, channel: item.channel, category: item.category, basePrice: item.price, imageUrl: item.imageUrl, stock: item.stock, isAvailable: item.isAvailable, sortOrder, optionGroups: { create: groups } },
      update: { name: item.name, subtitle: item.subtitle, description: item.description, channel: item.channel, category: item.category, basePrice: item.price, imageUrl: item.imageUrl, stock: item.stock, isAvailable: item.isAvailable, sortOrder, optionGroups: { deleteMany: {}, create: groups } },
    });
  }
  for (const [index, item] of DEMO_ANNOUNCEMENTS.entries()) {
    const exists = await db.announcement.findFirst({ where: { title: item.title } });
    if (!exists) await db.announcement.create({ data: { title: item.title, summary: item.summary, content: `${item.summary}\n\n欢迎到 CoffeeBar 安福路店参与活动，具体安排以门店通知为准。`, status: "PUBLISHED", publishedAt: new Date(Date.now() - index * 86_400_000) } });
  }
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    try { await getAuth().api.signUpEmail({ body: { email: adminEmail, password: adminPassword, name: "CoffeeBar Admin" } }); } catch { /* Existing account is promoted below. */ }
    await db.user.update({ where: { email: adminEmail }, data: { role: "ADMIN", emailVerified: true } });
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
