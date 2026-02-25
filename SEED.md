# Seed Data Plan (Deterministic Demo Data)

## ACCOUNTS (all OTP login, use phone numbers)
- Admin: +91-9000000001 | name: BuildMart Admin
- Buyer 1: +91-9000000002 | name: Ramesh Kumar (small contractor)
- Buyer 2: +91-9000000003 | name: Priya Sharma (homeowner)
- Vendor 1: +91-9000000004 | businessName: Lakshmi Cement Stores
- Vendor 2: +91-9000000005 | businessName: Sri Balaji Steel Traders
- Vendor 3: +91-9000000006 | businessName: Sai Tiles Gallery

## CATEGORIES (5)
- Cement
- Steel
- Sand & Aggregate
- Tiles
- Paints

## PRODUCTS (30) with Hyderabad market prices (Feb 2026)
- Cement (6): Ultratech OPC 53 ₹420/bag, Birla Super OPC 53 ₹410/bag, Ultratech PPC ₹400/bag, Dalmia OPC 43 ₹390/bag, ACC Gold OPC 53 ₹415/bag, Ramco PPC ₹395/bag
- Steel (6): Vizag TMT Fe500 8mm ₹62/kg, Vizag TMT Fe500 12mm ₹61/kg, JSPL TMT 10mm ₹63/kg, Kamdhenu TMT 16mm ₹60/kg, SAIL TMT 20mm ₹61/kg, Meenakshi TMT 8mm ₹60/kg
- Sand (4): River Sand ₹55/cft, Manufactured M-Sand ₹45/cft, Coarse Aggregate 20mm ₹38/cft, Fine Aggregate ₹50/cft
- Tiles (8): Kajaria 600x600 Matt ₹48/sqft, Somany 800x800 Glossy ₹65/sqft, Asian Granito 600x1200 ₹75/sqft, Johnson Floor 400x400 ₹35/sqft, Nitco Vitrified 600x600 ₹52/sqft, Kajaria Wall 300x450 ₹32/sqft, Orient Bell 300x600 ₹38/sqft, RAK 600x600 Polished ₹55/sqft
- Paints (6): Asian Paints Royale ₹285/L, Berger Silk ₹275/L, Dulux Velvet Touch ₹265/L, Asian Paints Tractor Emulsion ₹175/L, Berger WeatherCoat ₹220/L, Nerolac Excel Total ₹255/L

## DEMO STATE
- RFQ 1 (OPEN): Buyer 1 — 50 bags Ultratech OPC + 500kg Vizag TMT. No quotes yet.
- RFQ 2 (QUOTED): Buyer 2 — tiles for 2BHK. 2 quotes from Vendor 2 and Vendor 3.
- Order 1 (OUT_FOR_DELIVERY): Accepted from RFQ 2, Vendor 3.
- Order 2 (DELIVERED): Completed. 5-star review left by Buyer 1.

## Seed File / Command / Idempotency
- SEED FILE LOCATION: `apps/backend/prisma/seed.ts`
- SEED COMMAND: `cd apps/backend && pnpm prisma db seed`
- IDEMPOTENCY RULE: Use `upsert`, not `create`. Running seed twice = identical result.
