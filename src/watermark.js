import sharp from 'sharp';

const GRAVITY_MAP = {
  northwest: { anchor: 'start', x: 10, y: 10 },
  northeast: { anchor: 'end', x: -10, y: 10 },
  southwest: { anchor: 'start', x: 10, y: -10 },
  southeast: { anchor: 'end', x: -10, y: -10 },
  center: { anchor: 'middle', x: 0, y: 0 },
};

export async function applyWatermark(buffer, text, options = {}) {
  const {
    gravity = 'southeast',
    opacity = 0.5,
    fontSize = 36,
    color = 'white',
  } = options;

  const metadata = await sharp(buffer).metadata();
  const w = metadata.width;
  const h = metadata.height;

  const g = GRAVITY_MAP[gravity] || GRAVITY_MAP.southeast;

  let x, y, textAnchor;
  if (gravity === 'center') {
    x = '50%';
    y = '50%';
    textAnchor = 'middle';
  } else if (g.anchor === 'end') {
    x = w + g.x;
    y = h + g.y;
    textAnchor = 'end';
  } else if (gravity === 'northwest') {
    x = g.x;
    y = g.y;
    textAnchor = 'start';
  } else {
    x = g.x;
    y = h + g.y;
    textAnchor = 'start';
  }

  const svg = `<svg width="${w}" height="${h}">
  <text
    x="${x}" y="${y}" text-anchor="${textAnchor}"
    font-family="monospace" font-size="${fontSize}"
    fill="${color}" opacity="${opacity}"
    dominant-baseline="${gravity === 'center' ? 'central' : 'auto'}">
    ${escapeXml(text)}
  </text>
</svg>`;

  return sharp(buffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
