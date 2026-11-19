"""Draws the CareerLens relational schema (Elmasri/Navathe style) as an A4-landscape PNG (300 dpi).
Row 1 = column names (PK solid underline, FK dotted underline), row 2 = type + constraints.
Arrows go from each FK column to the PK column it references."""
import sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
S = 4  # supersampling factor
FONT = 'C:/Windows/Fonts/arial.ttf'
FONTB = 'C:/Windows/Fonts/arialbd.ttf'
FONTI = 'C:/Windows/Fonts/ariali.ttf'
_fc = {}
def font(size, style=''):
    key = (size, style)
    if key not in _fc:
        path = {'': FONT, 'b': FONTB, 'i': FONTI}[style]
        _fc[key] = ImageFont.truetype(path, int(size * S))
    return _fc[key]

def P(v):  # logical -> pixel
    return int(round(v * S))

# ---------------------------------------------------------------- schema
# (column, type, constraint, is_pk, fk_target)
T = [
    ('USERS', '', [
        ('user_id', 'INT', 'IDENTITY', True, None),
        ('email', 'VARCHAR(255)', 'UNIQUE, NOT NULL, CHECK', False, None),
        ('password_hash', 'VARCHAR(255)', 'NOT NULL (bcrypt)', False, None),
        ('role', 'user_role ENUM', 'NOT NULL', False, None),
        ('created_at', 'TIMESTAMPTZ', 'DEFAULT now()', False, None),
    ]),
    ('COMPANIES', '', [
        ('company_id', 'INT', 'IDENTITY', True, None),
        ('name', 'VARCHAR(150)', 'UNIQUE, NOT NULL', False, None),
        ('industry', 'VARCHAR(100)', '', False, None),
        ('location', 'VARCHAR(100)', '', False, None),
        ('website', 'VARCHAR(200)', '', False, None),
    ]),
    ('SKILLS', '', [
        ('skill_id', 'INT', 'IDENTITY', True, None),
        ('name', 'VARCHAR(80)', 'UNIQUE, NOT NULL', False, None),
        ('category', 'VARCHAR(50)', 'NOT NULL', False, None),
    ]),
    ('CANDIDATES', '', [
        ('candidate_id', 'INT', 'IDENTITY', True, None),
        ('user_id', 'INT', 'UNIQUE, NOT NULL', False, ('USERS', 'user_id')),
        ('full_name', 'VARCHAR(120)', 'NOT NULL', False, None),
        ('phone', 'VARCHAR(15)', 'CHECK (regex)', False, None),
        ('location', 'VARCHAR(100)', '', False, None),
        ('education', 'VARCHAR(150)', '', False, None),
        ('years_experience', 'NUMERIC(3,1)', 'CHECK >= 0', False, None),
        ('summary', 'TEXT', '', False, None),
        ('resume_text', 'TEXT', 'NOT NULL', False, None),
        ('updated_at', 'TIMESTAMPTZ', 'DEFAULT now()', False, None),
    ]),
    ('RECRUITERS', '', [
        ('recruiter_id', 'INT', 'IDENTITY', True, None),
        ('user_id', 'INT', 'UNIQUE, NOT NULL', False, ('USERS', 'user_id')),
        ('company_id', 'INT', 'NOT NULL', False, ('COMPANIES', 'company_id')),
        ('full_name', 'VARCHAR(120)', 'NOT NULL', False, None),
        ('designation', 'VARCHAR(80)', '', False, None),
    ]),
    ('JOBS', 'CHECK (salary_min <= salary_max)', [
        ('job_id', 'INT', 'IDENTITY', True, None),
        ('recruiter_id', 'INT', 'NOT NULL', False, ('RECRUITERS', 'recruiter_id')),
        ('company_id', 'INT', 'NOT NULL', False, ('COMPANIES', 'company_id')),
        ('title', 'VARCHAR(150)', 'NOT NULL', False, None),
        ('description', 'TEXT', 'NOT NULL', False, None),
        ('location', 'VARCHAR(100)', '', False, None),
        ('salary_min', 'INT', 'CHECK >= 0', False, None),
        ('salary_max', 'INT', '', False, None),
        ('openings', 'SMALLINT', 'CHECK > 0', False, None),
        ('deadline', 'DATE', 'NOT NULL', False, None),
        ('status', 'job_status ENUM', "DEFAULT 'open'", False, None),
        ('created_at', 'TIMESTAMPTZ', 'DEFAULT now()', False, None),
        ('search_vector', 'TSVECTOR', 'GENERATED', False, None),
    ]),
    ('CANDIDATE_SKILLS', '', [
        ('candidate_id', 'INT', 'NOT NULL', True, ('CANDIDATES', 'candidate_id')),
        ('skill_id', 'INT', 'NOT NULL', True, ('SKILLS', 'skill_id')),
        ('proficiency', 'SMALLINT', 'CHECK 1 to 5', False, None),
        ('years_used', 'NUMERIC(3,1)', 'CHECK >= 0', False, None),
    ]),
    ('JOB_SKILLS', '', [
        ('job_id', 'INT', 'NOT NULL', True, ('JOBS', 'job_id')),
        ('skill_id', 'INT', 'NOT NULL', True, ('SKILLS', 'skill_id')),
        ('weight', 'SMALLINT', 'CHECK 1 to 5', False, None),
        ('is_mandatory', 'BOOLEAN', 'DEFAULT false', False, None),
    ]),
    ('APPLICATIONS', 'UNIQUE (candidate_id, job_id)', [
        ('application_id', 'INT', 'IDENTITY', True, None),
        ('candidate_id', 'INT', 'NOT NULL', False, ('CANDIDATES', 'candidate_id')),
        ('job_id', 'INT', 'NOT NULL', False, ('JOBS', 'job_id')),
        ('status', 'app_status ENUM', "DEFAULT 'applied'", False, None),
        ('match_score', 'NUMERIC(5,2)', 'CHECK 0 to 100', False, None),
        ('applied_at', 'TIMESTAMPTZ', 'DEFAULT now()', False, None),
    ]),
    ('APPLICATION_STATUS_HISTORY', '', [
        ('history_id', 'INT', 'IDENTITY', True, None),
        ('application_id', 'INT', 'NOT NULL', False, ('APPLICATIONS', 'application_id')),
        ('old_status', 'app_status ENUM', '', False, None),
        ('new_status', 'app_status ENUM', 'NOT NULL', False, None),
        ('changed_at', 'TIMESTAMPTZ', 'DEFAULT now()', False, None),
    ]),
    ('RESUME_EMBEDDINGS', '', [
        ('candidate_id', 'INT', 'NOT NULL', True, ('CANDIDATES', 'candidate_id')),
        ('embedding', 'VECTOR(384)', 'NOT NULL', False, None),
        ('model_name', 'VARCHAR(60)', '', False, None),
        ('updated_at', 'TIMESTAMPTZ', 'DEFAULT now()', False, None),
    ]),
    ('JOB_EMBEDDINGS', '', [
        ('job_id', 'INT', 'NOT NULL', True, ('JOBS', 'job_id')),
        ('embedding', 'VECTOR(384)', 'NOT NULL', False, None),
        ('model_name', 'VARCHAR(60)', '', False, None),
        ('updated_at', 'TIMESTAMPTZ', 'DEFAULT now()', False, None),
    ]),
]

COLORS = {  # one colour per referenced table
    'USERS': (37, 99, 235), 'COMPANIES': (217, 119, 6), 'SKILLS': (5, 150, 105),
    'CANDIDATES': (190, 24, 93), 'RECRUITERS': (124, 58, 237), 'JOBS': (220, 38, 38),
    'APPLICATIONS': (13, 148, 136),
}
INK = (17, 24, 39)
GRID = (55, 65, 81)
TYPEBG = (241, 245, 249)
GREY = (75, 85, 99)

PAGE_W, PAGE_H = 3508, 2480          # A4 landscape @ 300 dpi
ROWS = [                             # packed layout, referenced tables first
    ['USERS', 'COMPANIES', 'SKILLS'],
    ['CANDIDATES', 'RECRUITERS'],
    ['JOBS', 'CANDIDATE_SKILLS'],
    ['APPLICATIONS', 'JOB_SKILLS', 'RESUME_EMBEDDINGS'],
    ['APPLICATION_STATUS_HISTORY', 'JOB_EMBEDDINGS'],
]
ROWS = [
    ['USERS', 'COMPANIES'],
    ['CANDIDATES', 'SKILLS'],
    ['JOBS'],
    ['RECRUITERS', 'APPLICATIONS'],
    ['CANDIDATE_SKILLS', 'JOB_SKILLS', 'APPLICATION_STATUS_HISTORY'],
    ['RESUME_EMBEDDINGS', 'JOB_EMBEDDINGS'],
]

# ---------------------------------------------------------------- measure
tmp = ImageDraw.Draw(Image.new('RGB', (10, 10)))
def tw(text, f):
    if not text:
        return 0
    b = tmp.textbbox((0, 0), text, font=f)
    return (b[2] - b[0]) / S

F_NAME, F_NAME_B = font(15), font(15, 'b')
F_TYPE, F_CONS = font(13), font(11.5, 'i')
F_TABLE = font(16, 'b')
F_NOTE = font(12.5, 'i')
NAME_H, TYPE_H = 32, 44
ROW_H = NAME_H + TYPE_H
LABEL_H = 28
TABLE_GAP = 46

tables = {}
for name, note, cols in T:
    cells = []
    for c in cols:
        w = max(tw(c[0], F_NAME_B if c[3] else F_NAME), tw(c[1], F_TYPE), tw(c[2], F_CONS)) + 22
        cells.append(dict(col=c[0], typ=c[1], cons=c[2], pk=c[3], fk=c[4], w=max(w, 64)))
    tables[name] = dict(name=name, note=note, cells=cells, w=sum(c['w'] for c in cells))

fks = []
for name, _, cols in T:
    for i, c in enumerate(cols):
        if c[4]:
            fks.append(dict(src=name, si=i, dst=c[4][0],
                            di=[cc[0] for cc in [x for x in T if x[0] == c[4][0]][0][2]].index(c[4][1])))
row_of = {t: r for r, row in enumerate(ROWS) for t in row}

# ---------------------------------------------------------------- horizontal layout
LANE_GAP = 12
row_w = [sum(tables[t]['w'] for t in row) + TABLE_GAP * (len(row) - 1) for row in ROWS]
content_w = max(row_w)

def rel_cx(t, idx):
    cells = tables[t]['cells']
    return sum(c['w'] for c in cells[:idx]) + cells[idx]['w'] / 2

# provisional x (left aligned) to choose sides
X_TABLES_PROV = 0
def table_x_prov(t):
    row = ROWS[row_of[t]]
    x = 0
    for n in row:
        if n == t:
            return x
        x += tables[n]['w'] + TABLE_GAP
for f in fks:
    a = table_x_prov(f['src']) + rel_cx(f['src'], f['si'])
    b = table_x_prov(f['dst']) + rel_cx(f['dst'], f['di'])
    f['side'] = 'L' if (a + b) / 2 < content_w * 0.55 else 'R'
    f['span'] = abs(row_of[f['src']] - row_of[f['dst']])
for side in 'LR':
    grp = sorted([f for f in fks if f['side'] == side], key=lambda f: (f['span'], row_of[f['dst']], f['dst']))
    for k, f in enumerate(grp):
        f['lane'] = k
n_left = sum(f['side'] == 'L' for f in fks)
n_right = sum(f['side'] == 'R' for f in fks)

MARGIN = 30
X0 = MARGIN + n_left * LANE_GAP + 26           # tables start here
XR = X0 + content_w + 26                       # right lanes start here
W = XR + n_right * LANE_GAP + MARGIN

def table_x(t):
    return X0 + table_x_prov(t)
def lane_x(f):
    return X0 - 22 - f['lane'] * LANE_GAP if f['side'] == 'L' else XR + f['lane'] * LANE_GAP
def cell_box(t, idx):
    x = table_x(t) + sum(c['w'] for c in tables[t]['cells'][:idx])
    y = tables[t]['y']
    return x, y, x + tables[t]['cells'][idx]['w'], y + ROW_H

# ---------------------------------------------------------------- vertical layout
BAND = 11
TITLE_H = 92
y = TITLE_H
for r, row in enumerate(ROWS):
    y += LABEL_H
    for t in row:
        tables[t]['y'] = y
    y += ROW_H
    # band below row r: outgoing arrows of row r + incoming arrows to row r
    users = [('out', f) for f in fks if row_of[f['src']] == r] + [('in', f) for f in fks if row_of[f['dst']] == r]
    def keyf(u):
        kind, f = u
        x = (cell_box(f['src'], f['si'])[0] if kind == 'out' else cell_box(f['dst'], f['di'])[0])
        return x if f['side'] == 'L' else -x
    # left-side arrows: cells further left use the band slots closest to the row
    for k, (kind, f) in enumerate(sorted(users, key=keyf)):
        f['y_out' if kind == 'out' else 'y_in'] = y + 12 + k * BAND
    y += 12 + len(users) * BAND + 16
H = y + 56

# spread arrowheads that share a PK cell
by_cell = {}
for f in fks:
    by_cell.setdefault((f['dst'], f['di']), []).append(f)
for (t, di), grp in by_cell.items():
    x1, _, x2, _ = cell_box(t, di)
    grp.sort(key=lambda f: lane_x(f))
    for k, f in enumerate(grp):
        f['x_in'] = (x1 + x2) / 2 + (k - (len(grp) - 1) / 2) * 11

# ---------------------------------------------------------------- draw
img = Image.new('RGB', (P(W), P(H)), 'white')
d = ImageDraw.Draw(img)
def line(pts, fill, width=1.6):
    d.line([(P(x), P(yy)) for x, yy in pts], fill=fill, width=max(1, P(width)), joint='curve')
def dotted(x1, x2, yy, fill, width=1.4):
    x = x1
    while x < x2:
        d.line([(P(x), P(yy)), (P(min(x + 2.4, x2)), P(yy))], fill=fill, width=P(width))
        x += 5

d.text((P(X0), P(18)), 'CareerLens — Relational Schema', font=font(26, 'b'), fill=INK)
d.text((P(X0), P(54)), 'PostgreSQL 16 + pgvector  •  12 relations in 3NF  •  14 foreign keys  •  '
       'Row 1: column  •  Row 2: data type / constraint', font=font(13.5), fill=GREY)

for f in fks:
    col = COLORS[f['dst']]
    sx1, _, sx2, sy2 = cell_box(f['src'], f['si'])
    sx = (sx1 + sx2) / 2
    ty2 = tables[f['dst']]['y'] + ROW_H
    lx = lane_x(f)
    line([(sx, sy2), (sx, f['y_out']), (lx, f['y_out']), (lx, f['y_in']), (f['x_in'], f['y_in']), (f['x_in'], ty2 + 1)], col)
    s = 5.5
    d.polygon([(P(f['x_in'] - s * 0.75), P(ty2 + s * 1.5)), (P(f['x_in'] + s * 0.75), P(ty2 + s * 1.5)),
               (P(f['x_in']), P(ty2))], fill=col)
    r = 2.6
    d.ellipse([P(sx - r), P(sy2 - r), P(sx + r), P(sy2 + r)], fill=col)

for t, tb in tables.items():
    x, ty = table_x(t), tb['y']
    d.text((P(x), P(ty - LABEL_H + 3)), t, font=F_TABLE, fill=INK)
    if tb['note']:
        d.text((P(x + tw(t, F_TABLE) + 14), P(ty - LABEL_H + 5)), tb['note'], font=F_NOTE, fill=GREY)
    for c in tb['cells']:
        w = c['w']
        d.rectangle([P(x), P(ty + NAME_H), P(x + w), P(ty + ROW_H)], fill=TYPEBG)
        d.rectangle([P(x), P(ty), P(x + w), P(ty + ROW_H)], outline=GRID, width=P(1.2))
        d.line([(P(x), P(ty + NAME_H)), (P(x + w), P(ty + NAME_H))], fill=GRID, width=P(0.9))
        fnt = F_NAME_B if c['pk'] else F_NAME
        cw = tw(c['col'], fnt)
        cx = x + (w - cw) / 2
        d.text((P(cx), P(ty + 7)), c['col'], font=fnt, fill=INK)
        uy = ty + 26
        if c['pk']:
            d.line([(P(cx), P(uy)), (P(cx + cw), P(uy))], fill=INK, width=P(1.5))
        if c['fk']:
            dotted(cx, cx + cw, uy + (4 if c['pk'] else 0), INK)
        d.text((P(x + (w - tw(c['typ'], F_TYPE)) / 2), P(ty + NAME_H + 5)), c['typ'], font=F_TYPE, fill=INK)
        if c['cons']:
            d.text((P(x + (w - tw(c['cons'], F_CONS)) / 2), P(ty + NAME_H + 23)), c['cons'], font=F_CONS, fill=GREY)
        x += w

# legend
ly = H - 50
lx = X0
d.text((P(lx), P(ly)), 'Legend:', font=font(14, 'b'), fill=INK); lx += 76
d.text((P(lx), P(ly)), 'pk_column', font=F_NAME_B, fill=INK)
w1 = tw('pk_column', F_NAME_B)
d.line([(P(lx), P(ly + 19)), (P(lx + w1), P(ly + 19))], fill=INK, width=P(1.5))
d.text((P(lx + w1 + 8), P(ly)), '= primary key', font=font(14), fill=INK); lx += w1 + 130
d.text((P(lx), P(ly)), 'fk_column', font=F_NAME, fill=INK)
w2 = tw('fk_column', F_NAME)
dotted(lx, lx + w2, ly + 19, INK)
d.text((P(lx + w2 + 8), P(ly)), '= foreign key', font=font(14), fill=INK); lx += w2 + 130
line([(lx, ly + 9), (lx + 46, ly + 9)], (37, 99, 235))
d.polygon([(P(lx + 46), P(ly + 4)), (P(lx + 46), P(ly + 14)), (P(lx + 55), P(ly + 9))], fill=(37, 99, 235))
d.text((P(lx + 64), P(ly)), '= foreign key → referenced primary key (arrow colour = referenced table)', font=font(14), fill=INK)

# fit onto an A4 landscape page
scale = min(PAGE_W / (W * S), PAGE_H / (H * S))
small = img.resize((int(W * S * scale), int(H * S * scale)), Image.LANCZOS)
page = Image.new('RGB', (PAGE_W, PAGE_H), 'white')
page.paste(small, ((PAGE_W - small.width) // 2, (PAGE_H - small.height) // 2))
page.save(OUT, dpi=(300, 300))
print('saved', OUT, page.size, 'content', small.size, 'px per unit', round(S * scale, 2))
