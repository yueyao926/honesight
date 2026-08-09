import personSvg from "../../SVG/person.svg?url";
import cameraSvg from "../../SVG/camera_lineart_extracted.svg?url";
import SquigglyText from "../ui/SquigglyText";

export default function HomeLogoMark() {
  return (
    <div className="mt-10 flex flex-col items-center gap-8 sm:mt-12 md:mt-14">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center sm:gap-8 md:gap-10 lg:gap-12">
        <div className="flex flex-col items-center text-center">
          <h1>
            <SquigglyText
              as="span"
              stepDuration={70}
              scale={[3, 5]}
              baseFrequency={0.018}
              className="home-logo-type whitespace-nowrap text-[3.5rem] text-ink sm:text-[4.5rem] md:text-[5.5rem] lg:text-[6.5rem]"
            >
              LENSCOACH
            </SquigglyText>
          </h1>
          <p className="home-logo-tagline mt-3 whitespace-nowrap sm:mt-4">
            learn to see. learn to shoot.
          </p>
        </div>

        <div className="relative flex shrink-0 items-end justify-center gap-1 sm:gap-2" aria-hidden="true">
          <img
            src={personSvg}
            alt=""
            className="h-[7.5rem] w-auto object-contain sm:h-32 md:h-36"
            draggable={false}
          />
          <img
            src={cameraSvg}
            alt=""
            className="h-28 w-auto object-contain sm:h-36 md:h-44"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
