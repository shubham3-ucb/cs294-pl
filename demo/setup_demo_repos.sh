#!/usr/bin/env bash
# Builds the four live-demo repos for Tuesday (spec Appendix A) and self-checks them.
#   bash demo/setup_demo_repos.sh [target_dir]      (default: ~/git_week_demo)
# Re-running wipes and rebuilds the repos in target_dir. Needs git >= 2.28 (init -b).
#   monster/          one file, blank lines between panels   (T10 .git peek, T13 merge, T20)
#   monster-noblank/  same, no blank lines                    (backup for B1; B1 is a slide)
#   monster-files/    one file per panel                      (T21 ls-tree)
#   broken/           clean merge, broken program             (T15)
set -euo pipefail
T="${1:-$HOME/git_week_demo}"
mkdir -p "$T" && cd "$T"
rm -rf monster monster-noblank monster-files broken
q() { git -c advice.detachedHead=false "$@" >/dev/null 2>&1; }
id() { git config user.name "Lab 1"; git config user.email "lab1@example.com"; }

# 1. monster/
git init -q -b main monster && cd monster && id
printf 'face: smiley\n\nbody: box\n\nlegs: sticks\n' > monster.txt
q add monster.txt && q commit -m "base monster"
git branch cat-robot && git branch superhero
q switch cat-robot
printf 'face: cat\n\nbody: robot\n\nlegs: sticks\n' > monster.txt
q commit -am "cat face, robot body"
q switch superhero
printf 'face: smiley\n\nbody: superhero\n\nlegs: tentacles\n' > monster.txt
q commit -am "superhero body, tentacle legs"
q switch cat-robot
cd ..

# 2. monster-noblank/
git init -q -b main monster-noblank && cd monster-noblank && id
printf 'face: smiley\nbody: box\nlegs: sticks\n' > monster.txt
q add monster.txt && q commit -m "base monster"
git branch cat-robot && git branch superhero
q switch cat-robot
printf 'face: cat\nbody: robot\nlegs: sticks\n' > monster.txt
q commit -am "cat face, robot body"
q switch superhero
printf 'face: smiley\nbody: superhero\nlegs: tentacles\n' > monster.txt
q commit -am "superhero body, tentacle legs"
q switch cat-robot
cd ..

# 3. monster-files/
git init -q -b main monster-files && cd monster-files && id
echo smiley > face.txt; echo box > body.txt; echo sticks > legs.txt
q add . && q commit -m "base monster"
git branch cat-robot && git branch superhero
q switch cat-robot;  echo cat > face.txt; echo robot > body.txt; q commit -am "cat face, robot body"
q switch superhero;  echo superhero > body.txt; echo tentacles > legs.txt; q commit -am "superhero body, tentacle legs"
q switch cat-robot
cd ..

# 4. broken/
git init -q -b main broken && cd broken && id
printf 'def draw():\n    print("monster")\n\ndef main():\n    pass\n\nmain()\n' > m.py
q add m.py && q commit -m base
git branch rename && git branch caller
q switch rename; sed -i 's/def draw():/def render():/' m.py; q commit -am "rename draw -> render"
q switch caller; sed -i 's/    pass/    draw()/' m.py; q commit -am "main calls draw"
q switch rename
cd ..

# ---- self-check on throwaway clones (the demo repos stay un-merged for class)
CHK="$(mktemp -d)"; ok=1
check() { if eval "$2"; then echo "  ok   $1"; else echo "  FAIL $1"; ok=0; fi; }
git clone -q monster "$CHK/m" && (cd "$CHK/m" && id && q switch cat-robot && q branch superhero origin/superhero \
  && { git merge superhero >/dev/null 2>&1 || true; } && grep -c '^<<<<<<<' monster.txt > ../m.n)
check "monster: merge conflicts on BODY only (1 block)" '[ "$(cat $CHK/m.n)" = 1 ] && grep -q "^face: cat" $CHK/m/monster.txt && grep -q "^legs: tentacles" $CHK/m/monster.txt'
git clone -q monster-noblank "$CHK/n" && (cd "$CHK/n" && id && q switch cat-robot && q branch superhero origin/superhero \
  && { git merge superhero >/dev/null 2>&1 || true; })
check "monster-noblank: one block covering all three lines" '[ "$(grep -c "^<<<<<<<" $CHK/n/monster.txt)" = 1 ] && [ "$(head -c 7 $CHK/n/monster.txt)" = "<<<<<<<" ]'
check "monster-files: legs.txt blob a27e19c on main and cat-robot" '[ "$(cd monster-files && git rev-parse main:legs.txt | cut -c1-7)" = a27e19c ] && [ "$(cd monster-files && git rev-parse cat-robot:legs.txt | cut -c1-7)" = a27e19c ]'
check "hash-object: face: smiley -> 946ac5d" '[ "$(echo "face: smiley" | git hash-object --stdin | cut -c1-7)" = 946ac5d ]'
git clone -q broken "$CHK/b" && (cd "$CHK/b" && id && q switch rename && q branch caller origin/caller && q merge --no-edit caller)
out="$(python3 "$CHK/b/m.py" 2>&1 || true)"
check "broken: clean merge, then NameError" '[ -z "$(grep -l "<<<<<<<" $CHK/b/m.py)" ] && [[ "$out" == *NameError* ]]'
rm -rf "$CHK"
echo "Demo repos in $T: monster/ monster-noblank/ monster-files/ broken/"
[ "$ok" = 1 ] && echo "All checks passed." || { echo "Some checks FAILED"; exit 1; }
