import { AccountUser } from "@/types/user";

export default function AccProfile({ user }: { user: AccountUser | null }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">Profile</h2>

      <div className="w-full max-w-md">
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/10">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Field</th>
                <th className="px-4 py-2 text-left font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-4 py-2 font-medium">Name</td>
                <td className="px-4 py-2">{user?.name || "—"}</td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-2 font-medium">Email</td>
                <td className="px-4 py-2">{user?.email || "—"}</td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-2 font-medium">User ID</td>
                <td className="px-4 py-2">{user?.id || "—"}</td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-2 font-medium">Created At</td>
                <td className="px-4 py-2">
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
