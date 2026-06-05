import Header from "@/modules/home/ui/components/header";
import MouseFollowerProvider from "@/components/mouse-follower-provider";

const HomeLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Header />
      <main className="h-screen p-3">{children}</main>
      {/* 仅桌面端（≥1024px）启用鼠标跟随效果 */}
      <MouseFollowerProvider />
    </>
  );
};

export default HomeLayout;
