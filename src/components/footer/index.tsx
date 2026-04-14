import FooterNav from "./footer-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { siteConfig } from "@/site.config";

const Footer = () => {
  return (
    <div className="flex flex-col items-center lg:items-start p-16 pb-12 gap-8 lg:gap-16 rounded-xl font-light relative flex-1 bg-primary text-white dark:text-black">
      <div className="flex flex-col lg:flex-row gap-4 items-center">
        {/* AVATAR  */}
        <Avatar className="size-[60px]">
          <AvatarImage src={siteConfig.avatar} alt="avatar" sizes="60px" />
          <AvatarFallback>{siteConfig.initials}</AvatarFallback>
        </Avatar>

        {/* NAME  */}
        <div className="flex flex-col items-center lg:items-start gap-[2px]">
          <h1 className="text-2xl">{siteConfig.name}</h1>
          <p className="text-sm opacity-60">{siteConfig.role}</p>
        </div>
      </div>
      <div className="grid lg:w-full grid-cols-1 lg:grid-cols-3 gap-7 lg:gap-14">
        <FooterNav
          title="Pages"
          links={[
            { title: "Home", href: "/" },
            { title: "Travel", href: "/travel" },
            { title: "Discover", href: "/discover" },
            { title: "Music", href: "/music" },
            { title: "Blog", href: "/blog" },
            { title: "About", href: "/about" },
          ]}
        />
        <FooterNav
          title="CMS"
          links={[
            { title: "Dashboard", href: "/dashboard" },
            { title: "Game", href: "/tower" },
          ]}
        />
        <FooterNav
          title="Utility"
          links={[{ title: "Screensaver", href: "/screensaver" }]}
        />
      </div>

      {/* Attribution */}
      <div className="text-xs text-center md:text-left">
        <p className="opacity-40">
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-60 transition-opacity"
          >
            皖ICP备2026006629号
          </a>
        </p>
      </div>
    </div>
  );
};

export default Footer;
