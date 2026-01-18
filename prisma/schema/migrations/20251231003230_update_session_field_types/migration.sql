/*
  Warnings:

  - The primary key for the `sessions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `sessions` table. All the data in the column will be lost.
  - You are about to alter the column `secure_address` on the `sessions` table. The data in that column could be lost. The data in that column will be cast from `ByteA` to `VarChar(640)`.
  - You are about to alter the column `identifier` on the `sessions` table. The data in that column could be lost. The data in that column will be cast from `ByteA` to `VarChar(16)`.
  - You are about to alter the column `key` on the `sessions` table. The data in that column could be lost. The data in that column will be cast from `ByteA` to `VarChar(32)`.

*/
-- AlterTable
ALTER TABLE "ares"."sessions" DROP CONSTRAINT "sessions_pkey",
DROP COLUMN "id",
ALTER COLUMN "secure_address" SET DATA TYPE VARCHAR(640),
ALTER COLUMN "identifier" SET DATA TYPE VARCHAR(16),
ALTER COLUMN "key" SET DATA TYPE VARCHAR(32),
ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("identifier");
