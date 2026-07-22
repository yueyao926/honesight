import { Link } from "react-router-dom";

export default function BackHomeLink() {
  return (
    <Link className="inline-flex items-center gap-2 text-sm text-muted transition hover:-translate-x-0.5 hover:text-ink" to="/">
      <span aria-hidden="true">←</span>
      返回首页
    </Link>
  );
}
