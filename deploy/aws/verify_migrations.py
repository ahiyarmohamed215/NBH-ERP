"""Offline source/Git-index/JAR integrity check. Does not access any database."""
import re
import subprocess
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
sql = sorted((root / "src/main/resources/db/migration").glob("V*__*.sql"))
java = sorted((root / "src/main/java/db/migration").glob("V*__*.java"))
files = sql + java
versions = [int(re.match(r"V(\d+)__", path.name)[1]) for path in files]
assert len(files) == 53 and sorted(versions) == list(range(1, 54)), "Expected exactly V1-V53"
tracked = set(subprocess.check_output(["git", "ls-files"], cwd=root, text=True).splitlines())
for path in files:
    relative = path.relative_to(root).as_posix()
    assert relative in tracked, f"Migration missing from Git index: {relative}"
    indexed = subprocess.check_output(["git", "show", f":{relative}"], cwd=root)
    # Git may normalize Windows CRLF; SQL/Java content must otherwise remain identical.
    assert indexed.replace(b"\r\n", b"\n") == path.read_bytes().replace(b"\r\n", b"\n"), f"Unstaged migration edit: {relative}"
with zipfile.ZipFile(sys.argv[1]) as jar:
    names = set(jar.namelist())
    expected_sql = {f"BOOT-INF/classes/db/migration/{path.name}" for path in sql}
    assert {name for name in names if name.startswith("BOOT-INF/classes/db/migration/") and name.endswith(".sql")} == expected_sql, "Unexpected packaged SQL migrations"
    expected_java = {f"BOOT-INF/classes/db/migration/{path.stem}.class" for path in java}
    packaged_java = {name for name in names if re.fullmatch(r"BOOT-INF/classes/db/migration/V\d+__[^/$]+\.class", name)}
    assert packaged_java == expected_java, "Unexpected packaged Java migrations"
    for path in sql:
        assert jar.read(f"BOOT-INF/classes/db/migration/{path.name}") == path.read_bytes(), f"Packaged SQL mismatch: {path.name}"
    for path in java:
        assert f"BOOT-INF/classes/db/migration/{path.stem}.class" in names, f"Missing Java migration: {path.name}"
    assert "BOOT-INF/classes/application-prod.yml" in names, "Missing production profile"
print(f"PASS: {len(sql)} SQL + {len(java)} Java migrations; V1-V53 tracked and packaged; SQL bytes match source.")
