import json, sys
m = json.load(open(sys.argv[1])); n = len(m)
W, H = 640, 480
cell = (min(W, H) - 60) // (n + 8)
size = cell * (n + 8)
ox, oy = (W - size) // 2, (H - size) // 2
Y = bytearray([235] * (W * H))
for r in range(n):
    for c in range(n):
        if m[r][c] == '1':
            for yy in range(cell):
                row = (oy + (r + 4) * cell + yy) * W
                for xx in range(cell):
                    Y[row + ox + (c + 4) * cell + xx] = 16
U = bytes([128] * (W * H // 4))
with open(sys.argv[2], 'wb') as f:
    f.write(b'YUV4MPEG2 W640 H480 F10:1 Ip A1:1 C420jpeg\n')
    for _ in range(10):
        f.write(b'FRAME\n'); f.write(Y); f.write(U); f.write(U)
