import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { relativeTime } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

export const metadata: Metadata = { title: "Users" };

const ROLE_LABEL: Record<string, string> = {
  SALES_REP: "Sales rep",
  SALES_MANAGER: "Sales manager",
  FINANCE: "Finance",
  ADMIN: "Admin",
};

/** Anyone who registered after the seed ran is a real signup rather than a demo account. */
const SEEDED = new Set([
  "priya@dealflow.local",
  "arjun@dealflow.local",
  "meera@dealflow.local",
  "vikram@dealflow.local",
  "admin@dealflow.local",
]);

export default async function UsersPage() {
  const viewer = await requireSessionUser();
  // Platform-wide visibility belongs to the admin alone (§3 User Roles), so this is not a
  // page a manager may read at all — hidden in the nav and refused here.
  if (!can(viewer, "users:view")) notFound();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { quotations: true, approvals: true } },
    },
  });

  const signups = users.filter((u) => !SEEDED.has(u.email));

  return (
    <Card>
      <div className="px-5 pt-4 pb-2">
        <h2>People with access</h2>
        <p className="text-[13px] text-muted">
          Everyone who can sign in, newest first. Anyone who registers at{" "}
          <span className="num">/signup</span> appears here immediately, with the role they chose.
          {signups.length > 0
            ? ` ${signups.length} ${signups.length === 1 ? "account has" : "accounts have"} been created since the demo data was seeded.`
            : " No accounts have been created since the demo data was seeded."}
        </p>
      </div>
      <div className="overflow-x-auto px-5 pb-5">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th className="num">Quotations</th>
              <th className="num">Approvals acted</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSignup = !SEEDED.has(u.email);
              return (
                <tr key={u.id}>
                  <td className="font-medium">
                    {u.name}
                    {isSignup ? (
                      <Pill tone="primary" className="ml-2">
                        New
                      </Pill>
                    ) : null}
                    {u.id === viewer.id ? <span className="ml-2 text-[12px] text-muted">you</span> : null}
                  </td>
                  <td className="num text-muted">{u.email}</td>
                  <td>{ROLE_LABEL[u.role] ?? u.role}</td>
                  {/* A brand-new account owns nothing — which is the point: the desk starts empty. */}
                  <td className={u._count.quotations === 0 ? "num text-faint" : "num"}>{u._count.quotations}</td>
                  <td className={u._count.approvals === 0 ? "num text-faint" : "num"}>{u._count.approvals}</td>
                  <td className="text-muted">{relativeTime(u.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
