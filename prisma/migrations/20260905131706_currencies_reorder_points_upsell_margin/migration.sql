-- AlterTable
ALTER TABLE "ApprovalConfig" ADD COLUMN     "upsellMinMarginPct" DOUBLE PRECISION NOT NULL DEFAULT 15;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'INR';

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "fxRate" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Stock" ADD COLUMN     "reorderPoint" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Currency" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "minorUnits" INTEGER NOT NULL DEFAULT 2,
    "rateFromBase" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isBase" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("code")
);

-- Seed the currency table before the foreign keys land. Every existing customer and quotation
-- already defaulted to 'INR', so that row has to exist or the constraints below cannot be added.
INSERT INTO "Currency" ("code", "name", "symbol", "locale", "minorUnits", "rateFromBase", "isBase") VALUES
    ('INR', 'Indian rupee',      '₹',  'en-IN', 2, 1,       true),
    ('USD', 'US dollar',         '$',  'en-US', 2, 0.012,   false),
    ('EUR', 'Euro',              '€',  'de-DE', 2, 0.011,   false),
    ('GBP', 'Pound sterling',    '£',  'en-GB', 2, 0.0094,  false),
    ('AED', 'UAE dirham',        'AED','en-AE', 2, 0.044,   false),
    ('SGD', 'Singapore dollar',  'S$', 'en-SG', 2, 0.016,   false),
    ('JPY', 'Japanese yen',      '¥',  'ja-JP', 0, 1.83,    false)
ON CONFLICT ("code") DO NOTHING;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
