import CardContainer from "@/components/card-container";

interface AboutCardProps {
  heading?: string;
  paragraphs?: string[];
}

const AboutCard = ({ heading = "About", paragraphs = [] }: AboutCardProps) => {
  return (
    <CardContainer>
      <div className="flex flex-col p-12 gap-[128px]">
        <h1 className="text-3xl">{heading}</h1>
        <div className="flex flex-col gap-4 font-light">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </CardContainer>
  );
};

export default AboutCard;
