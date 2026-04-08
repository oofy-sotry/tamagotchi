// ═══════════════════════════════════════════════════
// 픽셀아트 스프라이트 — 캐릭터 선택 + 10단계 진화 + 감정
// ═══════════════════════════════════════════════════

const PIXEL_SIZE = 5;

// ─── 캐릭터 정보 ─────────────────────────────────

const CREATURE_INFO = {
  dragon:       { name: '용',       description: '불꽃의 용' },
  fire_lizard:  { name: '불도마뱀', description: '화염의 도마뱀' },
  water_turtle: { name: '물거북',   description: '바다의 거북' },
};

const CREATURE_TYPES = Object.keys(CREATURE_INFO);

let currentCreatureType = 'dragon';
let currentColorVariant = 'orange';
function setCreatureType(type) { currentCreatureType = type; }
function setColorVariant(variant) { currentColorVariant = variant; }

// ─── 색상 변형 정의 (7 일반 + 3 히든) ───────────

const COLOR_VARIANTS = [
  { id: 'red',    name: '빨강', hue: 0,   sat: 1.0, light: 1.0, hidden: false },
  { id: 'orange', name: '주황', hue: 25,  sat: 1.0, light: 1.0, hidden: false },
  { id: 'green',  name: '초록', hue: 130, sat: 1.0, light: 1.0, hidden: false },
  { id: 'blue',   name: '파랑', hue: 215, sat: 1.0, light: 1.0, hidden: false },
  { id: 'purple', name: '보라', hue: 275, sat: 1.0, light: 1.0, hidden: false },
  { id: 'cyan',   name: '하늘', hue: 185, sat: 1.0, light: 1.05, hidden: false },
  { id: 'brown',  name: '갈색', hue: 30,  sat: 0.5, light: 0.85, hidden: false },
  { id: 'golden', name: '황금', hue: 48,  sat: 0.9, light: 1.3,  hidden: true },
  { id: 'pink',   name: '분홍', hue: 340, sat: 0.7, light: 1.2,  hidden: true },
  { id: 'black',  name: '암흑', hue: 0,   sat: 0.12, light: 0.35, hidden: true },
];

// ─── HSL 색상 변환 유틸 ─────────────────────────

function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h = 0, s = 0, l = (max+min)/2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    if (max === r) h = ((g-b)/d + (g<b?6:0))/6;
    else if (max === g) h = ((b-r)/d+2)/6;
    else h = ((r-g)/d+4)/6;
  }
  return [h*360, s, l];
}

function hslToRgb(h, s, l) {
  h = (((h%360)+360)%360)/360;
  if (s === 0) return [Math.round(l*255), Math.round(l*255), Math.round(l*255)];
  const hue2rgb = (p,q,t) => {
    if (t<0) t+=1; if (t>1) t-=1;
    if (t<1/6) return p+(q-p)*6*t;
    if (t<1/2) return q;
    if (t<2/3) return p+(q-p)*(2/3-t)*6;
    return p;
  };
  const q = l<0.5 ? l*(1+s) : l+s-l*s;
  const p = 2*l - q;
  return [Math.round(hue2rgb(p,q,h+1/3)*255), Math.round(hue2rgb(p,q,h)*255), Math.round(hue2rgb(p,q,h-1/3)*255)];
}

function rgbToHex(r,g,b) {
  return '#' + [r,g,b].map(v => Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('');
}

function recolorHex(hex, targetHue, satMul, lightMul) {
  const [r,g,b] = hexToRgb(hex);
  let [h,s,l] = rgbToHsl(r,g,b);
  h = targetHue;
  s = Math.min(1, s * satMul);
  l = Math.min(1, Math.max(0, l * lightMul));
  const [nr,ng,nb] = hslToRgb(h, s, l);
  return rgbToHex(nr, ng, nb);
}

function generateVariantPalette(basePalette, variant) {
  const result = {};
  for (const [stage, colors] of Object.entries(basePalette)) {
    result[stage] = {};
    for (const [code, hex] of Object.entries(colors)) {
      if (code === '3') {
        result[stage][code] = hex; // 눈 색은 유지
      } else {
        result[stage][code] = recolorHex(hex, variant.hue, variant.sat, variant.light);
      }
    }
  }
  return result;
}

// ─── 공통 알 스프라이트 (형태 동일, 팔레트만 다름) ──

const SHARED_EGG = {
  pixels: [
    '  0000  ',
    ' 022220 ',
    '02222220',
    '02112210',
    '01111110',
    '01111110',
    '01122110',
    '01111110',
    ' 011110 ',
    '  0000  ',
  ],
  face: null,
};

const SHARED_CRACKED_EGG = {
  pixels: [
    '  0000  ',
    ' 022020 ',
    '02201220',
    '02012210',
    '01201110',
    '01110110',
    '01122110',
    '01111110',
    ' 011110 ',
    '  0000  ',
  ],
  face: null,
};

// ═════════════════════════════════════════════════════
// 팔레트
// ═════════════════════════════════════════════════════

const ALL_PALETTES = {

  // ── 용 ────────────────────────────────────────────
  dragon: {
    'egg':          { '0': '#6b5335', '1': '#e8dcc8', '2': '#c4b393' },
    'cracked-egg':  { '0': '#6b5335', '1': '#e8dcc8', '2': '#c4b393' },
    'hatchling':    { '0': '#7a5030', '1': '#ffcc88', '2': '#ffe8bb', '3': '#1a0a00' },
    'baby-dragon':  { '0': '#7a4020', '1': '#ff9944', '2': '#ffbb77', '3': '#1a0a00', '4': '#cc7722' },
    'young-dragon': { '0': '#6a3015', '1': '#ff7722', '2': '#ff9955', '3': '#1a0a00', '4': '#bb6611', '5': '#dd7733' },
    'juvenile':     { '0': '#5a2510', '1': '#ee5500', '2': '#ff8833', '3': '#1a0a00', '4': '#aa4400', '5': '#cc6622' },
    'adolescent':   { '0': '#4a1a08', '1': '#cc3300', '2': '#ee6633', '3': '#1a0a00', '4': '#993300', '5': '#bb4422', '6': '#ff6600' },
    'adult-dragon': { '0': '#3a1005', '1': '#aa0000', '2': '#dd5533', '3': '#1a0000', '4': '#882200', '5': '#992211', '6': '#ff4400' },
    'elder-dragon': { '0': '#2a0a04', '1': '#880044', '2': '#bb5577', '3': '#1a0000', '4': '#662244', '5': '#773355', '6': '#ff3300' },
    'legendary':    { '0': '#4a2000', '1': '#ff6600', '2': '#ffcc00', '3': '#1a0000', '4': '#ffaa00', '5': '#cc0000', '6': '#ff4400', '7': '#ffee44' },
  },

  // ── 불도마뱀 ──────────────────────────────────────
  fire_lizard: {
    'egg':          { '0': '#5a3520', '1': '#e8c8a8', '2': '#d4a878' },
    'cracked-egg':  { '0': '#5a3520', '1': '#e8c8a8', '2': '#d4a878' },
    'hatchling':    { '0': '#8a3010', '1': '#ff8844', '2': '#ffbb88', '3': '#1a0500' },
    'baby-dragon':  { '0': '#7a2510', '1': '#ff6633', '2': '#ff9966', '3': '#1a0500', '4': '#cc4411' },
    'young-dragon': { '0': '#6a1a08', '1': '#ee5522', '2': '#ff7744', '3': '#1a0500', '4': '#aa3300', '5': '#dd5522' },
    'juvenile':     { '0': '#5a1005', '1': '#dd4400', '2': '#ff6622', '3': '#1a0500', '4': '#993300', '5': '#cc4411' },
    'adolescent':   { '0': '#4a0a03', '1': '#cc2200', '2': '#ee4422', '3': '#1a0200', '4': '#882200', '5': '#aa3311', '6': '#ff6600' },
    'adult-dragon': { '0': '#3a0502', '1': '#aa1100', '2': '#cc3322', '3': '#1a0000', '4': '#771100', '5': '#881100', '6': '#ff4400' },
    'elder-dragon': { '0': '#2a0301', '1': '#881100', '2': '#aa3322', '3': '#1a0000', '4': '#661100', '5': '#772211', '6': '#ff3300' },
    'legendary':    { '0': '#3a1000', '1': '#cc2200', '2': '#ff6600', '3': '#1a0000', '4': '#ff4400', '5': '#aa0000', '6': '#ff2200', '7': '#ffcc00' },
  },

  // ── 물거북 ────────────────────────────────────────
  water_turtle: {
    'egg':          { '0': '#354a5a', '1': '#c8dce8', '2': '#93b0c4' },
    'cracked-egg':  { '0': '#354a5a', '1': '#c8dce8', '2': '#93b0c4' },
    'hatchling':    { '0': '#205060', '1': '#44bbcc', '2': '#88ddee', '3': '#0a1a20' },
    'baby-dragon':  { '0': '#184050', '1': '#33aabb', '2': '#77ccdd', '3': '#0a1a20', '4': '#227788' },
    'young-dragon': { '0': '#103545', '1': '#2299aa', '2': '#55bbcc', '3': '#0a1520', '4': '#116677', '5': '#33aabb' },
    'juvenile':     { '0': '#0a2a3a', '1': '#1188aa', '2': '#44aacc', '3': '#0a1520', '4': '#006688', '5': '#2299aa' },
    'adolescent':   { '0': '#082030', '1': '#0077aa', '2': '#3399bb', '3': '#0a1020', '4': '#005577', '5': '#1188aa', '6': '#00ccff' },
    'adult-dragon': { '0': '#061828', '1': '#006699', '2': '#2288aa', '3': '#0a0a18', '4': '#004466', '5': '#007799', '6': '#00bbee' },
    'elder-dragon': { '0': '#041020', '1': '#005588', '2': '#1177aa', '3': '#0a0a15', '4': '#003355', '5': '#006688', '6': '#00aadd' },
    'legendary':    { '0': '#0a2030', '1': '#0088bb', '2': '#00ccee', '3': '#0a0a15', '4': '#00aacc', '5': '#005588', '6': '#00ddff', '7': '#ffeeaa' },
  },
};

// ─── 모든 변형 팔레트 사전 생성 ─────────────────

const ALL_VARIANT_PALETTES = {};
for (const creature of CREATURE_TYPES) {
  ALL_VARIANT_PALETTES[creature] = {};
  for (const variant of COLOR_VARIANTS) {
    ALL_VARIANT_PALETTES[creature][variant.id] = generateVariantPalette(ALL_PALETTES[creature], variant);
  }
}

// ═════════════════════════════════════════════════════
// 스프라이트 데이터
// ═════════════════════════════════════════════════════

const ALL_SPRITES = {

  // ─────────────────────────────────────────────────
  // 용 (기본) — 뿔 + 날개
  // ─────────────────────────────────────────────────
  dragon: {
    'egg': SHARED_EGG,
    'cracked-egg': SHARED_CRACKED_EGG,

    'hatchling': {
      pixels: [
        '  0000  ',
        ' 022220 ',
        '02322320',
        '01111110',
        ' 011110 ',
        ' 012210 ',
        '  0110  ',
        '  0  0  ',
        '        ',
      ],
      face: { leftEye: [2, 2], rightEye: [5, 2], mouth: [3, 4] },
    },

    'baby-dragon': {
      pixels: [
        '  44  44  ',
        '  022220  ',
        ' 02222220 ',
        '0232112320',
        '0211111120',
        '0111111110',
        ' 01222210 ',
        '  011110  ',
        '  0    0  ',
        '          ',
      ],
      face: { leftEye: [2, 3], rightEye: [7, 3], mouth: [4, 5] },
    },

    'young-dragon': {
      pixels: [
        '  44    44  ',
        '  040  040  ',
        '  02222220  ',
        ' 0222222220 ',
        ' 0232112320 ',
        ' 0211111120 ',
        ' 0111111110 ',
        ' 0112222110 ',
        '  01111110  ',
        '   011110   ',
        '   0    0   ',
        '            ',
      ],
      face: { leftEye: [3, 4], rightEye: [8, 4], mouth: [5, 6] },
    },

    'juvenile': {
      pixels: [
        '   44    44   ',
        '  0440  0440  ',
        '  0022222200  ',
        ' 022222222220 ',
        ' 023211112320 ',
        ' 021111111120 ',
        '50111111111105',
        '50111111111105',
        ' 011222222110 ',
        '  0111111110  ',
        '   01111110   ',
        '   01    10   ',
        '   0      0   ',
        '              ',
      ],
      face: { leftEye: [3, 4], rightEye: [10, 4], mouth: [6, 5] },
    },

    'adolescent': {
      pixels: [
        '    44    44    ',
        '   0440  0440   ',
        '   0022222200   ',
        '  022222222220  ',
        '  023211112320  ',
        '  021111111120  ',
        ' 501111111111050',
        '5501111111111055',
        ' 501111111111050',
        '  011111111110  ',
        '  011222211110  ',
        '   0111111110   ',
        '    01    10    ',
        '    0      0    ',
        '      6  6      ',
        '                ',
      ],
      face: { leftEye: [4, 4], rightEye: [11, 4], mouth: [7, 5] },
    },

    'adult-dragon': {
      pixels: [
        '     44    44     ',
        '    0440  0440    ',
        '    0022222200    ',
        '   022222222220   ',
        '   023211112320   ',
        '   021111111120   ',
        ' 55011111111110 55',
        '555011111111110555',
        ' 55011111111110 55',
        '   011111111110   ',
        '   011222211110   ',
        '    0111111110    ',
        '    0111111110    ',
        '     01    10     ',
        '     0      0     ',
        '       6  6       ',
        '                  ',
      ],
      face: { leftEye: [5, 4], rightEye: [12, 4], mouth: [8, 5] },
    },

    'elder-dragon': {
      pixels: [
        '      44    44      ',
        '     0440  0440     ',
        '     0022222200     ',
        '    022222222220    ',
        '   02222222222220   ',
        '   02321111112320   ',
        '   02111111111120   ',
        ' 5501111111111110 55',
        '55501111111111110555',
        '55501111111111110555',
        ' 5501111111111110 55',
        '   01111111111110   ',
        '   01122222211110   ',
        '    011111111110    ',
        '     0111111110     ',
        '      01    10      ',
        '      0      0      ',
        '        6  6        ',
      ],
      face: { leftEye: [5, 5], rightEye: [14, 5], mouth: [9, 6] },
    },

    'legendary': {
      pixels: [
        '       74    74       ',
        '      0740  0740      ',
        '      0022222200      ',
        '     022222222220     ',
        '    02222222222220    ',
        '    02321111112320    ',
        '    02111111111120    ',
        ' 5550111111111110555 ',
        '555501111111111105555',
        '555501111111111105555',
        ' 5550111111111110555 ',
        '    01111111111110    ',
        '    01122222211110    ',
        '     011111111110     ',
        '      0111111110      ',
        '       01    10       ',
        '       0      0       ',
        '         6776         ',
        '        6    6        ',
        '                      ',
      ],
      face: { leftEye: [6, 5], rightEye: [15, 5], mouth: [10, 6] },
    },
  },

  // ─────────────────────────────────────────────────
  // 불도마뱀 — 등 가시 + 화염
  // ─────────────────────────────────────────────────
  fire_lizard: {
    'egg': SHARED_EGG,
    'cracked-egg': SHARED_CRACKED_EGG,

    'hatchling': {
      pixels: [
        '  0440  ',
        ' 022220 ',
        '02322320',
        '01111110',
        ' 011110 ',
        ' 012210 ',
        '  0110  ',
        '  0  0  ',
        '        ',
      ],
      face: { leftEye: [2, 2], rightEye: [5, 2], mouth: [3, 4] },
    },

    'baby-dragon': {
      pixels: [
        '  044440  ',
        '  022220  ',
        ' 02222220 ',
        '0232112320',
        '0211111120',
        '0111111110',
        ' 01222210 ',
        '  011110  ',
        '  0    0  ',
        '          ',
      ],
      face: { leftEye: [2, 3], rightEye: [7, 3], mouth: [4, 5] },
    },

    'young-dragon': {
      pixels: [
        '  04444440  ',
        '  01111110  ',
        '  02222220  ',
        ' 0222222220 ',
        ' 0232112320 ',
        ' 0211111120 ',
        ' 0111111110 ',
        ' 0112222110 ',
        '  01111110  ',
        '   011110   ',
        '   0    0   ',
        '            ',
      ],
      face: { leftEye: [3, 4], rightEye: [8, 4], mouth: [5, 6] },
    },

    'juvenile': {
      pixels: [
        ' 0444444440  ',
        '  0011111100 ',
        '  0022222200  ',
        ' 022222222220 ',
        ' 023211112320 ',
        ' 021111111120 ',
        '50111111111105',
        '50111111111105',
        ' 011222222110 ',
        '  0111111110  ',
        '   01111110   ',
        '   01    10   ',
        '   0      0   ',
        '              ',
      ],
      face: { leftEye: [3, 4], rightEye: [10, 4], mouth: [6, 5] },
    },

    'adolescent': {
      pixels: [
        '   04444444440  ',
        '   00111111100  ',
        '   0022222200   ',
        '  022222222220  ',
        '  023211112320  ',
        '  021111111120  ',
        ' 501111111111050',
        '5501111111111055',
        ' 501111111111050',
        '  011111111110  ',
        '  011222211110  ',
        '   0111111110   ',
        '    01    10    ',
        '    0      0    ',
        '      6  6      ',
        '                ',
      ],
      face: { leftEye: [4, 4], rightEye: [11, 4], mouth: [7, 5] },
    },

    'adult-dragon': {
      pixels: [
        '    0444444440    ',
        '    0011111100    ',
        '    0022222200    ',
        '   022222222220   ',
        '   023211112320   ',
        '   021111111120   ',
        ' 55011111111110 55',
        '555011111111110555',
        ' 55011111111110 55',
        '   011111111110   ',
        '   011222211110   ',
        '    0111111110    ',
        '    0111111110    ',
        '     01    10     ',
        '     0      0     ',
        '       6  6       ',
        '                  ',
      ],
      face: { leftEye: [5, 4], rightEye: [12, 4], mouth: [8, 5] },
    },

    'elder-dragon': {
      pixels: [
        '    044444444440    ',
        '    001111111100    ',
        '     0022222200     ',
        '    022222222220    ',
        '   02222222222220   ',
        '   02321111112320   ',
        '   02111111111120   ',
        ' 5501111111111110 55',
        '55501111111111110555',
        '55501111111111110555',
        ' 5501111111111110 55',
        '   01111111111110   ',
        '   01122222211110   ',
        '    011111111110    ',
        '     0111111110     ',
        '      01    10      ',
        '      0      0      ',
        '        6  6        ',
      ],
      face: { leftEye: [5, 5], rightEye: [14, 5], mouth: [9, 6] },
    },

    'legendary': {
      pixels: [
        '    07444444444470  ',
        '    001111111111100 ',
        '      0022222200      ',
        '     022222222220     ',
        '    02222222222220    ',
        '    02321111112320    ',
        '    02111111111120    ',
        ' 5550111111111110555 ',
        '555501111111111105555',
        '555501111111111105555',
        ' 5550111111111110555 ',
        '    01111111111110    ',
        '    01122222211110    ',
        '     011111111110     ',
        '      0111111110      ',
        '       01    10       ',
        '       0      0       ',
        '         6776         ',
        '        6    6        ',
        '                      ',
      ],
      face: { leftEye: [6, 5], rightEye: [15, 5], mouth: [10, 6] },
    },
  },

  // ─────────────────────────────────────────────────
  // 물거북 — 등껍질 + 물결
  // ─────────────────────────────────────────────────
  water_turtle: {
    'egg': SHARED_EGG,
    'cracked-egg': SHARED_CRACKED_EGG,

    'hatchling': {
      pixels: [
        '  0000  ',
        ' 022220 ',
        '02322320',
        '01111110',
        ' 011110 ',
        ' 012210 ',
        '  0110  ',
        '  0  0  ',
        '        ',
      ],
      face: { leftEye: [2, 2], rightEye: [5, 2], mouth: [3, 4] },
    },

    'baby-dragon': {
      pixels: [
        '          ',
        '  022220  ',
        ' 02222220 ',
        '0232112320',
        '0211111120',
        '0144444410',
        ' 04422440 ',
        '  044440  ',
        '  0    0  ',
        '          ',
      ],
      face: { leftEye: [2, 3], rightEye: [7, 3], mouth: [4, 4] },
    },

    'young-dragon': {
      pixels: [
        '            ',
        '  02222220  ',
        '  02222220  ',
        ' 0222222220 ',
        ' 0232112320 ',
        ' 0211111120 ',
        ' 0444444440 ',
        ' 0442222440 ',
        '  04444440  ',
        '  04444440  ',
        '   0    0   ',
        '            ',
      ],
      face: { leftEye: [3, 4], rightEye: [8, 4], mouth: [5, 5] },
    },

    'juvenile': {
      pixels: [
        '              ',
        '  0022222200  ',
        '  0222222220  ',
        ' 022222222220 ',
        ' 023211112320 ',
        ' 021111111120 ',
        '50444444444405',
        '50444222244405',
        ' 044444444440 ',
        '  0444444440  ',
        '   04444440   ',
        '   01    10   ',
        '   0      0   ',
        '              ',
      ],
      face: { leftEye: [3, 4], rightEye: [10, 4], mouth: [6, 5] },
    },

    'adolescent': {
      pixels: [
        '                ',
        '   0022222200   ',
        '  022222222220  ',
        '  022222222220  ',
        '  023211112320  ',
        '  021111111120  ',
        '5504444444444055',
        '5504442222444055',
        '5504444444444055',
        '  044444444440  ',
        '  044222244440  ',
        '   0444444440   ',
        '    01    10    ',
        '    0      0    ',
        '      6  6      ',
        '                ',
      ],
      face: { leftEye: [4, 4], rightEye: [11, 4], mouth: [7, 5] },
    },

    'adult-dragon': {
      pixels: [
        '                  ',
        '    0022222200    ',
        '   022222222220   ',
        '   022222222220   ',
        '   023211112320   ',
        '   021111111120   ',
        '555044444444440555',
        '555044422244440555',
        '555044444444440555',
        '   044444444440   ',
        '   044222244440   ',
        '    0444444440    ',
        '    0444444440    ',
        '     01    10     ',
        '     0      0     ',
        '       6  6       ',
        '                  ',
      ],
      face: { leftEye: [5, 4], rightEye: [12, 4], mouth: [8, 5] },
    },

    'elder-dragon': {
      pixels: [
        '                    ',
        '     0022222200     ',
        '    022222222220    ',
        '   02222222222220   ',
        '   02222222222220   ',
        '   02321111112320   ',
        '   02111111111120   ',
        '55504444444444440555',
        '55504444222444440555',
        '55504444444444440555',
        '55504444444444440555',
        '   04444444444440   ',
        '   04442222244440   ',
        '    0444444444440   ',
        '     04444444440    ',
        '      01    10      ',
        '      0      0      ',
        '        6  6        ',
      ],
      face: { leftEye: [5, 5], rightEye: [14, 5], mouth: [9, 6] },
    },

    'legendary': {
      pixels: [
        '                      ',
        '      0022222200      ',
        '     022222222220     ',
        '    02222222222220    ',
        '    02222222222220    ',
        '    02321111112320    ',
        '    02111111111120    ',
        '5555044444444444405555',
        '5555044442224444405555',
        '5555044444444444405555',
        '5555044444444444405555',
        '    04444444444440    ',
        '    04442222244440    ',
        '     0444444444440    ',
        '      04444444440     ',
        '       01    10       ',
        '       0      0       ',
        '         6776         ',
        '        6    6        ',
        '                      ',
      ],
      face: { leftEye: [6, 5], rightEye: [15, 5], mouth: [10, 6] },
    },
  },
};

// ─── 감정 정보 ───────────────────────────────────

const EMOTION_INFO = {
  'normal':   null,
  'happy':    { eyeShape: 'squint',  mouthShape: 'smile' },
  'sad':      { eyeShape: 'normal',  mouthShape: 'frown',  extra: 'tear' },
  'hungry':   { eyeShape: 'normal',  mouthShape: 'open' },
  'sleeping': { eyeShape: 'closed',  mouthShape: 'none',   extra: 'zzz' },
  'sick':     { eyeShape: 'spiral',  mouthShape: 'wavy',   extra: 'dizzy', filter: 'sick' },
  'tired':    { eyeShape: 'half',    mouthShape: 'small' },
  'dead':     { eyeShape: 'dead',    mouthShape: 'flat',   filter: 'dead' },
};

// ─── 메인 렌더링 함수 ───────────────────────────

function drawPixelSprite(ctx, stage, emotion, creatureType, colorVariant) {
  const type = creatureType || currentCreatureType;
  const color = colorVariant || currentColorVariant;
  const sprites = ALL_SPRITES[type];
  if (!sprites) return;

  const data = sprites[stage];
  if (!data) return;

  // 변형 팔레트 우선, 없으면 기본 팔레트
  const variantPalettes = ALL_VARIANT_PALETTES[type] && ALL_VARIANT_PALETTES[type][color];
  const palette = (variantPalettes && variantPalettes[stage]) || ALL_PALETTES[type][stage];

  const pixels = data.pixels;
  const h = pixels.length;
  const w = Math.max(...pixels.map(r => r.length));
  const px = PIXEL_SIZE;

  ctx.canvas.width = w * px;
  ctx.canvas.height = h * px;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const info = EMOTION_INFO[emotion];
  const isDead = info && info.filter === 'dead';
  const isSick = info && info.filter === 'sick';

  for (let y = 0; y < h; y++) {
    const row = pixels[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ' ') continue;
      let color = palette[ch];
      if (!color) continue;
      if (isDead) color = toGrayscale(color, 0.5);
      else if (isSick) color = shiftGreen(color);
      ctx.fillStyle = color;
      ctx.fillRect(x * px, y * px, px, px);
    }
  }

  if (data.face && info) {
    applyEmotion(ctx, data.face, info, palette, isDead);
  }
}

// ─── 감정 오버레이 ───────────────────────────────

function applyEmotion(ctx, face, info, palette, isDead) {
  const px = PIXEL_SIZE;
  const eyeColor = isDead ? '#666666' : (palette['3'] || '#1a0a00');
  const bodyColor = isDead ? toGrayscale(palette['1'], 0.5) : palette['1'];

  if (info.eyeShape === 'squint') {
    fillPixel(ctx, face.leftEye, bodyColor);
    fillPixel(ctx, face.rightEye, bodyColor);
    ctx.fillStyle = eyeColor;
    ctx.fillRect(face.leftEye[0] * px, face.leftEye[1] * px + px - 2, px, 2);
    ctx.fillRect(face.rightEye[0] * px, face.rightEye[1] * px + px - 2, px, 2);
  } else if (info.eyeShape === 'closed') {
    fillPixel(ctx, face.leftEye, bodyColor);
    fillPixel(ctx, face.rightEye, bodyColor);
    ctx.fillStyle = eyeColor;
    const midY = face.leftEye[1] * px + Math.floor(px / 2);
    ctx.fillRect(face.leftEye[0] * px, midY, px, 2);
    ctx.fillRect(face.rightEye[0] * px, midY, px, 2);
  } else if (info.eyeShape === 'half') {
    fillPixel(ctx, face.leftEye, bodyColor);
    fillPixel(ctx, face.rightEye, bodyColor);
    ctx.fillStyle = eyeColor;
    const half = face.leftEye[1] * px + Math.floor(px / 2);
    ctx.fillRect(face.leftEye[0] * px, half, px, Math.ceil(px / 2));
    ctx.fillRect(face.rightEye[0] * px, half, px, Math.ceil(px / 2));
  } else if (info.eyeShape === 'dead') {
    fillPixel(ctx, face.leftEye, bodyColor);
    fillPixel(ctx, face.rightEye, bodyColor);
    drawX(ctx, face.leftEye[0], face.leftEye[1], eyeColor);
    drawX(ctx, face.rightEye[0], face.rightEye[1], eyeColor);
  } else if (info.eyeShape === 'spiral') {
    fillPixel(ctx, face.leftEye, bodyColor);
    fillPixel(ctx, face.rightEye, bodyColor);
    ctx.fillStyle = '#44aa44';
    drawCircle(ctx, face.leftEye[0] * px + px / 2, face.leftEye[1] * px + px / 2, px / 3);
    drawCircle(ctx, face.rightEye[0] * px + px / 2, face.rightEye[1] * px + px / 2, px / 3);
  }

  const mx = face.mouth[0];
  const my = face.mouth[1];

  if (info.mouthShape === 'smile') {
    fillPixel(ctx, [mx, my], bodyColor);
    fillPixel(ctx, [mx + 1, my], bodyColor);
    ctx.fillStyle = eyeColor;
    ctx.fillRect(mx * px + 1, my * px + 2, px * 2 - 2, 2);
  } else if (info.mouthShape === 'frown') {
    fillPixel(ctx, [mx, my], bodyColor);
    fillPixel(ctx, [mx + 1, my], bodyColor);
    ctx.fillStyle = eyeColor;
    ctx.fillRect(mx * px + 1, my * px + px - 3, px * 2 - 2, 2);
  } else if (info.mouthShape === 'open') {
    fillPixel(ctx, [mx, my], bodyColor);
    ctx.fillStyle = eyeColor;
    const cx = mx * px + Math.floor(px / 2);
    const cy = my * px + 1;
    ctx.fillRect(cx - 2, cy, 5, 1);
    ctx.fillRect(cx - 3, cy + 1, 1, 3);
    ctx.fillRect(cx + 3, cy + 1, 1, 3);
    ctx.fillRect(cx - 2, cy + 4, 5, 1);
  } else if (info.mouthShape === 'wavy') {
    fillPixel(ctx, [mx, my], bodyColor);
    ctx.fillStyle = '#44aa44';
    ctx.fillRect(mx * px, my * px + 2, px, 2);
  } else if (info.mouthShape === 'flat') {
    fillPixel(ctx, [mx, my], bodyColor);
    fillPixel(ctx, [mx + 1, my], bodyColor);
    ctx.fillStyle = eyeColor;
    ctx.fillRect(mx * px, my * px + Math.floor(px / 2), px * 2, 2);
  } else if (info.mouthShape === 'none') {
    fillPixel(ctx, [mx, my], bodyColor);
    fillPixel(ctx, [mx + 1, my], bodyColor);
  } else if (info.mouthShape === 'small') {
    fillPixel(ctx, [mx, my], bodyColor);
    ctx.fillStyle = eyeColor;
    ctx.fillRect(mx * px + 1, my * px + Math.floor(px / 2), px - 2, 2);
  }

  if (info.extra === 'tear') {
    ctx.fillStyle = '#66ccff';
    ctx.fillRect(face.leftEye[0] * px + Math.floor(px / 2) - 1, (face.leftEye[1] + 1) * px, 3, px);
  }
  if (info.extra === 'zzz') {
    ctx.fillStyle = '#6699cc';
    ctx.font = `bold ${px * 2}px monospace`;
    ctx.fillText('z', (face.rightEye[0] + 2) * px, face.rightEye[1] * px + px);
    ctx.font = `bold ${Math.floor(px * 1.5)}px monospace`;
    ctx.fillText('z', (face.rightEye[0] + 3) * px, (face.rightEye[1] - 1) * px + px);
  }
  if (info.extra === 'dizzy') {
    ctx.fillStyle = '#ffcc00';
    ctx.font = `${px * 2}px monospace`;
    ctx.fillText('✦', (face.rightEye[0] + 2) * px, face.rightEye[1] * px + px);
  }
}

// ─── 유틸리티 ────────────────────────────────────

// ─── 장비 스프라이트 데이터 ──────────────────────

const EQUIPMENT_SPRITES = {
  // 무기 (오른쪽에 표시)
  'sword_wood':  { pixels: [' 1','1 ','1 '], colors: { '1': '#8B6914' }, anchor: 'right', offsetX: 2, offsetY: -1 },
  'sword_iron':  { pixels: [' 1','1 ','1 '], colors: { '1': '#A0A0B0' }, anchor: 'right', offsetX: 2, offsetY: -1 },
  'sword_flame': { pixels: [' 2','1 ','1 '], colors: { '1': '#CC3300', '2': '#FF6600' }, anchor: 'right', offsetX: 2, offsetY: -1 },
  'sword_legend':{ pixels: ['12','21','1 '], colors: { '1': '#FFD700', '2': '#FFF8DC' }, anchor: 'right', offsetX: 2, offsetY: -1 },
  // 악세사리 (머리 위 or 왼쪽)
  'shield_wood': { pixels: ['11','11','11'], colors: { '1': '#8B6914' }, anchor: 'left', offsetX: -3, offsetY: 0 },
  'shield_iron': { pixels: ['11','11','11'], colors: { '1': '#A0A0B0' }, anchor: 'left', offsetX: -3, offsetY: 0 },
  'ribbon':      { pixels: ['121','010'],    colors: { '0': '#FF69B4', '1': '#FF1493', '2': '#FFB6C1' }, anchor: 'top', offsetX: -1, offsetY: -2 },
  'crown':       { pixels: ['10101','01110'],colors: { '0': '#FFD700', '1': '#FFA500' }, anchor: 'top', offsetX: -2, offsetY: -2 },
};

function drawEquipment(ctx, face, equippedWeapon, equippedAccessory) {
  if (!face) return;
  const px = PIXEL_SIZE;

  const drawEquip = (equipPixel) => {
    if (!equipPixel) return;
    const sprite = EQUIPMENT_SPRITES[equipPixel];
    if (!sprite) return;

    let baseX, baseY;
    if (sprite.anchor === 'right') {
      baseX = face.rightEye[0] + sprite.offsetX;
      baseY = face.rightEye[1] + sprite.offsetY;
    } else if (sprite.anchor === 'left') {
      baseX = face.leftEye[0] + sprite.offsetX;
      baseY = face.leftEye[1] + sprite.offsetY;
    } else { // top
      const midX = Math.floor((face.leftEye[0] + face.rightEye[0]) / 2);
      baseX = midX + sprite.offsetX;
      baseY = face.leftEye[1] + sprite.offsetY;
    }

    for (let y = 0; y < sprite.pixels.length; y++) {
      const row = sprite.pixels[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === ' ') continue;
        const color = sprite.colors[ch];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect((baseX + x) * px, (baseY + y) * px, px, px);
      }
    }
  };

  if (equippedWeapon) drawEquip(equippedWeapon);
  if (equippedAccessory) drawEquip(equippedAccessory);
}

// ─── 유틸리티 ────────────────────────────────────

function fillPixel(ctx, pos, color) {
  ctx.fillStyle = color;
  ctx.fillRect(pos[0] * PIXEL_SIZE, pos[1] * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
}

function drawX(ctx, x, y, color) {
  const px = PIXEL_SIZE;
  const sx = x * px, sy = y * px;
  ctx.fillStyle = color;
  for (let i = 0; i < px; i++) {
    ctx.fillRect(sx + i, sy + i, 1, 1);
    ctx.fillRect(sx + px - 1 - i, sy + i, 1, 1);
  }
}

function drawCircle(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function toGrayscale(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  return `rgba(${gray},${gray},${gray},${opacity})`;
}

function shiftGreen(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  g = Math.min(1, g + 0.3);
  r *= 0.7;
  b *= 0.7;
  const h = v => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
