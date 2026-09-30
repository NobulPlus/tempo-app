-- 0001_init.sql calls uuid_generate_v4() unqualified. Installing straight
-- into "public" (always on every role's search_path) sidesteps any
-- per-project/per-role search_path differences entirely, rather than
-- relying on "extensions" being searched, which isn't guaranteed.
create extension if not exists "uuid-ossp" with schema public;
create extension if not exists btree_gist with schema public;
