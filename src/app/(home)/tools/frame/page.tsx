import type { Metadata } from "next";
import FrameWorkshop from "./frame-workshop";

export const metadata: Metadata = {
  title: "边框工坊 — 免费在线照片胶片边框",
  description:
    "在浏览器中为照片添加胶片边框：135、半格、XPan、120 6×6/6×7/6×12、宝丽来、画廊卡纸等预设，支持四边独立宽度与自定义颜色。照片不上传服务器。",
};

export default function Page() {
  return <FrameWorkshop />;
}
