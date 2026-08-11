import { Link } from "react-router-dom";
import practiceCardBorderSvg from "../../SVG/Vector (3).svg?url";
import practicePeepSvg from "../../SVG/练习.svg?url";
import cameraBodySvg from "../../SVG/camera_body_only.svg?url";
import cameraStarsSvg from "../../SVG/camera_stars_only.svg?url";
import HomeDrawnButton from "./HomeDrawnButton";

type HomePracticeCardProps = {
  isAuthenticated: boolean;
};

export default function HomePracticeCard({ isAuthenticated }: HomePracticeCardProps) {
  return (
    <section className="container-page !pb-4 !pt-4 sm:!pb-5 sm:!pt-5" aria-labelledby="home-practice-title">
      <div className="home-practice-card animate-fade-up">
        <div className="home-practice-card-frame">
          <div className="home-practice-card-inner">
            <p className="home-practice-card-eyebrow home-practice-title-row">
              <span>本周摄影练习</span>              <span className="home-practice-title-icons" aria-hidden="true">
                <img src={practicePeepSvg} alt="" draggable={false} className="home-practice-icon-peep" />
                <span className="home-practice-icon-camera">
                  <img src={cameraBodySvg} alt="" draggable={false} className="home-practice-camera-base" />
                  <img src={cameraStarsSvg} alt="" draggable={false} className="home-practice-camera-stars" />
                </span>
              </span>
            </p>

            <h2 id="home-practice-title" className="home-practice-card-title">
              把一张喜欢的照片，再往前推一步。
            </h2>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="home-drawn-btn-group flex flex-wrap">
                {isAuthenticated ? (
                  <>
                    <HomeDrawnButton to="/ai">上传分析</HomeDrawnButton>
                    <HomeDrawnButton href="#daily-inspiration">今日灵感</HomeDrawnButton>
                  </>
                ) : (
                  <>
                    <Link to="/register" className="btn-primary min-w-[7.5rem] justify-center px-5">
                      开始注册
                    </Link>
                    <HomeDrawnButton to="/login">登录</HomeDrawnButton>
                    <HomeDrawnButton href="#daily-inspiration">今日灵感</HomeDrawnButton>
                  </>
                )}
              </div>

              <HomeDrawnButton
                to={isAuthenticated ? "/practice" : "/register"}
                variant="box2"
                className="home-practice-card-cta"
              >
                推荐练习
              </HomeDrawnButton>
            </div>
          </div>

          <img
            src={practiceCardBorderSvg}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="home-practice-card-border"
          />        </div>
      </div>
    </section>
  );
}
