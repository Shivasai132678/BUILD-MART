import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const USERS = [
  { phone: '+919000000001', name: 'BuildMart Admin', role: UserRole.ADMIN },
  { phone: '+919000000002', name: 'Ramesh Kumar', role: UserRole.BUYER },
  { phone: '+919000000003', name: 'Priya Sharma', role: UserRole.BUYER },
  { phone: '+919000000004', name: 'Lakshmi Vendor', role: UserRole.VENDOR },
  { phone: '+919000000005', name: 'Balaji Vendor', role: UserRole.VENDOR },
  { phone: '+919000000006', name: 'Sai Vendor', role: UserRole.VENDOR },
] as const;

const VENDOR_PROFILES = [
  {
    phone: '+919000000004',
    businessName: 'Lakshmi Cement Stores',
    gstNumber: '36AABCU9603R1ZX',
    city: 'Hyderabad',
  },
  {
    phone: '+919000000005',
    businessName: 'Sri Balaji Steel Traders',
    gstNumber: '36AABCS9604R1ZY',
    city: 'Hyderabad',
  },
  {
    phone: '+919000000006',
    businessName: 'Sai Tiles Gallery',
    gstNumber: '36AABCT9605R1ZZ',
    city: 'Hyderabad',
  },
] as const;

const CATEGORIES = [
  { name: 'Cement', slug: 'cement' },
  { name: 'Steel', slug: 'steel' },
  { name: 'Sand & Aggregate', slug: 'sand-aggregate' },
  { name: 'Tiles', slug: 'tiles' },
  { name: 'Paints', slug: 'paints' },
] as const;

const PRODUCTS = [
  { id: 'seed-prod-cement-01', name: 'Ultratech OPC 53', unit: 'bag', basePrice: '420.00', categorySlug: 'cement' },
  { id: 'seed-prod-cement-02', name: 'Birla Super OPC 53', unit: 'bag', basePrice: '410.00', categorySlug: 'cement' },
  { id: 'seed-prod-cement-03', name: 'Ultratech PPC', unit: 'bag', basePrice: '400.00', categorySlug: 'cement' },
  { id: 'seed-prod-cement-04', name: 'Dalmia OPC 43', unit: 'bag', basePrice: '390.00', categorySlug: 'cement' },
  { id: 'seed-prod-cement-05', name: 'ACC Gold OPC 53', unit: 'bag', basePrice: '415.00', categorySlug: 'cement' },
  { id: 'seed-prod-cement-06', name: 'Ramco PPC', unit: 'bag', basePrice: '395.00', categorySlug: 'cement' },

  { id: 'seed-prod-steel-01', name: 'Vizag TMT Fe500 8mm', unit: 'kg', basePrice: '62.00', categorySlug: 'steel' },
  { id: 'seed-prod-steel-02', name: 'Vizag TMT Fe500 12mm', unit: 'kg', basePrice: '61.00', categorySlug: 'steel' },
  { id: 'seed-prod-steel-03', name: 'JSPL TMT 10mm', unit: 'kg', basePrice: '63.00', categorySlug: 'steel' },
  { id: 'seed-prod-steel-04', name: 'Kamdhenu TMT 16mm', unit: 'kg', basePrice: '60.00', categorySlug: 'steel' },
  { id: 'seed-prod-steel-05', name: 'SAIL TMT 20mm', unit: 'kg', basePrice: '61.00', categorySlug: 'steel' },
  { id: 'seed-prod-steel-06', name: 'Meenakshi TMT 8mm', unit: 'kg', basePrice: '60.00', categorySlug: 'steel' },

  { id: 'seed-prod-sand-01', name: 'River Sand', unit: 'cft', basePrice: '55.00', categorySlug: 'sand-aggregate' },
  { id: 'seed-prod-sand-02', name: 'Manufactured M-Sand', unit: 'cft', basePrice: '45.00', categorySlug: 'sand-aggregate' },
  { id: 'seed-prod-sand-03', name: 'Coarse Aggregate 20mm', unit: 'cft', basePrice: '38.00', categorySlug: 'sand-aggregate' },
  { id: 'seed-prod-sand-04', name: 'Fine Aggregate', unit: 'cft', basePrice: '50.00', categorySlug: 'sand-aggregate' },

  { id: 'seed-prod-tiles-01', name: 'Kajaria 600x600 Matt', unit: 'sqft', basePrice: '48.00', categorySlug: 'tiles' },
  { id: 'seed-prod-tiles-02', name: 'Somany 800x800 Glossy', unit: 'sqft', basePrice: '65.00', categorySlug: 'tiles' },
  { id: 'seed-prod-tiles-03', name: 'Asian Granito 600x1200', unit: 'sqft', basePrice: '75.00', categorySlug: 'tiles' },
  { id: 'seed-prod-tiles-04', name: 'Johnson Floor 400x400', unit: 'sqft', basePrice: '35.00', categorySlug: 'tiles' },
  { id: 'seed-prod-tiles-05', name: 'Nitco Vitrified 600x600', unit: 'sqft', basePrice: '52.00', categorySlug: 'tiles' },
  { id: 'seed-prod-tiles-06', name: 'Kajaria Wall 300x450', unit: 'sqft', basePrice: '32.00', categorySlug: 'tiles' },
  { id: 'seed-prod-tiles-07', name: 'Orient Bell 300x600', unit: 'sqft', basePrice: '38.00', categorySlug: 'tiles' },
  { id: 'seed-prod-tiles-08', name: 'RAK 600x600 Polished', unit: 'sqft', basePrice: '55.00', categorySlug: 'tiles' },

  { id: 'seed-prod-paints-01', name: 'Asian Paints Royale', unit: 'litre', basePrice: '285.00', categorySlug: 'paints' },
  { id: 'seed-prod-paints-02', name: 'Berger Silk', unit: 'litre', basePrice: '275.00', categorySlug: 'paints' },
  { id: 'seed-prod-paints-03', name: 'Dulux Velvet Touch', unit: 'litre', basePrice: '265.00', categorySlug: 'paints' },
  { id: 'seed-prod-paints-04', name: 'Asian Paints Tractor Emulsion', unit: 'litre', basePrice: '175.00', categorySlug: 'paints' },
  { id: 'seed-prod-paints-05', name: 'Berger WeatherCoat', unit: 'litre', basePrice: '220.00', categorySlug: 'paints' },
  { id: 'seed-prod-paints-06', name: 'Nerolac Excel Total', unit: 'litre', basePrice: '255.00', categorySlug: 'paints' },
] as const;

const VENDOR_PRODUCT_ASSIGNMENTS: Array<{
  vendorBusinessName: string;
  categorySlugs: readonly string[];
}> = [
  {
    vendorBusinessName: 'Lakshmi Cement Stores',
    categorySlugs: ['cement', 'sand-aggregate'],
  },
  {
    vendorBusinessName: 'Sri Balaji Steel Traders',
    categorySlugs: ['steel'],
  },
  {
    vendorBusinessName: 'Sai Tiles Gallery',
    categorySlugs: ['tiles', 'paints'],
  },
];

const APPROVED_AT = new Date('2026-02-26T00:00:00.000Z');

async function main(): Promise<void> {
  console.log('Seeding BuildMart demo data...');

  // 1. Upsert users
  const usersByPhone = new Map<string, { id: string; phone: string }>();
  for (const user of USERS) {
    const savedUser = await prisma.user.upsert({
      where: { phone: user.phone },
      update: {
        name: user.name,
        role: user.role,
        isActive: true,
        deletedAt: null,
      },
      create: {
        phone: user.phone,
        name: user.name,
        role: user.role,
      },
      select: {
        id: true,
        phone: true,
      },
    });

    usersByPhone.set(savedUser.phone, savedUser);
  }

  // 2. Upsert vendor profiles (look up userId from phone)
  const vendorsByBusinessName = new Map<string, { id: string; userId: string }>();
  for (const vendor of VENDOR_PROFILES) {
    const user = usersByPhone.get(vendor.phone);
    if (!user) {
      throw new Error(`Missing user for vendor phone ${vendor.phone}`);
    }

    const savedVendor = await prisma.vendorProfile.upsert({
      where: { userId: user.id },
      update: {
        businessName: vendor.businessName,
        gstNumber: vendor.gstNumber,
        city: vendor.city,
        serviceableAreas: [vendor.city],
        isApproved: true,
        approvedAt: APPROVED_AT,
        deletedAt: null,
      },
      create: {
        userId: user.id,
        businessName: vendor.businessName,
        gstNumber: vendor.gstNumber,
        city: vendor.city,
        serviceableAreas: [vendor.city],
        isApproved: true,
        approvedAt: APPROVED_AT,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    vendorsByBusinessName.set(vendor.businessName, savedVendor);
  }

  // 3. Upsert categories
  const categoryIdBySlug = new Map<string, string>();
  for (const category of CATEGORIES) {
    const savedCategory = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        isActive: true,
      },
      create: {
        name: category.name,
        slug: category.slug,
      },
      select: {
        id: true,
        slug: true,
      },
    });

    categoryIdBySlug.set(savedCategory.slug, savedCategory.id);
  }

  // 4. Upsert products (look up categoryId from slug)
  const productsById = new Map<string, { id: string; categorySlug: string }>();
  for (const product of PRODUCTS) {
    const categoryId = categoryIdBySlug.get(product.categorySlug);
    if (!categoryId) {
      throw new Error(`Missing category for slug ${product.categorySlug}`);
    }

    const savedProduct = await prisma.product.upsert({
      where: { id: product.id },
      update: {
        categoryId,
        name: product.name,
        unit: product.unit,
        basePrice: product.basePrice,
        isActive: true,
        deletedAt: null,
      },
      create: {
        id: product.id,
        categoryId,
        name: product.name,
        unit: product.unit,
        basePrice: product.basePrice,
      },
      select: {
        id: true,
      },
    });

    productsById.set(savedProduct.id, {
      id: savedProduct.id,
      categorySlug: product.categorySlug,
    });
  }

  // 5. Upsert vendor products (look up vendorId + productId)
  for (const assignment of VENDOR_PRODUCT_ASSIGNMENTS) {
    const vendor = vendorsByBusinessName.get(assignment.vendorBusinessName);
    if (!vendor) {
      throw new Error(`Missing vendor profile for ${assignment.vendorBusinessName}`);
    }

    const vendorProducts = PRODUCTS.filter((product) =>
      assignment.categorySlugs.includes(product.categorySlug),
    );

    for (const product of vendorProducts) {
      const savedProduct = productsById.get(product.id);
      if (!savedProduct) {
        throw new Error(`Missing product ${product.id}`);
      }

      await prisma.vendorProduct.upsert({
        where: {
          vendorId_productId: {
            vendorId: vendor.id,
            productId: savedProduct.id,
          },
        },
        update: {
          stockAvailable: true,
          customPrice: null,
        },
        create: {
          vendorId: vendor.id,
          productId: savedProduct.id,
          stockAvailable: true,
          customPrice: null,
        },
      });
    }
  }

  const [userCount, categoryCount, productCount, vendorCount, vendorProductCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.category.count(),
      prisma.product.count(),
      prisma.vendorProfile.count(),
      prisma.vendorProduct.count(),
    ]);

  console.log(
    `Seed complete -> users: ${userCount}, categories: ${categoryCount}, products: ${productCount}, vendors: ${vendorCount}, vendorProducts: ${vendorProductCount}`,
  );
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
