import { Link } from "react-router-dom";
import vectorBorderSvg from "../../SVG/Vector.svg?url";
import HomeDrawnButton from "./HomeDrawnButton";

type HomePracticeCardProps = {
  isAuthenticated: boolean;
};

export default function HomePracticeCard({ isAuthenticated }: HomePracticeCardProps) {
  return (
    <section className="container-page !pb-12 !pt-2 sm:!pb-16" aria-labelledby="home-practice-title">
      <div className="home-practice-card animate-fade-up">
        <div className="home-practice-card-frame">
          <div className="home-practice-card-inner">
            <p className="home-practice-card-eyebrow">今日摄影练习</p>

            <h2 id="home-practice-title" className="home-practice-card-title">
              把一张喜欢的照片，再往前推一步。
            </h2>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
            src={vectorBorderSvg}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="home-practice-card-border"
          />
        </div>
      </div>
    </section>
  );
}
