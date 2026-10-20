// Logo "2 · Só o F neon": o F da Yellowtail como contorno vetorial, centralizado pela caixa real do traço.
import opentype from 'opentype.js';
import { readFileSync, writeFileSync } from 'node:fs';
const D = process.argv[2];
const buf = readFileSync(
  `${D}/node_modules/@fontsource/yellowtail/files/yellowtail-latin-400-normal.woff`,
);
const fonte = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const base = fonte.getPath('F', 0, 0, 1000);
const b = base.getBoundingBox();
const largura = b.x2 - b.x1,
  altura = b.y2 - b.y1;
console.log('bbox', Math.round(largura), Math.round(altura));

/** `alturaRel`: altura do F em relação ao lado do quadro (o brilho ocupa a folga). */
function letra(alturaRel) {
  const escala = (512 * alturaRel) / altura;
  const dx = 256 - (b.x1 + largura / 2) * escala;
  const dy = 256 - (b.y1 + altura / 2) * escala;
  const p = fonte.getPath('F', 0, 0, 1000 * escala);
  const d = p.toPathData(2);
  const em = 1000 * escala; // tamanho de fonte equivalente, para o brilho seguir o CSS (0,03/0,09/0,2 em)
  return { d, dx, dy, em };
}
function svg({ fundo, alturaRel }) {
  const { d, dx, dy, em } = letra(alturaRel);
  const s = (k) => (k * em) / 2; // text-shadow raio r ≈ stdDeviation r/2
  const fundoSvg =
    fundo === 'quadrado'
      ? '<rect width="512" height="512" fill="#120720" />'
      : fundo === 'arredondado'
        ? '<rect width="512" height="512" rx="104" fill="#120720" />'
        : fundo === 'circular'
          ? '<circle cx="256" cy="256" r="256" fill="#120720" />'
          : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <filter id="neon" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
      <feMorphology in="SourceAlpha" operator="dilate" radius="0" result="a" />
      <feGaussianBlur in="a" stdDeviation="${s(0.2).toFixed(1)}" result="b3" />
      <feGaussianBlur in="a" stdDeviation="${s(0.09).toFixed(1)}" result="b2" />
      <feGaussianBlur in="a" stdDeviation="${s(0.03).toFixed(1)}" result="b1" />
      <feMerge result="halo"><feMergeNode in="b3" /><feMergeNode in="b2" /><feMergeNode in="b1" /></feMerge>
      <feFlood flood-color="#ff2a8a" />
      <feComposite in2="halo" operator="in" result="rosa" />
      <feMerge><feMergeNode in="rosa" /><feMergeNode in="rosa" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>
  ${fundoSvg}
  <path transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)})" filter="url(#neon)" fill="#ffe3f1" d="${d}" />
</svg>
`;
}
const variantes = {
  'logo-quadrado': { fundo: 'quadrado', alturaRel: 0.6 },
  'logo-arredondado': { fundo: 'arredondado', alturaRel: 0.6 },
  'logo-circular': { fundo: 'circular', alturaRel: 0.56 },
  'logo-sem-fundo': { fundo: null, alturaRel: 0.72 },
  // Maskable: o Android recorta até 20% de cada lado; o F fica na zona segura.
  'logo-maskable': { fundo: 'quadrado', alturaRel: 0.48 },
};
for (const [nome, v] of Object.entries(variantes)) writeFileSync(`${D}/${nome}.svg`, svg(v));
