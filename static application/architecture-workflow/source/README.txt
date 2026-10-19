Rebuild steps (run from the repository root)
1. py source/build.py           writes all HTML, SVG diagrams, assets/css/generated and assets/js/generated
                                (Linux/macOS: python3 source/build.py; tested with Python 3.14, needs 3.10+)
2. py tools/gen_docs.py         regenerates the screen mapping, navigation map, state machines and coverage docs
3. py -m unittest discover -s tests -p "test_*.py"   checks the build (see docs/guides/testing.md)

Prototype pieces in this folder
  htmltree.py      small HTML parser/serialiser used by the post-processing steps (exact round trip)
  postprocess.py   moves inline style attributes into assets/css/generated/extracted.css (CSP without unsafe-inline)
  proto_wiring.py  what each control in each mock does (navigation, actions, inputs); the build fails on a stale entry

PNG screenshots: shots.py / shot.py are the original Playwright scripts and still contain Linux paths
(/opt/pw-browsers/..., /home/claude/out/...). They were not used in the prototype phase; adjust CH and ROOT first.
Edit OUT in components.py, or set BLUEPRINT_OUT, to choose the output folder.
