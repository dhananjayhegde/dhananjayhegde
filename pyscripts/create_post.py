"""Create a dated Eleventy Markdown post and its static asset directory."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import unicodedata
from datetime import date
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def to_kebab_case(title: str) -> str:
    """Convert a post title to a filesystem-friendly kebab-case slug."""
    normalized = unicodedata.normalize("NFKD", title)
    ascii_title = normalized.encode("ascii", "ignore").decode("ascii")
    without_apostrophes = re.sub(r"['\u2018\u2019]", "", ascii_title)
    return re.sub(r"[^a-z0-9]+", "-", without_apostrophes.lower()).strip("-")


def run_git(*arguments: str) -> str:
    """Run Git in the project root and return its standard output."""
    try:
        result = subprocess.run(
            ["git", *arguments],
            cwd=PROJECT_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as error:
        raise RuntimeError("Git is not installed or is not available on PATH.") from error
    except subprocess.CalledProcessError as error:
        message = error.stderr.strip() or error.stdout.strip() or "Git command failed."
        raise RuntimeError(message) from error

    return result.stdout.strip()


def prepare_git_branch(slug: str) -> None:
    """Require a clean worktree and branch from main/master when appropriate."""
    if run_git("status", "--porcelain"):
        raise RuntimeError(
            "The current branch has uncommitted changes. "
            "Commit or stash them before creating a post."
        )

    current_branch = run_git("branch", "--show-current")
    if not current_branch:
        raise RuntimeError("Git is in detached HEAD state. Check out a branch first.")

    if current_branch in {"main", "master"}:
        run_git("switch", "-c", f"post/{slug}")


def create_post(title: str, today: date | None = None) -> Path:
    title = title.strip()
    if not title:
        raise ValueError("Post title cannot be empty.")

    slug = to_kebab_case(title)
    if not slug:
        raise ValueError("Post title must contain at least one letter or number.")

    prepare_git_branch(slug)

    post_date = today or date.today()
    year = post_date.strftime("%Y")
    month = post_date.strftime("%m")

    post_directory = PROJECT_ROOT / "posts" / year / month
    static_directory = PROJECT_ROOT / "static" / year / month
    post_directory.mkdir(parents=True, exist_ok=True)
    static_directory.mkdir(parents=True, exist_ok=True)

    post_path = post_directory / f"{slug}.md"
    front_matter = (
        "---\n"
        f"title: {json.dumps(title, ensure_ascii=False)}\n"
        f"date: {post_date.isoformat()}\n"
        "categories: []\n"
        "tags: []\n"
        'excerpt: ""\n'
        "---\n\n"
    )

    # Exclusive creation prevents an existing post from being overwritten.
    with post_path.open("x", encoding="utf-8", newline="\n") as post_file:
        post_file.write(front_matter)

    return post_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a new post using today's year, month, and date."
    )
    parser.add_argument("title", help='Post title (wrap it in quotes, e.g. "My Post")')
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        post_path = create_post(args.title)
    except (OSError, RuntimeError, ValueError) as error:
        raise SystemExit(f"Error: {error}") from error

    print(f"Created {post_path.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
