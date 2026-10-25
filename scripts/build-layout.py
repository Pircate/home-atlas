#!/usr/bin/env python3
"""把如视 VR 抓到的户型 JSON 转成 src/layout.js（模型坐标系，单位米）。

坐标换算：如视图纸 mm → 模型米
    X = (x - 37500) / 1000 + 7.827
    Z = (y - 37500) / 1000 * -1 + 4.646      # 图纸 y 向北为负，模型 Z 南为正
换算后：全屋外轮廓 X∈[0.12, 9.663]，Z∈[0.538, 10.509]。
"""
import json
import os
import sys

# 如视 VR 抓下来的户型 JSON。原始抓包没有进仓库（含房源完整载荷），
# 需要重跑时手工传入：python3 scripts/build-layout.py /path/to/r002.json
SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/rscap2/r002.json'
if not os.path.exists(SRC):
    sys.exit('找不到源文件 %s；用参数指定如视抓到的户型 JSON 路径。' % SRC)
RAW_OUT = 'vr/floorplan.json'
JS_OUT = 'src/layout.js'

OX, OZ = 7.827, 4.646
XR, YR = 37500.0, 37500.0


def mx(x):
    return round((x - XR) / 1000.0 + OX, 4)


def mz(y):
    return round((YR - y) / 1000.0 + OZ, 4)


# edgeWall / holes 已经在「x, z=-图纸y」的米制坐标系里，只差一个平移
def ex(x):
    return round(x + OX, 4)


def ez(z):
    return round(z + OZ, 4)


def snap(v, walls, axis, span, tol=0.12):
    """把洞口的「墙法向」坐标吸到真正属于它的那面墙的中线上。

    必须同时满足两件事：法向坐标足够近，且沿墙方向与洞口有重叠。
    只看法向距离会出错——厨房那面墙的 z（3.2395）和卫生间那面墙的 z（3.258）
    只差 1.8 cm，卫生间门会被吸到十几米外那面厨房墙上。
    保留 4 位小数：墙中线是 4 位（如 5.3551），只留 3 位会与阻滞带差 0.1 mm，
    门洞闸门盖不住墙带就会留一条发丝缝，家具过不去。
    """
    best = None
    for w in walls:
        if axis == 'x':
            if abs(w[1] - w[3]) > 1e-9:
                continue                      # 不是水平墙
            cand, lo, hi = w[1], min(w[0], w[2]), max(w[0], w[2])
        else:
            if abs(w[0] - w[2]) > 1e-9:
                continue                      # 不是竖直墙
            cand, lo, hi = w[0], min(w[1], w[3]), max(w[1], w[3])
        if hi < span[0] - 0.05 or lo > span[1] + 0.05:
            continue                          # 沿墙方向对不上，不是这面墙
        if abs(cand - v) <= tol and (best is None or abs(cand - v) < abs(best - v)):
            best = cand
    return round(best if best is not None else v, 4)


def cell(poly):
    xs = sorted({p[0] for p in poly})
    ys = sorted({p[1] for p in poly})
    return [xs[0], ys[0], xs[-1], ys[-1]]


def inside(px, py, poly):
    n = len(poly)
    hit = False
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / (y2 - y1) + x1:
            hit = not hit
    return hit


def decompose(poly):
    """正交多边形 → 矩形列表（网格切分，保留中心在形内的格子）。"""
    def axis(vals):
        out = [vals[0]]
        for v in vals[1:]:
            if v - out[-1] >= 20:   # 图纸单位是毫米；吃掉 1~2 cm 的碎格
                out.append(v)
            else:
                out[-1] = v
        return out

    xs = axis(sorted({p[0] for p in poly}))
    ys = axis(sorted({p[1] for p in poly}))
    out = []
    for i in range(len(xs) - 1):
        for j in range(len(ys) - 1):
            cx = (xs[i] + xs[i + 1]) / 2
            cy = (ys[j] + ys[j + 1]) / 2
            if inside(cx, cy, poly):
                out.append([xs[i], ys[j], xs[i + 1], ys[j + 1]])
    return out


data = json.load(open(SRC, encoding='utf-8'))['data']
rooms_src = data['floorplanData'][0]['rooms']

# 图纸房间名 → 项目里的房间 id（沿用既有的 10 个 id，不新增）
ROOM_IDS = {
    '客厅': ('living', '客厅'),
    '卧室A': ('a', '卧室 A'),
    '卧室B': ('b', '卧室 B'),
    '卧室C': ('c', '卧室 C'),
    '厨房': ('kitchen', '厨房'),
    '卫生间': ('bath', '卫生间'),
    '衣帽间': ('storage', '储物间'),
    '过道B': ('hall', '过道'),
    '过道A': ('hall', '过道'),
    '阳台': ('balcony', '阳台'),
}

merged = {}
for r in rooms_src:
    rid, name = ROOM_IDS[r['name']]
    poly = [(p['x'], p['y']) for p in r['path']]
    rects = [[mx(a), mz(d), mx(c), mz(b)] for a, b, c, d in decompose(poly)]
    # 统一成 x,z,w,d
    rects = [[x, z, round(w - x, 4), round(d - z, 4)] for x, z, w, d in rects]
    slot = merged.setdefault(rid, {'id': rid, 'name': name, 'area': 0.0, 'polys': []})
    slot['area'] += r['size'] / 1e6
    slot['polys'] += rects

# 人工读数：如视把「储物间」标成衣帽间，这里保留项目原有叫法（Rick 已改为电竞房）
ROOM_ORDER = ['living', 'b', 'c', 'a', 'kitchen', 'bath', 'storage', 'hall', 'balcony']
rooms = []
for rid in ROOM_ORDER:
    r = merged[rid]
    xs0 = min(p[0] for p in r['polys'])
    zs0 = min(p[1] for p in r['polys'])
    xs1 = max(p[0] + p[2] for p in r['polys'])
    zs1 = max(p[1] + p[3] for p in r['polys'])
    # 房间机位取面积最大那块的形心，L 形房间才不会把相机推到空处
    main = max(r['polys'], key=lambda p: p[2] * p[3])
    r['label'] = [round(main[0] + main[2] / 2, 3), round(main[1] + main[3] / 2, 3)]
    r['extent'] = [xs0, zs0, round(xs1 - xs0, 4), round(zs1 - zs0, 4)]
    r['area'] = round(r['area'], 2)
    rooms.append(r)

# 墙体：用图纸的「点—线」模型，而不是 edgeWall 的板外形。
# edgeWall 的 polygon 是把 12 cm 厚度斜切出来的六边形，包围盒会比真墙长 12 cm
# （比如储物间那面墙左端会多出 18 cm），端点必须取线的两端才准；
# 线的横向坐标正好落在房间多边形的边界上，也就是墙中线。
line_ends = {}
for p in data['points'][0]:
    for lid in p['lines']:
        e = line_ends.setdefault(lid, [])
        e.append((p['x'], p['y']))
walls = []
for lid, ends in line_ends.items():
    xs = sorted({p[0] for p in ends})
    ys = sorted({p[1] for p in ends})
    if xs[-1] - xs[0] >= ys[-1] - ys[0]:
        seg = [mx(xs[0]), mz((ys[0] + ys[-1]) / 2), mx(xs[-1]), mz((ys[0] + ys[-1]) / 2)]
    else:
        seg = [mx((xs[0] + xs[-1]) / 2), mz(ys[0]), mx((xs[0] + xs[-1]) / 2), mz(ys[-1])]
    seg = [round(v, 4) for v in seg]
    if seg not in walls:
        walls.append(seg)

# 洞口：edgeWall 的 holes 带精确范围与「窗台高 / 洞口高」
KIND = {
    'u-zDlW7cmtpya7j4': 'entry',
    'u-eALKWmkP8I7WLV': 'slider',
}
seen = set()
openings = []
for w in data['edgeWall']:
    for h in w.get('holes', []):
        hid = h.get('id')
        if hid in seen:
            continue
        seen.add(hid)
        x0, z0, x1, z1 = cell(h['polygon'])
        sill = h.get('offsetY') or 0
        head = round(sill + (h.get('height') or 2.0), 3)
        if abs(x1 - x0) >= abs(z1 - z0):
            # 洞口只把「墙线方向」的坐标吸回房间边界；洞宽保持实测值，
            # 否则会把门边吸到墙角上去、把门拉宽。
            axis = 'x'
            cx = round((ex(x0) + ex(x1)) / 2, 4)
            cz = snap(ez((z0 + z1) / 2), walls, 'x', (ex(x0), ex(x1)))
            ln = round(x1 - x0, 4)
        else:
            axis = 'z'
            cz = round((ez(z0) + ez(z1)) / 2, 4)
            cx = snap(ex((x0 + x1) / 2), walls, 'z', (ez(z0), ez(z1)))
            ln = round(z1 - z0, 4)
        kind = KIND.get(hid) or ('door' if sill == 0 else 'window')
        openings.append({'id': hid, 'axis': axis, 'cx': cx, 'cz': cz,
                         'len': ln, 'kind': kind, 'sill': round(sill, 3), 'head': head})
openings.sort(key=lambda o: (o['axis'], o['cx'], o['cz']))

# 每个洞口都必须落在某段墙的中线上。model.js 按「走向相同 + 法向坐标差 < 3 cm」把洞口
# 归到墙上，差得再多就会被静默丢掉、墙上少个门。宁可这里直接报错。
for o in openings:
    ok = False
    for w in walls:
        if o['axis'] == 'x':
            if abs(w[1] - w[3]) < 1e-9 and abs(w[1] - o['cz']) < 1e-6:
                ok = min(w[0], w[2]) <= o['cx'] <= max(w[0], w[2]) + 1e-9
        else:
            if abs(w[0] - w[2]) < 1e-9 and abs(w[0] - o['cx']) < 1e-6:
                ok = min(w[1], w[3]) <= o['cz'] <= max(w[1], w[3]) + 1e-9
        if ok:
            break
    assert ok, '洞口 %s 没吸附到任何墙中线上' % o['id']

os.makedirs('vr', exist_ok=True)
with open(RAW_OUT, 'w', encoding='utf-8') as f:
    json.dump({'workCode': 'jd6oMOgvWNQMBvxY', 'unionPlanCode': 'j5dQKdw8sL59Re8P',
               'title': '万科森林公园朗庭 3室1厅', 'originMM': {'x': XR, 'y': YR}}, f, ensure_ascii=False, indent=1)


def js(v):
    return json.dumps(v, ensure_ascii=False, separators=(',', ':'))


lines = [
    '// 本文件由如视（贝壳·VR看房）实测户型数据生成，不要手改。',
    '// 源：https://open.realsee.com/ke/jd6oMOgvWNQMBvxY/74Lqjm4u4cq9b0AGQv5VTqTN7o2ZSr89/',
    '// 万科森林公园朗庭 3室1厅；房间多边形为墙中线，墙厚 0.12 m，层高 2.7 m。',
    'export const WALL_HEIGHT=2.7;',
    'export const WALL_THICKNESS=.12;',
    '// polys: 房间地面矩形 [x,z,w,d]，是墙中线围出的多边形按格切分的结果；',
    '// 相邻房间在墙中线处严丝合缝，并集即全屋可行走区域。',
    'export const ROOMS=[' + ','.join(
        js({'id': r['id'], 'name': r['name'], 'area': r['area'], 'label': r['label'],
            'extent': r['extent'], 'polys': r['polys']})
        for r in rooms) + '];',
    '// 墙体中线 [x1,z1,x2,z2]',
    'export const WALLS=[' + ','.join(js(w) for w in walls) + '];',
    '// 门窗洞口：axis 为墙的走向，len 为洞宽；sill/head 为洞口下沿与上沿标高',
    'export const OPENINGS=[' + ','.join(js(o) for o in openings) + '];',
]
open(JS_OUT, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

print('rooms:')
for r in rooms:
    print('  %-8s %-6s %6.2f m²  polys=%d  label=%s' % (r['id'], r['name'], r['area'], len(r['polys']), r['label']))
print('walls:', len(walls), 'openings:', len(openings))
for o in openings:
    print('   %-6s %-5s cx=%.3f cz=%.3f len=%.3f sill=%.2f head=%.2f' % (o['kind'], o['axis'], o['cx'], o['cz'], o['len'], o['sill'], o['head']))
