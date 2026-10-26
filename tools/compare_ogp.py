#!/usr/bin/env python3
"""Compare owner/group/permissions of two directory trees. Only shows files with differences."""

import os
import stat
import sys
import pwd
import grp


def get_info(path):
    s = os.stat(path)
    try:
        owner = pwd.getpwuid(s.st_uid).pw_name
    except KeyError:
        owner = str(s.st_uid)
    try:
        group = grp.getgrgid(s.st_gid).gr_name
    except KeyError:
        group = str(s.st_gid)
    mode = stat.filemode(s.st_mode)
    return owner, group, mode


def collect_paths(base):
    paths = set()
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d != ".git"]
        rel = root.replace(base, "", 1).lstrip("/")
        for f in files + dirs:
            paths.add(os.path.join(rel, f))
    return paths


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <path1> <path2>")
        sys.exit(1)

    base1, base2 = sys.argv[1], sys.argv[2]
    paths1 = collect_paths(base1)
    paths2 = collect_paths(base2)
    all_paths = sorted(paths1 | paths2)

    found = False
    for rel in all_paths:
        p1 = os.path.join(base1, rel)
        p2 = os.path.join(base2, rel)

        if rel not in paths1 or rel not in paths2:
            continue

        i1 = get_info(p1)
        i2 = get_info(p2)

        if i1 != i2:
            print(f"DIFF  {rel}")
            print(f"       {base1}: owner={i1[0]} group={i1[1]} mode={i1[2]}")
            print(f"       {base2}: owner={i2[0]} group={i2[1]} mode={i2[2]}")
            found = True

    if not found:
        print("No differences found.")


if __name__ == "__main__":
    main()
