import CardContainer from "@/components/card-container";

interface CameraCardProps {
  heading?: string;
  subheading?: string;
  description?: string;
}

const CameraCard = ({
  heading = "Camera",
  subheading = "Camera Lenses",
  description = "I have a passion for photography and camera lenses. I use a variety of lenses to capture the beauty of nature and people in their different moments.",
}: CameraCardProps) => {
  return (
    <CardContainer>
      <div className="flex flex-col p-12 gap-[128px]">
        <div className="flex flex-col text-3xl">
          <h1>{heading}</h1>
          <h1>{subheading}</h1>
        </div>

        <div className="font-light">
          <p>{description}</p>
        </div>
      </div>
    </CardContainer>
  );
};

export default CameraCard;
