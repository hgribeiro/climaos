-- Existing memberships are deliberately not granted administrative privileges.
CREATE TYPE "MembershipRole" AS ENUM ('ADMIN', 'TECHNICIAN');
ALTER TABLE "Membership" ADD COLUMN "role" "MembershipRole" NOT NULL DEFAULT 'TECHNICIAN';
CREATE TABLE "Location" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Location_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Location_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Location_customerId_organizationId_fkey" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Location_organizationId_customerId_idx" ON "Location"("organizationId", "customerId");
ALTER TABLE "Location" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Location" FROM anon, authenticated;
