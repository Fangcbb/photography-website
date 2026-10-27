import { NavMain } from "@/modules/dashboard/ui/components/dashboard-sidebar/nav-main";

import { NavUser } from "@/modules/dashboard/ui/components/dashboard-sidebar/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { IconLivePhoto } from "@tabler/icons-react";
import { User } from "@/modules/auth/lib/auth-types";
import { getSession } from "@/modules/auth/lib/get-session";

const data = {
  navMain: [
    {
      title: "仪表盘",
      url: "/dashboard",
      icon: "dashboard",
    },
    {
      title: "城市",
      url: "/dashboard/cities",
      icon: "city",
    },
    {
      title: "照片",
      url: "/dashboard/photos",
      icon: "photo",
    },
    {
      title: "视频",
      url: "/dashboard/videos",
      icon: "video",
    },
    {
      title: "文章",
      url: "/dashboard/posts",
      icon: "post",
    },
    {
      title: "个人资料",
      url: "/dashboard/profile",
      icon: "user",
    },
    {
      title: "关于",
      url: "/dashboard/about",
      icon: "about",
    },
    {
      title: "维护",
      url: "/dashboard/maintenance",
      icon: "maintenance",
    },
    {
      title: "错误日志",
      url: "/dashboard/logs",
      icon: "logs",
    },
  ],
  navSecondary: [
    {
      title: "设置",
      url: "#",
    },
    {
      title: "帮助",
      url: "#",
    },
    {
      title: "搜索",
      url: "#",
    },
  ],
};

export const DashboardSidebar = async ({
  ...props
}: React.ComponentProps<typeof Sidebar>) => {
  const session = await getSession();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/">
                <IconLivePhoto />
                <span className="text-base font-semibold">摄影</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={session?.user as User} />
      </SidebarFooter>
    </Sidebar>
  );
};
