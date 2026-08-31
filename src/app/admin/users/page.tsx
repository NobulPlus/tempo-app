import { listProfiles } from "@/lib/data/repo";
import { UserModerationList } from "@/components/admin/user-moderation-list";

export default async function AdminUsersPage() {
  const profiles = await listProfiles();

  return (
    <div>
      <h1 className="text-[26px] font-bold">User moderation</h1>
      <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
        Review roles, suspended accounts and trust signals that affect host confidence.
        Reputation is earned through games, so moderation should preserve that signal.
      </p>
      <p className="mt-2 text-[13px] font-semibold text-ink-muted">
        {profiles.length} user{profiles.length === 1 ? "" : "s"} in Tempo
      </p>

      <div className="mt-6">
        <UserModerationList profiles={profiles} />
      </div>
    </div>
  );
}
