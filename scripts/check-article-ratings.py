#!/usr/bin/env python3
"""Release check: article feedback database migration, vote replacement and page hooks."""
from pathlib import Path
import os
import re
import sqlite3

db = sqlite3.connect(":memory:")
base = Path("services/feedback-worker")
db.executescript((base / "schema.sql").read_text(encoding="utf-8"))
migration = (base / "migrations/2026-11-06-article-ratings.sql").read_text(encoding="utf-8")
db.executescript(migration)
db.executescript(migration)  # migration must be safe to retry
names = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
assert {"feedback", "feedback_rate", "article_ratings", "article_rating_rate"} <= names

insert = """INSERT INTO article_ratings
  (id, entry_id, entry_title, voter_hash, vote, reason, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(entry_id, voter_hash) DO UPDATE SET
  entry_title = excluded.entry_title, vote = excluded.vote,
  reason = excluded.reason, updated_at = excluded.updated_at"""
db.execute(insert, ('v1','reimbursement','怎麼核銷','browserhash','helpful','','2026-11-06','2026-11-06'))
db.execute(insert, ('v2','reimbursement','怎麼核銷','browserhash','unresolved','needs_examples','2026-11-06','2026-11-06'))
rows = db.execute("SELECT vote, reason FROM article_ratings WHERE entry_id = 'reimbursement'").fetchall()
assert rows == [('unresolved','needs_examples')], rows
db.execute(insert, ('v3','income-withholding','預扣所得稅','browserhash2','helpful','','2026-11-06','2026-11-06'))
assert db.execute("SELECT COUNT(*) FROM article_ratings").fetchone()[0] == 2
try:
    db.execute(insert, ('v4','reimbursement','怎麼核銷','badreason','unresolved','invalid','2026-11-06','2026-11-06'))
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("Invalid reason accepted")

src = Path("src/pages/entries/[slug].astro").read_text(encoding="utf-8")
assert src.index("<ArticleRating") < src.index("{related.length"), "Feedback should precede related reading"
assert "<FeedbackWidget" in src, "Existing moderated reader notes must remain"
component = Path("src/components/ArticleRating.astro").read_text(encoding="utf-8")
assert "data-article-rating" in component and 'data-pagefind-ignore' in component
assert Path("public/scripts/article-rating.js").is_file(), "Missing client voting script"
admin = Path("src/pages/admin/feedback.astro").read_text(encoding="utf-8")
assert 'id="staff-rating-insights"' in admin and 'id="staff-items"' in admin
worker = (base / "src/index.js").read_text(encoding="utf-8")
for route in ("/api/ratings/availability", "/api/ratings", "/api/admin/ratings", "/api/comments", "/api/admin/comments"):
    assert route in worker, route

page = Path("dist/entries/reimbursement/index.html")
assert page.is_file(), "Build must generate the reimbursement entry"
html = page.read_text(encoding="utf-8")
if re.match(r"^https://[a-z0-9.-]+(?::\d+)?$", os.getenv("PUBLIC_FEEDBACK_API_URL",""), re.I):
    assert "data-article-rating" in html, "Configured API should render the availability-gated widget"
else:
    assert "data-article-rating" not in html, "Without an API, do not show an unusable widget"
print("PASS: rating schema, migration, upsert, existing comments, page placement and API routes")
