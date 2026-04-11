import CardContainer from "@/components/card-container";

const AboutCard = () => {
  return (
    <CardContainer>
      <div className="flex flex-col p-12 gap-[128px]">
        <h1 className="text-3xl">About</h1>
        <div className="flex flex-col gap-4 font-light">
          <p>
            To me, photography is defined by content, not equipment or specs.
            Its value lies not in high pixels or soft bokeh, but in the emotions,
            stories, and vision a photograph carries.
          </p>

          <p>
            Gear sets the upper limit of image quality, but the depth and soul
            of a work are always decided by the eye and mind behind the lens.
            The person behind the camera matters more than the camera itself.
          </p>

          <p>
            I respect the role of good equipment, but reject gear-obsession.
            No one remembers a photo for its camera brand—but people never
            forget a powerful story.
          </p>
        </div>
      </div>
    </CardContainer>
  );
};

export default AboutCard;
