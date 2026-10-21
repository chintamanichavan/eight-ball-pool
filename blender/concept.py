"""Concept renders for the design page: the table from above and from a seat.

    blender -b --factory-startup -P blender/concept.py

Writes the pictures in docs/concept/: the table from above and from a seat,
one small table per city, and the row of cues. These show the intended look.
They are not game art yet: the balls carry no numbers.
"""

import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "concept")

# An 8-foot table: the playing surface is 2.24 m by 1.12 m. Units are metres.
LENGTH, WIDTH = 2.24, 1.12
RAIL = 0.13
BALL = 0.0286  # radius
POCKET = 0.062

# Each city has its own cloth. The cushions are the same cloth, a shade darker.
CITIES = {
    "chicago": (0.10, 0.40, 0.25),
    "mumbai": (0.09, 0.36, 0.33),
    "tokyo": (0.14, 0.20, 0.47),
    "marrakech": (0.56, 0.21, 0.16),
    "reykjavik": (0.32, 0.40, 0.46),
}

# The six cues, plainest first. All share a maple shaft and a dark wrap.
#   butt, ring   colours of the handle and of the rings either side of the wrap
#   points       colour of the long spears on the forearm, a mark of a made cue
#   inlay        what is set into the handle: (kind, colour); kinds are "rings",
#                "dashes", "diamonds" and "stripe"
#   glow         how brightly the rings, inlays and points shine (0 is not at all)
#   fade         a second handle colour that the first blends into towards the end
CUES = [
    {"name": "house", "butt": (0.62, 0.45, 0.28), "ring": (0.20, 0.14, 0.09)},
    {"name": "lakeshore", "butt": (0.08, 0.15, 0.36), "ring": (0.85, 0.86, 0.88),
     "points": (0.08, 0.15, 0.36), "inlay": ("rings", (0.85, 0.86, 0.88))},
    {"name": "monsoon", "butt": (0.05, 0.36, 0.34), "ring": (0.84, 0.64, 0.22),
     "points": (0.05, 0.36, 0.34), "inlay": ("dashes", (0.84, 0.64, 0.22))},
    {"name": "neon", "butt": (0.05, 0.05, 0.07), "ring": (1.0, 0.12, 0.62),
     "points": (0.05, 0.05, 0.07), "inlay": ("stripe", (1.0, 0.12, 0.62)), "glow": 2.5},
    {"name": "atlas", "butt": (0.56, 0.13, 0.10), "ring": (0.90, 0.70, 0.22),
     "points": (0.90, 0.70, 0.22), "inlay": ("diamonds", (0.90, 0.70, 0.22))},
    {"name": "aurora", "butt": (0.88, 0.95, 0.97), "ring": (0.20, 0.92, 0.82),
     "points": (0.20, 0.92, 0.82), "inlay": ("stripe", (0.55, 0.40, 0.98)), "glow": 2.0,
     "fade": (0.45, 0.78, 0.95)},
]
WOOD = (0.86, 0.77, 0.63)
POCKET_DARK = (0.03, 0.035, 0.035)

COLOURS = {
    1: (0.96, 0.75, 0.10), 2: (0.11, 0.30, 0.75), 3: (0.85, 0.13, 0.15), 4: (0.42, 0.20, 0.60),
    5: (0.95, 0.45, 0.10), 6: (0.10, 0.52, 0.30), 7: (0.50, 0.12, 0.14), 8: (0.05, 0.05, 0.05),
}

# A position partway through a game: (number, x, y). Zero is the cue ball.
LAYOUT = [
    (0, -0.45, -0.12), (3, 0.35, 0.22), (1, 0.60, -0.30), (8, 0.05, 0.30), (10, -0.80, 0.35),
    (12, 0.75, 0.05), (5, -0.20, -0.40), (14, 0.90, -0.42), (7, -0.90, -0.20),
]


def linear(srgb):
    def channel(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (*(channel(c) for c in srgb), 1.0)


def plain(name, srgb, roughness):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = linear(srgb)
    shader.inputs["Roughness"].default_value = roughness
    return mat


def glowing(name, srgb, strength):
    """A colour that also gives off its own light."""
    mat = plain(name, srgb, 0.3)
    shader = mat.node_tree.nodes["Principled BSDF"]
    shader.inputs["Emission Color"].default_value = linear(srgb)
    shader.inputs["Emission Strength"].default_value = strength
    return mat


def mottled(name, srgb, depth, scale, stretch=(1.0, 1.0, 1.0)):
    """A colour broken up by fine noise: the nap of cloth, or the grain of wood.

    `depth` is how much darker the dark patches are; `stretch` pulls the noise
    out along an axis, which turns blotches into grain.
    """
    mat = plain(name, srgb, 0.9)
    tree = mat.node_tree
    shader = tree.nodes["Principled BSDF"]
    coords = tree.nodes.new("ShaderNodeTexCoord")
    mapping = tree.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = stretch
    noise = tree.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 6.0
    mix = tree.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = linear(tuple(c * (1.0 - depth) for c in srgb))
    mix.inputs["B"].default_value = linear(srgb)
    tree.links.new(coords.outputs["Object"], mapping.inputs["Vector"])
    tree.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    tree.links.new(noise.outputs["Fac"], mix.inputs["Factor"])
    tree.links.new(mix.outputs["Result"], shader.inputs["Base Color"])
    return mat


def flat_shape(name, points, mat, location):
    """A flat polygon lying level, from a list of (x, y) corners."""
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(x, y, 0.0) for x, y in points], [], [list(range(len(points)))])
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    obj.location = location
    bpy.context.scene.collection.objects.link(obj)
    return obj


def flat_ring(name, inner, outer, mat, location, steps=48):
    """A flat ring lying level."""
    verts, faces = [], []
    for i in range(steps):
        angle = i * math.tau / steps
        verts.append((outer * math.cos(angle), outer * math.sin(angle), 0.0))
        verts.append((inner * math.cos(angle), inner * math.sin(angle), 0.0))
    for i in range(steps):
        j = (i + 1) % steps
        faces.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    obj.location = location
    bpy.context.scene.collection.objects.link(obj)
    return obj


def striped(name, srgb):
    """White ball with a band of colour around its middle."""
    mat = plain(name, srgb, 0.12)
    tree = mat.node_tree
    shader = tree.nodes["Principled BSDF"]
    coords = tree.nodes.new("ShaderNodeTexCoord")
    split = tree.nodes.new("ShaderNodeSeparateXYZ")
    size = tree.nodes.new("ShaderNodeMath")
    size.operation = "ABSOLUTE"
    inside = tree.nodes.new("ShaderNodeMath")
    inside.operation = "LESS_THAN"
    inside.inputs[1].default_value = BALL * 0.52
    mix = tree.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = linear((0.95, 0.94, 0.90))
    mix.inputs["B"].default_value = linear(srgb)
    tree.links.new(coords.outputs["Object"], split.inputs[0])
    tree.links.new(split.outputs["Y"], size.inputs[0])
    tree.links.new(size.outputs[0], inside.inputs[0])
    tree.links.new(inside.outputs[0], mix.inputs["Factor"])
    tree.links.new(mix.outputs["Result"], shader.inputs["Base Color"])
    return mat


def box(name, size, location, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("soft", "BEVEL")
        mod.width = bevel
        mod.segments = 4
    return obj


def pocket_centres():
    """Corner pockets sit a little inside the corner; side pockets a little outside the rail line."""
    half = LENGTH / 2
    for x in (-half, 0, half):
        for y in (-WIDTH / 2, WIDTH / 2):
            if x:
                yield (x - math.copysign(0.012, x), y - math.copysign(0.012, y))
            else:
                yield (0.0, y + math.copysign(0.022, y))


def build_table(cloth):
    felt = mottled("felt", cloth, 0.07, 900.0)
    cushion = mottled("cushion", tuple(c * 0.84 for c in cloth), 0.07, 900.0)
    wood = mottled("wood", WOOD, 0.13, 26.0, stretch=(0.05, 1.0, 1.0))
    wood.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.45
    dark = plain("pocket", POCKET_DARK, 0.9)
    leather = plain("leather", (0.16, 0.10, 0.07), 0.7)
    pearl = plain("pearl", (0.96, 0.95, 0.90), 0.3)

    outer_l, outer_w = LENGTH + 2 * RAIL, WIDTH + 2 * RAIL
    half = LENGTH / 2
    cut = []  # everything a pocket is cut out of

    box("frame", (outer_l, outer_w, 0.10), (0, 0, -0.03), wood, 0.02)
    cut.append(box("bed", (LENGTH + 0.1, WIDTH + 0.1, 0.02), (0, 0, 0.012), felt))

    # Felt cushions next to the cloth, with a raised wooden rail outside them.
    wood_w = RAIL - 0.05
    for side in (-1, 1):
        cut.append(box("cushion", (LENGTH, 0.05, 0.03), (0, side * (WIDTH / 2 + 0.025), 0.037), cushion, 0.006))
        cut.append(box("cushion", (0.05, WIDTH, 0.03), (side * (half + 0.025), 0, 0.037), cushion, 0.006))
        cut.append(box("rail", (outer_l, wood_w, 0.04), (0, side * (WIDTH / 2 + 0.05 + wood_w / 2), 0.038), wood, 0.012))
        # The end rails fit between the side rails, so no two rails overlap.
        cut.append(box("rail", (wood_w, WIDTH + 0.1, 0.04), (side * (half + 0.05 + wood_w / 2), 0, 0.038), wood, 0.012))

    # One hidden shape holding all six pockets, cut out of the parts above.
    cutters = []
    for x, y in pocket_centres():
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=POCKET, depth=0.3, location=(x, y, 0.1))
        cutters.append(bpy.context.object)
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=POCKET, depth=0.002, location=(x, y, 0.0205))
        bpy.context.object.data.materials.append(dark)
    bpy.ops.object.select_all(action="DESELECT")
    for cutter in cutters:
        cutter.select_set(True)
    bpy.context.view_layer.objects.active = cutters[0]
    bpy.ops.object.join()
    pockets = bpy.context.object
    pockets.hide_render = True
    for part in cut:
        hole = part.modifiers.new("pockets", "BOOLEAN")
        hole.operation = "DIFFERENCE"
        hole.object = pockets
        # The cut has to come before the rounded edges.
        while part.modifiers[0] != hole:
            with bpy.context.temp_override(object=part):
                bpy.ops.object.modifier_move_up(modifier=hole.name)
    add_table_details(leather, pearl)


def add_table_details(leather, pearl):
    """The small things that make it read as a pool table: a leather lip round
    each pocket, and the pearl sights players aim by, three between pockets."""
    rail_top = 0.0585
    for x, y in pocket_centres():
        flat_ring("pocket lip", POCKET - 0.002, POCKET + 0.009, leather, (x, y, rail_top))

    half = LENGTH / 2
    rail_middle = 0.05 + (RAIL - 0.05) / 2
    diamond = [(0.011, 0.0), (0.0, 0.006), (-0.011, 0.0), (0.0, -0.006)]
    upright_diamond = [(py, px) for px, py in diamond]
    for side in (-1, 1):
        for k in (1, 2, 3):
            for end in (-1, 1):
                flat_shape("sight", diamond, pearl, (end * k * LENGTH / 8, side * (WIDTH / 2 + rail_middle), rail_top))
        for k in (-1, 0, 1):
            flat_shape("sight", upright_diamond, pearl, (side * (half + rail_middle), k * WIDTH / 4, rail_top))


def build_balls():
    white = plain("cue ball", (0.96, 0.95, 0.91), 0.12)
    for number, x, y in LAYOUT:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=BALL, location=(x, y, 0.022 + BALL))
        ball = bpy.context.object
        bpy.ops.object.shade_smooth()
        if number == 0:
            ball.data.materials.append(white)
        elif number <= 8:
            ball.data.materials.append(plain(f"ball {number}", COLOURS[number], 0.12))
        else:
            ball.data.materials.append(striped(f"ball {number}", COLOURS[number - 8]))
            ball.rotation_euler = (math.radians(18), 0, math.radians(number * 37))


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def cue_radius(x):
    """How thick a cue is at `x`: it tapers evenly from the butt to the tip."""
    return 0.0092 + (x + 0.74) / 1.47 * 0.0135


def build_cue(index, spec):
    """A cue lying along x, tip at the left, a little thicker than life so its parts show."""
    glow = spec.get("glow", 0.0)
    lit = (lambda name, colour: glowing(name, colour, glow)) if glow else (lambda name, colour: plain(name, colour, 0.25))
    maple = mottled("maple", (0.90, 0.78, 0.55), 0.08, 30.0, stretch=(0.04, 1.0, 1.0))
    maple.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.4
    butt = plain("butt", spec["butt"], 0.28)
    ring = lit("ring", spec["ring"])
    wrap = mottled("wrap", (0.11, 0.11, 0.12), 0.35, 500.0)
    tip = plain("tip", (0.25, 0.42, 0.62), 0.9)
    ferrule = plain("ferrule", (0.95, 0.94, 0.90), 0.3)

    y = (2.5 - index) * 0.085
    top = 0.05  # height of the cue's centre line

    def length_of(start, end, mat, swell=0.0):
        """One length of the cue, following its taper. `swell` makes a ring stand proud."""
        bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=cue_radius(start) + swell, radius2=cue_radius(end) + swell,
                                        depth=end - start, location=((start + end) / 2, y, top),
                                        rotation=(0, math.radians(90), 0))
        bpy.context.object.data.materials.append(mat)
        bpy.ops.object.shade_smooth()

    length_of(-0.74, -0.73, tip)
    length_of(-0.73, -0.70, ferrule)
    length_of(-0.70, 0.02, maple)
    length_of(0.02, 0.045, ring, 0.0008)
    length_of(0.045, 0.30, wrap)
    length_of(0.30, 0.325, ring, 0.0008)
    if "fade" in spec:
        # The handle shades from one colour to the other in five lengths.
        for i in range(5):
            share = i / 4
            colour = tuple(a + (b - a) * share for a, b in zip(spec["butt"], spec["fade"]))
            length_of(0.325 + i * 0.075, 0.325 + (i + 1) * 0.075, plain("butt", colour, 0.28))
    else:
        length_of(0.325, 0.70, butt)
    length_of(0.70, 0.725, ring, 0.0008)
    length_of(0.725, 0.735, plain("bumper", (0.06, 0.06, 0.06), 0.9))

    # Everything below is seen from above, so it is laid flat just over the cue.
    def over(x):
        return (x, y, top + cue_radius(0.735) + 0.001)

    if "points" in spec:
        # Three spears running from the wrap up the forearm.
        mat = lit("points", spec["points"])
        for offset, reach in ((0.0, 0.30), (0.0085, 0.22), (-0.0085, 0.22)):
            half = 0.0042
            flat_shape("point", [(0.0, offset + half), (-reach, offset), (0.0, offset - half)], mat, over(0.02))

    kind, colour = spec.get("inlay", (None, None))
    mat = lit("inlay", colour) if kind else None
    if kind == "rings":
        for x in (0.40, 0.44, 0.48, 0.60, 0.64):
            length_of(x, x + 0.008, mat, 0.0006)
    elif kind == "dashes":
        for i, x in enumerate((0.37, 0.43, 0.49, 0.55, 0.61, 0.67)):
            lean = 0.004 if i % 2 else -0.004
            flat_shape("dash", [(-0.016, lean - 0.0022), (0.016, -lean - 0.0022), (0.016, -lean + 0.0022), (-0.016, lean + 0.0022)], mat, over(x))
    elif kind == "diamonds":
        for x in (0.39, 0.46, 0.53, 0.60, 0.67):
            flat_shape("diamond", [(0.02, 0.0), (0.0, 0.0085), (-0.02, 0.0), (0.0, -0.0085)], mat, over(x))
    elif kind == "stripe":
        flat_shape("stripe", [(-0.16, -0.0022), (0.16, -0.0022), (0.16, 0.0022), (-0.16, 0.0022)], mat, over(0.51))


def scene_setup(width=1600, height=900, samples=160):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.view_settings.view_transform = "Standard"
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.quality = 90

    world = bpy.data.worlds.new("page")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45
    scene.world = world

    data = bpy.data.lights.new("lamp", "AREA")
    data.energy = 85
    data.size = 2.2
    lamp = bpy.data.objects.new("lamp", data)
    lamp.location = (-0.4, 0.5, 2.6)
    scene.collection.objects.link(lamp)
    aim(lamp, (0, 0, 0))

    # An unseen floor that only catches the table's shadow, so the picture
    # can sit on any page colour.
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, -0.08))
    bpy.context.object.is_shadow_catcher = True
    return scene


def camera(scene, location, target, ortho_scale=None, lens=50):
    data = bpy.data.cameras.new("camera")
    if ortho_scale:
        data.type = "ORTHO"
        data.ortho_scale = ortho_scale
    data.lens = lens
    cam = bpy.data.objects.new("camera", data)
    cam.location = location
    scene.collection.objects.link(cam)
    aim(cam, target)
    scene.camera = cam


def render_to(scene, name):
    scene.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    render_cues()
    if "--cues-only" in sys.argv:
        return

    scene = scene_setup()
    build_table(CITIES["mumbai"])
    build_balls()
    # From straight above: 2.8 m of table across the picture. The page lays
    # its aiming guide over this one, so the scale matters.
    camera(scene, (0, 0, 6), (0, 0, 0), ortho_scale=2.8)
    render_to(scene, "table-top.webp")
    camera(scene, (-1.9, -1.75, 1.15), (0.05, 0.02, 0.0), lens=42)
    render_to(scene, "table-seat.webp")

    for city, cloth in CITIES.items():
        scene = scene_setup(800, 450, 96)
        build_table(cloth)
        build_balls()
        camera(scene, (0, 0, 6), (0, 0, 0), ortho_scale=2.8)
        render_to(scene, f"city-{city}.webp")



def render_cues():
    scene = scene_setup(1600, 580, 128)
    for index, spec in enumerate(CUES):
        build_cue(index, spec)
    camera(scene, (0, 0, 6), (0, 0, 0), ortho_scale=1.62)
    render_to(scene, "cues.webp")


if __name__ == "__main__":
    main()
