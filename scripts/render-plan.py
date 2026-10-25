#!/usr/bin/env python3
"""把 src/layout.js 画成俯视平面图 PNG，用来和 VR 原图对照。"""
import json
import re
import sys
from PIL import Image, ImageDraw, ImageFont

SCALE = 90  # px / m
PAD = 40

src = open('src/layout.js', encoding='utf-8').read()


def grab(name):
    return json.loads('[' + re.search(r'export const %s=\[(.*?)\];' % name, src, re.S).group(1) + ']')


rooms = json.loads('[' + re.search(r'export const ROOMS=\[(.*?)\];', src, re.S).group(1) + ']')
walls = grab('WALLS')
openings = grab('OPENINGS')

W = int(9.9 * SCALE) + PAD * 2
H = int(10.75 * SCALE) + PAD * 2
img = Image.new('RGB', (W, H), '#101418')
dr = ImageDraw.Draw(img)

CJK = '/System/Library/Fonts/Hiragino Sans GB.ttc'
try:
    font = ImageFont.truetype(CJK, 24)
    small = ImageFont.truetype(CJK, 16)
except OSError:
    font = small = ImageFont.load_default()

PALETTE = {'living': '#3b4a53', 'b': '#44505a', 'c': '#44505a', 'a': '#44505a',
           'kitchen': '#3f4d47', 'bath': '#37474f', 'storage': '#4a4653',
           'hall': '#3a4149', 'balcony': '#3f4a3f'}


def px(x, z):
    return PAD + x * SCALE, PAD + z * SCALE


for r in rooms:
    for x, z, w, d in r['polys']:
        a = px(x, z)
        b = px(x + w, z + d)
        dr.rectangle([a, b], fill=PALETTE.get(r['id'], '#3a3a3a'), outline='#2a3138')
    cx, cz = px(*r['label'])
    dr.text((cx, cz), r['name'], font=font, fill='#e8e4da', anchor='mm')
    dr.text((cx, cz + 26), '%.2f m²' % r['area'], font=small, fill='#9fb0bb', anchor='mm')

for x1, z1, x2, z2 in walls:
    a, b = px(x1, z1), px(x2, z2)
    dr.line([a, b], fill='#d9d4c8', width=int(0.12 * SCALE))

for o in openings:
    if o['axis'] == 'x':
        a = px(o['cx'] - o['len'] / 2, o['cz'] - 0.06)
        b = px(o['cx'] + o['len'] / 2, o['cz'] + 0.06)
    else:
        a = px(o['cx'] - 0.06, o['cz'] - o['len'] / 2)
        b = px(o['cx'] + 0.06, o['cz'] + o['len'] / 2)
    color = '#e8b25a' if o['kind'] in ('door', 'entry', 'slider') else '#6fc0d8'
    if o['kind'] == 'window':
        color = '#6fc0d8' if o['sill'] < 0.5 else '#4f93ab'
    dr.rectangle([a, b], fill='#101418')
    dr.line([a, b], fill=color, width=4)

dr.text((PAD, 10), '实测平面（如视 VR 数据） 橙=门 蓝=窗/落地窗 深蓝=高窗台', font=small, fill='#8fa3ad')
img.save('output/实测平面图.png')
print('saved output/实测平面图.png', img.size)
