import { MarqueeCard } from "./marquee-card";
import {
  SiReact,
  SiNextdotjs,
  SiTailwindcss,
  SiTypescript,
  SiTrpc,
  SiReactquery,
  SiShadcnui,
  SiVercel,
  SiCloudflare,
  SiDrizzle,
} from "react-icons/si";
import { IconType } from "react-icons";

const technologies: { name: string; icon: IconType }[] = [
  { name: "React", icon: SiReact },
  { name: "Next.js", icon: SiNextdotjs },
  { name: "Tailwind", icon: SiTailwindcss },
  { name: "TypeScript", icon: SiTypescript },
  { name: "tRPC", icon: SiTrpc },
  { name: "React Query", icon: SiReactquery },
  { name: "shadcn/ui", icon: SiShadcnui },
  { name: "Vercel", icon: SiVercel },
  { name: "Cloudflare", icon: SiCloudflare },
  { name: "Drizzle", icon: SiDrizzle },
];

function TechMarquee() {
  return (
    <MarqueeCard pauseOnHover>
      {technologies.map((tech) => (
        <div key={tech.name} className="flex items-center gap-2 text-lg font-medium">
          <tech.icon className="w-6 h-6" />
          <span>{tech.name}</span>
        </div>
      ))}
    </MarqueeCard>
  );
}

export default TechMarquee;
