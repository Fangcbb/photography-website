import { auth } from "@/modules/auth/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import SecurityAccessCard from "@/modules/auth/ui/components/security-access-card";

export const metadata = {
  title: "Security & Access",
};

const ProfilePage = async () => {
  const [session, activeSessions] = await Promise.all([
    auth.api.getSession({
      headers: await headers(),
    }),
    auth.api.listSessions({
      headers: await headers(),
    }),
  ]).catch(() => {
    throw redirect("/sign-in");
  });

  return (
    <div className="py-4 px-4 md:px-8 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">资料与安全</h1>
        <p className="text-sm text-muted-foreground">
          管理你的资料、密码和活跃会话
        </p>
      </div>

      {/* Active Sessions */}
      <div className="lg:col-span-2">
        <SecurityAccessCard
          session={JSON.parse(JSON.stringify(session))}
          activeSessions={JSON.parse(JSON.stringify(activeSessions))}
        />
      </div>
    </div>
  );
};

export default ProfilePage;
