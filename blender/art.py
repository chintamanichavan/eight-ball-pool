"""Renders the game's art: the empty table in each city's cloth, and the six cues.

    blender -b --factory-startup -P blender/art.py

Writes one table-<city>.webp per city and one cue-<name>.webp per cue, in
web/public/art/. All are seen
from straight above with a see-through background, so the page can lay balls,
guide lines and the cue over the table.

Each table picture shows 2.8 m across its width, centred on the cloth. The page
relies on that scale to line the balls up with the pockets.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import concept  # noqa: E402  (the shared table and cue models)

OUT = os.path.join(concept.ROOT, "web", "public", "art")


def main():
    os.makedirs(OUT, exist_ok=True)

    # One table per city, each in its own cloth.
    for city, cloth in concept.CITIES.items():
        scene = concept.scene_setup(2400, 1350, 160)
        concept.build_table(cloth)
        concept.camera(scene, (0, 0, 6), (0, 0, 0), ortho_scale=2.8)
        scene.render.filepath = os.path.join(OUT, f"table-{city}.webp")
        concept.bpy.ops.render.render(write_still=True)

    # Each cue alone: 1.6 m across the picture, tip at the left. A cue turns
    # with the player's aim, so it must carry no baked shadow: the floor that
    # would catch one is removed.
    for spec in concept.CUES:
        scene = concept.scene_setup(1600, 100, 160)
        for obj in [o for o in scene.objects if o.type == "MESH"]:
            concept.bpy.data.objects.remove(obj)
        concept.build_cue(2.5, spec)  # index 2.5 puts it on the centre line
        concept.camera(scene, (0, 0, 6), (0, 0, 0), ortho_scale=1.6)
        scene.render.filepath = os.path.join(OUT, f"cue-{spec['name']}.webp")
        concept.bpy.ops.render.render(write_still=True)

main()
