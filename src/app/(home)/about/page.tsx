// External dependencies
import { type Metadata } from "next";

// Internal dependencies - UI Components
import Footer from "@/components/footer";
import AboutCard from "../../../modules/home/ui/components/about-card";
import TechMarquee from "@/components/tech-marquee";
import CameraCard from "../../../modules/home/ui/components/camera-card";
import ProfileCard from "../../../modules/home/ui/components/profile-card";
import CardContainer from "@/components/card-container";
import VectorCombined from "@/components/vector-combined";
import { siteConfig } from "@/site.config";
import { getAboutData } from "@/modules/about/lib/get-about-data";

export const metadata: Metadata = {
  title: "关于我 - 方斌的摄影作品集",
  description: "了解更多关于方斌，一位热爱记录生活和旅行美好瞬间的业余摄影师。探索我的摄影旅程、器材和创作过程。",
  keywords: [
    // 个人信息
    "摄影师简介",
    "关于我",
    "个人介绍",
    "摄影师故事",
    "摄影经历",
    "方斌",
    // 服务相关
    "摄影服务",
    "商业合作",
    "摄影约拍",
    "联系方式",
    "摄影咨询",
    // 地理位置
    "安徽摄影师",
    "中国摄影师",
    "安徽",
    // 其他
    "摄影器材",
    "摄影技巧",
    "摄影心得",
    "独立摄影师",
  ],
};

const AboutPage = async () => {
  const aboutData = await getAboutData();

  let gearList: { brand: string; model: string }[] = [];
  try {
    gearList = JSON.parse(aboutData.gear);
  } catch {
    gearList = siteConfig.gear;
  }

  return (
    <div className="flex flex-col gap-3 lg:gap-0 lg:flex-row w-full">
      {/* LEFT CONTENT - Fixed */}
      <div className="w-full h-[70vh] lg:w-1/2 lg:fixed lg:top-0 lg:left-0 lg:h-screen p-0 lg:p-3">
        <div className="w-full h-full relative bg-[url(/bg.jpg)] bg-top bg-cover rounded-xl">
          <div className="absolute right-0 bottom-0">
            <VectorCombined title="About" position="bottom-right" />
          </div>
        </div>
      </div>

      {/* Spacer for fixed left content */}
      <div className="hidden lg:block lg:w-1/2" />

      {/* RIGHT CONTENT - Scrollable */}
      <div className="w-full lg:w-1/2 space-y-3 pb-3">
        {/* PROFILE CARD  */}
        <ProfileCard
          name={aboutData.name}
          role={aboutData.role}
          bio={aboutData.bio}
          avatar={aboutData.avatar}
        />

        {/* ABOUT CARD  */}
        <AboutCard
          heading={aboutData.aboutHeading}
          paragraphs={aboutData.aboutParagraphs}
        />

        {/* TECH CARD  */}
        <TechMarquee />

        {/* CAMERA CARD  */}
        <CameraCard
          heading={aboutData.cameraHeading}
          subheading={aboutData.cameraSubheading}
          description={aboutData.cameraDescription}
        />

        {gearList.map((item) => (
          <CardContainer key={`${item.brand}-${item.model}`}>
            <div className="flex items-center justify-between p-6">
              <h1 className="text-lg">{item.brand}</h1>
              <p className="text-sm">{item.model}</p>
            </div>
          </CardContainer>
        ))}

        <Footer />
      </div>
    </div>
  );
};

export default AboutPage;
