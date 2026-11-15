-- All operational access goes through the server's privileged database connection.
-- No client policies: anon/authenticated cannot read or write these tables via PostgREST.
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Equipment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Organization", "Membership", "Customer", "Equipment" FROM anon, authenticated;
