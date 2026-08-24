import DailyInspirationSection from "../components/DailyInspirationSection";
import HomeFeatureIcons from "../components/home/HomeFeatureIcons";
import HomeFilmLanyard from "../components/home/HomeFilmLanyard";
import HomeLogoMark from "../components/home/HomeLogoMark";
import HomePracticeCard from "../components/home/HomePracticeCard";
import { useAuth } from "../contexts/AuthContext";

function SketchHero() {
  return (
    <section className="container-page !pb-6 !pt-6 sm:!pb-8 sm:!pt-10 md:!pt-12">
      <HomeFeatureIcons />
      <HomeLogoMark />
    </section>
  );
}

export function LandingHome({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <main className="home-page">
      <HomeFilmLanyard />
      <SketchHero />
      <HomePracticeCard isAuthenticated={isAuthenticated} />
      <div id="daily-inspiration" className="scroll-mt-20 mt-5 sm:mt-6">
        <DailyInspirationSection />
      </div>
    </main>
  );
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  return <LandingHome isAuthenticated={isAuthenticated} />;
}
