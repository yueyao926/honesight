import argparse

from app.database import SessionLocal
from app.services.inspiration_content import CONTENT_VERSION
from app.services.inspiration_sync import backfill_outdated_content, count_outdated_content


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill outdated inspiration copy and rebuild today's cache.")
    parser.add_argument("--batch-size", type=int, default=200)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    with SessionLocal() as db:
        pending = count_outdated_content(db)
        if args.dry_run:
            print(f"content_version={CONTENT_VERSION} pending={pending}")
            return
        result = backfill_outdated_content(db, batch_size=args.batch_size)
        print(
            f"content_version={CONTENT_VERSION} pending={result.pending} "
            f"updated={result.updated} cleared_today={result.cleared_recommendations}"
        )


if __name__ == "__main__":
    main()
