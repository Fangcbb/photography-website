import {
  IconLayoutDashboard,
  IconPhoto,
  IconUser,
  IconBuildingPavilion,
  IconNotebook,
  IconVideo,
  IconMusic,
  IconInfoCircle,
} from "@tabler/icons-react";

interface IconMapProps {
  icon: string;
}

const IconMap = ({ icon }: IconMapProps) => {
  switch (icon) {
    case "dashboard":
      return <IconLayoutDashboard />;
    case "photo":
      return <IconPhoto />;
    case "video":
      return <IconVideo />;
    case "user":
      return <IconUser />;
    case "city":
      return <IconBuildingPavilion />;
    case "post":
      return <IconNotebook />;
    case "music":
      return <IconMusic />;
    case "about":
      return <IconInfoCircle />;
    default:
      return <IconLayoutDashboard />;
  }
};

export default IconMap;
