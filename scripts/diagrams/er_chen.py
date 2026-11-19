"""Draws the CareerLens ER diagram in Chen notation as an A4-landscape PNG (300 dpi).
Usage: python er_chen.py out.png"""
import sys, math
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
W, H = 3508, 2480          # A4 landscape @ 300 dpi; 1 unit = 1 output pixel
S = 2                      # supersampling
FONT = 'C:/Windows/Fonts/arial.ttf'
FONTB = 'C:/Windows/Fonts/arialbd.ttf'
_fc = {}
def font(size, bold=False):
    k = (size, bold)
    if k not in _fc:
        _fc[k] = ImageFont.truetype(FONTB if bold else FONT, int(size * S))
    return _fc[k]
def P(v):
    return int(round(v * S))

INK = (17, 24, 39)
ENT_FILL, ENT_LINE = (219, 234, 254), (30, 64, 175)
REL_FILL, REL_LINE = (254, 243, 199), (180, 83, 9)
ATT_LINE = (55, 65, 81)
CARD = (185, 28, 28)
GREY = (75, 85, 99)

F_ENT = font(40, True)     # ~10pt
F_REL = font(32, True)     # ~8pt
F_ATT = font(31)           # ~7.5pt
F_CARD = font(40, True)

tmp = ImageDraw.Draw(Image.new('RGB', (10, 10)))
def tw(text, f):
    b = tmp.textbbox((0, 0), text, font=f)
    return (b[2] - b[0]) / S, (b[3] - b[1]) / S, b[1] / S

# ---------------------------------------------------------------- shape sizes
def ent_half(name):
    w, _, _ = tw(name, F_ENT)
    return w / 2 + 34, 40
IDENT = {l for _, l, _, i, _, _ in []}
def rel_half(label):
    w, _, _ = tw(label, F_REL)
    extra = 20 if label.startswith('HAS_') and label.endswith('_EMB') else 0
    return w / 2 + 62 + extra, 58 + extra * 0.25
def att_half(name):
    w, _, _ = tw(name, F_ATT)
    return w / 2 + 26, 32

# ---------------------------------------------------------------- model
E = {  # name: (x, y, weak, [(attr, kind)])  kind: pk | '' | derived
    'USER': (1680, 400, False, [('user_id', 'pk'), ('email', ''), ('password_hash', ''), ('role', ''), ('created_at', '')]),
    'CANDIDATE': (760, 830, False, [('candidate_id', 'pk'), ('full_name', ''), ('phone', ''), ('location', ''), ('education', ''),
                                     ('years_experience', ''), ('summary', ''), ('resume_text', ''), ('updated_at', '')]),
    'RECRUITER': (2560, 830, False, [('recruiter_id', 'pk'), ('full_name', ''), ('designation', '')]),
    'COMPANY': (3080, 1230, False, [('company_id', 'pk'), ('name', ''), ('industry', ''), ('location', ''), ('website', '')]),
    'SKILL': (1680, 1150, False, [('skill_id', 'pk'), ('name', ''), ('category', '')]),
    'JOB': (2440, 1640, False, [('job_id', 'pk'), ('title', ''), ('description', ''), ('location', ''), ('salary_min', ''),
                                ('salary_max', ''), ('openings', ''), ('deadline', ''), ('status', ''), ('created_at', ''),
                                ('search_vector', 'derived')]),
    'APPLICATION': (1060, 1700, False, [('application_id', 'pk'), ('status', ''), ('match_score', ''), ('applied_at', '')]),
    'STATUS_HISTORY': (1060, 2110, False, [('history_id', 'pk'), ('old_status', ''), ('new_status', ''), ('changed_at', '')]),
    'RESUME_EMBEDDING': (330, 1560, True, [('embedding', ''), ('model_name', ''), ('updated_at', '')]),
    'JOB_EMBEDDING': (3262, 1640, True, [('embedding', ''), ('model_name', ''), ('updated_at', '')]),
}
# key, label, pos or None (midpoint), identifying, [(entity, cardinality, total participation)], [attributes]
R = [
    ('HAS_C', 'HAS_PROFILE', (1180, 610), False, [('USER', '1', False), ('CANDIDATE', '1', True)], []),
    ('HAS_R', 'HAS_PROFILE', (2160, 610), False, [('USER', '1', False), ('RECRUITER', '1', True)], []),
    ('WORKS_FOR', 'WORKS_FOR', (2900, 1010), False, [('RECRUITER', 'N', True), ('COMPANY', '1', False)], []),
    ('POSTS', 'POSTS', (2470, 1230), False, [('RECRUITER', '1', False), ('JOB', 'N', True)], []),
    ('OFFERS', 'OFFERS', (2830, 1450), False, [('COMPANY', '1', False), ('JOB', 'N', True)], []),
    ('HAS_SKILL', 'HAS_SKILL', (1220, 990), False, [('CANDIDATE', 'M', False), ('SKILL', 'N', False)], ['proficiency', 'years_used']),
    ('REQUIRES', 'REQUIRES', (2040, 1400), False, [('JOB', 'M', False), ('SKILL', 'N', False)], ['weight', 'is_mandatory']),
    ('SUBMITS', 'SUBMITS', (900, 1270), False, [('CANDIDATE', '1', False), ('APPLICATION', 'N', True)], []),
    ('RECEIVES', 'RECEIVES', (1760, 1690), False, [('JOB', '1', False), ('APPLICATION', 'N', True)], []),
    ('LOGS', 'LOGS', (1060, 1905), False, [('APPLICATION', '1', False), ('STATUS_HISTORY', 'N', True)], []),
    ('RESUME_OF', 'HAS_RESUME_EMB', (470, 1200), True, [('CANDIDATE', '1', False), ('RESUME_EMBEDDING', '1', True)], []),
    ('JOBEMB_OF', 'HAS_JOB_EMB', (2812, 1640), True, [('JOB', '1', False), ('JOB_EMBEDDING', '1', True)], []),
]
for i, (k, l, pos, idn, ends, at) in enumerate(R):
    if pos is None:
        a, b = E[ends[0][0]], E[ends[1][0]]
        R[i] = (k, l, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), idn, ends, at)

# ---------------------------------------------------------------- geometry helpers
def ang(p, q):
    return math.degrees(math.atan2(-(q[1] - p[1]), q[0] - p[0])) % 360
def angdist(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)

def place(n, blocked, clear):
    allowed = [a for a in range(360) if all(angdist(a, b) >= clear for b in blocked)] or list(range(360))
    runs, run = [], [allowed[0]]
    for a in allowed[1:]:
        if a == run[-1] + 1:
            run.append(a)
        else:
            runs.append(run); run = [a]
    runs.append(run)
    if len(runs) > 1 and runs[0][0] == 0 and runs[-1][-1] == 359:
        runs[0] = runs[-1] + runs[0]; runs.pop()
    total = sum(len(r) for r in runs)
    counts = [round(n * len(r) / total) for r in runs]
    while sum(counts) > n:
        counts[counts.index(max(counts))] -= 1
    while sum(counts) < n:
        i = max(range(len(runs)), key=lambda i: len(runs[i]) / (counts[i] + 1))
        counts[i] += 1
    out = []
    for r, c in zip(runs, counts):
        out += [r[int((k + 0.5) * len(r) / c)] for k in range(c)]
    return out

def seg_dist(p, a, b):
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy or 1
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L2))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy), (px - cx, py - cy)

# ---------------------------------------------------------------- initial attribute placement
links = {k: [] for k in E}
rel_segments = []   # entity <-> diamond lines (attributes must keep clear of these)
for k, l, pos, idn, ends, at in R:
    for en, _, _ in ends:
        links[en].append(ang(E[en][:2], pos))
        rel_segments.append((E[en][:2], pos))

_below = [(900 * math.cos(math.radians(a)), -440 * math.sin(math.radians(a))) for a in range(205, 326, 15)]
MANUAL = {  # (dx, dy) offsets from the entity centre, in attribute order; these ovals stay pinned
    'JOB': [(-136, -256)] + _below + [(185, -282)],
    'JOB_EMBEDDING': [(95, -150), (-115, 120), (125, 150)],
}
nodes = []  # movable attribute ovals: dict(owner, x, y, hw, hh, name, kind)
for name, (x, y, weak, attrs) in E.items():
    if name in MANUAL:
        for (an, kind), (dx, dy) in zip(attrs, MANUAL[name]):
            hw, hh = att_half(an)
            nodes.append(dict(owner=(x, y), x=x + dx, y=y + dy, hw=hw, hh=hh, name=an, kind=kind, pinned=True))
        continue
    angles = place(len(attrs), links[name], 30)
    # PK goes to the free angle closest to straight up
    pk_i = min(range(len(angles)), key=lambda i: angdist(angles[i], 90))
    angles = [angles[pk_i]] + [a for i, a in enumerate(angles) if i != pk_i]
    ehw, ehh = ent_half(name)
    for i, ((an, kind), a) in enumerate(zip(attrs, angles)):
        hw, hh = att_half(an)
        r = 150 + max(ehw, ehh) * 0.6 + (90 if len(attrs) > 5 and i % 2 else 0)
        nodes.append(dict(owner=(x, y), x=x + r * math.cos(math.radians(a)) * 1.2,
                          y=y - r * math.sin(math.radians(a)), hw=hw, hh=hh, name=an, kind=kind))
for k, l, pos, idn, ends, at in R:
    if not at:
        continue
    angles = place(len(at), [ang(pos, E[en][:2]) for en, _, _ in ends], 50)
    for an, a in zip(at, angles):
        hw, hh = att_half(an)
        nodes.append(dict(owner=pos, x=pos[0] + 230 * math.cos(math.radians(a)),
                          y=pos[1] - 150 * math.sin(math.radians(a)), hw=hw, hh=hh, name=an, kind=''))

fixed = [(x, y) + ent_half(n) for n, (x, y, _, _) in E.items()] + [pos + rel_half(l) for _, l, pos, _, _, _ in R]

# ---------------------------------------------------------------- relax overlaps
TOP, BOTTOM, LEFT, RIGHT = 150, H - 230, 30, W - 30
GAP = 16
for it in range(600):
    moved = 0
    # attribute vs attribute
    for i in range(len(nodes)):
        a = nodes[i]
        for j in range(i + 1, len(nodes)):
            b = nodes[j]
            ox = a['hw'] + b['hw'] + GAP - abs(a['x'] - b['x'])
            oy = a['hh'] + b['hh'] + GAP - abs(a['y'] - b['y'])
            if ox > 0 and oy > 0:
                moved += 1
                pa, pb = a.get('pinned'), b.get('pinned')
                if pa and pb:
                    continue
                fa, fb = (0, 1) if pa else (1, 0) if pb else (0.5, 0.5)
                if ox < oy * 1.6:
                    s = 1 if a['x'] >= b['x'] else -1
                    a['x'] += s * ox * fa; b['x'] -= s * ox * fb
                else:
                    s = 1 if a['y'] >= b['y'] else -1
                    a['y'] += s * oy * fa; b['y'] -= s * oy * fb
    for a in nodes:
        if a.get('pinned'):
            continue
        # vs entities / diamonds
        for fx, fy, fw, fh in fixed:
            ox = a['hw'] + fw + GAP - abs(a['x'] - fx)
            oy = a['hh'] + fh + GAP - abs(a['y'] - fy)
            if ox > 0 and oy > 0:
                moved += 1
                if ox < oy:
                    a['x'] += ox if a['x'] >= fx else -ox
                else:
                    a['y'] += oy if a['y'] >= fy else -oy
        # vs relationship lines
        for s0, s1 in rel_segments:
            if a['owner'] in (s0, s1):
                continue
            dist, (vx, vy) = seg_dist((a['x'], a['y']), s0, s1)
            need = a['hh'] + 14
            if dist < need:
                moved += 1
                L = dist or 1
                a['x'] += vx / L * (need - dist) * 0.8
                a['y'] += vy / L * (need - dist) * 0.8
        # gentle spring toward owner (keeps the fan compact)
        dx, dy = a['x'] - a['owner'][0], a['y'] - a['owner'][1]
        dist = math.hypot(dx, dy)
        if dist > 380:
            a['x'] -= dx / dist * 3; a['y'] -= dy / dist * 3
        # page bounds
        a['x'] = min(max(a['x'], LEFT + a['hw']), RIGHT - a['hw'])
        a['y'] = min(max(a['y'], TOP + a['hh']), BOTTOM - a['hh'])
    if moved == 0 and it > 50:
        break
print('relaxation iterations:', it, 'remaining conflicts:', moved)

# ---------------------------------------------------------------- draw
img = Image.new('RGB', (P(W), P(H)), 'white')
d = ImageDraw.Draw(img)

def seg(p, q, fill=INK, width=3):
    d.line([(P(p[0]), P(p[1])), (P(q[0]), P(q[1]))], fill=fill, width=P(width))
def double_seg(p, q, fill=INK, gap=6):
    dx, dy = q[0] - p[0], q[1] - p[1]
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L * gap, dx / L * gap
    seg((p[0] + nx, p[1] + ny), (q[0] + nx, q[1] + ny), fill, 2.6)
    seg((p[0] - nx, p[1] - ny), (q[0] - nx, q[1] - ny), fill, 2.6)
def text_center(x, y, text, f, fill=INK, underline=False):
    w, h, top = tw(text, f)
    tx, ty = x - w / 2, y - h / 2 - top
    d.text((P(tx), P(ty)), text, font=f, fill=fill)
    if underline:
        uy = y + h / 2 + 5
        d.line([(P(tx), P(uy)), (P(tx + w), P(uy))], fill=fill, width=P(2.4))
def entity(x, y, name, weak):
    bw, bh = ent_half(name)
    d.rectangle([P(x - bw), P(y - bh), P(x + bw), P(y + bh)], fill=ENT_FILL, outline=ENT_LINE, width=P(4))
    if weak:
        g = 10
        d.rectangle([P(x - bw + g), P(y - bh + g), P(x + bw - g), P(y + bh - g)], outline=ENT_LINE, width=P(3))
    text_center(x, y, name, F_ENT)
def relation(x, y, label, ident):
    hw, hh = rel_half(label)
    d.polygon([(P(x), P(y - hh)), (P(x + hw), P(y)), (P(x), P(y + hh)), (P(x - hw), P(y))],
              fill=REL_FILL, outline=REL_LINE, width=P(4))
    if ident:
        g = 13
        d.polygon([(P(x), P(y - hh + g)), (P(x + hw - g * 2), P(y)), (P(x), P(y + hh - g)), (P(x - hw + g * 2), P(y))],
                  outline=REL_LINE, width=P(3))
    text_center(x, y, label, F_REL)
def attribute(x, y, name, kind, hw=None, hh=None):
    if hw is None:
        hw, hh = att_half(name)
    box = [P(x - hw), P(y - hh), P(x + hw), P(y + hh)]
    d.ellipse(box, fill='white')
    if kind == 'derived':
        for a0 in range(0, 360, 14):
            d.arc(box, a0, a0 + 8, fill=ATT_LINE, width=P(3))
    else:
        d.ellipse(box, outline=ATT_LINE, width=P(3))
    text_center(x, y, name, F_ATT, underline=(kind == 'pk'))

# lines first
for a in nodes:
    seg(a['owner'], (a['x'], a['y']), ATT_LINE, 2.4)
cards = []
for k, l, pos, idn, ends, at in R:
    for en, card, total in ends:
        e = E[en][:2]
        (double_seg if total else seg)(e, pos)
        dx, dy = pos[0] - e[0], pos[1] - e[1]
        L = math.hypot(dx, dy) or 1
        t = 0.55
        cards.append((e[0] + dx * t - dy / L * 30, e[1] + dy * t + dx / L * 30, card))
# shapes on top
for a in nodes:
    attribute(a['x'], a['y'], a['name'], a['kind'], a['hw'], a['hh'])
for k, l, pos, idn, ends, at in R:
    relation(pos[0], pos[1], l, idn)
for n, (x, y, weak, _) in E.items():
    entity(x, y, n, weak)
for x, y, c in cards:
    text_center(x, y, c, F_CARD, fill=CARD)

# title
d.text((P(50), P(30)), 'CareerLens — ER Diagram (Chen notation)', font=font(56, True), fill=INK)
d.text((P(52), P(100)), 'Job, Skill and Recruitment Management System', font=font(30), fill=GREY)

# legend (one row along the bottom)
ly = H - 120
d.line([(P(40), P(ly - 70)), (P(W - 40), P(ly - 70))], fill=(209, 213, 219), width=P(2))
x = 60
d.text((P(x), P(ly - 20)), 'Legend:', font=font(32, True), fill=INK); x += 170
entity(x + 85, ly, 'Entity', False); x += 220
entity(x + 85, ly, 'Weak', True); x += 230
relation(x + 120, ly, 'Relation', False); x += 280
relation(x + 140, ly, 'Identifying', True); x += 320
attribute(x + 90, ly, 'attribute', ''); x += 220
attribute(x + 85, ly, 'key_attr', 'pk'); x += 210
attribute(x + 80, ly, 'derived', 'derived'); x += 210
seg((x, ly), (x + 90, ly)); d.text((P(x + 100), P(ly - 18)), 'partial', font=F_ATT, fill=INK); x += 230
double_seg((x, ly), (x + 90, ly)); d.text((P(x + 100), P(ly - 18)), 'total participation', font=F_ATT, fill=INK); x += 380
d.text((P(x), P(ly - 18)), '1 / N / M = cardinality', font=font(31, True), fill=CARD)
d.text((P(60), P(ly + 62)),
       'search_vector = GENERATED tsvector (derived).  RESUME_EMBEDDING / JOB_EMBEDDING are weak entities identified by their owner.',
       font=font(26), fill=GREY)

img = img.resize((W, H), Image.LANCZOS)
img.save(OUT, dpi=(300, 300))
print('saved', OUT, img.size)
