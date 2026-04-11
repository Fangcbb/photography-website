import {
  IconLayoutDashboard,
  IconPhoto,
  IconUser,
  IconBuildingPavilion,
  IconNotebook,
  IconVideo,
  IconMusic,
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
    default:
      return <IconLayoutDashboard />;
  }
};

export default IconMap;
