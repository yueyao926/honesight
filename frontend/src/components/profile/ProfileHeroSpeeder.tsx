import "./ProfileHeroSpeeder.css";

export default function ProfileHeroSpeeder() {
  return (
    <div className="profile-hero-speeder" aria-hidden="true">
      <div className="profile-hero-speeder__loader">
        <span>
          <span />
          <span />
          <span />
          <span />
        </span>
        <div className="profile-hero-speeder__base">
          <span />
          <div className="profile-hero-speeder__face" />
        </div>
      </div>
      <div className="profile-hero-speeder__longfazers">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
