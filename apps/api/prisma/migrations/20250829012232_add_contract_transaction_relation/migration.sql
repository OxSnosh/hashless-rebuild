/*
  Warnings:

  - You are about to drop the column `name` on the `Contract` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[chain,address]` on the table `Contract` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[chain,hash]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_contractId_fkey";

-- DropIndex
DROP INDEX "Contract_address_key";

-- DropIndex
DROP INDEX "Transaction_blockNumber_idx";

-- DropIndex
DROP INDEX "Transaction_fromAddress_idx";

-- DropIndex
DROP INDEX "Transaction_hash_key";

-- DropIndex
DROP INDEX "Transaction_toAddress_idx";

-- AlterTable
ALTER TABLE "Contract" DROP COLUMN "name";

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "chain" TEXT NOT NULL DEFAULT 'ethereum',
ALTER COLUMN "contractId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Contract_chain_address_key" ON "Contract"("chain", "address");

-- CreateIndex
CREATE INDEX "Transaction_blockNumber_chain_idx" ON "Transaction"("blockNumber", "chain");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_chain_hash_key" ON "Transaction"("chain", "hash");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
