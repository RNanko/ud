// Keep imported geometry, but use Finance's orange spending / sky revenue palette.
// One restrained halo replaces the original stacked blur layers at small sizes.
export function styleFinanceIcon(svg, kind) {
  if (!['spending', 'revenue'].includes(kind)) throw Error('Unknown Finance icon kind');
  const body = svg.slice(svg.indexOf('</defs>') + 7, svg.lastIndexOf('</svg>')).trim();
  let glyph;
  if (svg.includes('id="financeInk"')) {
    // Already styled: imports and local regeneration must be idempotent.
    return kind === 'revenue' ? svg.replace('<g filter="url(#financeGlow)">', '<g filter="url(#financeGlow)" transform="translate(-8 -8) scale(1.25)">') : svg;
  } else if (kind === 'spending') {
    glyph = body.split(/\r?\n/).filter(line => !line.includes('filter="url(#')).join('\n');
    if (!glyph.includes('url(#neonInk)')) throw Error('Unexpected spending icon geometry');
    glyph = glyph.replaceAll('url(#neonInk)', 'url(#financeInk)');
  } else {
    if (!body.includes('stroke="url(#g)"')) throw Error('Unexpected revenue icon geometry');
    glyph = body.replaceAll('url(#g)', 'url(#financeInk)').replace(' filter="url(#glow)"', '');
  }
  const [highlight, ink] = kind === 'spending' ? ['#FED7AA', '#FB923C'] : ['#BAE6FD', '#38BDF8'];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="financeInk" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="${highlight}"/>
      <stop offset="0.55" stop-color="${ink}"/>
      <stop offset="1" stop-color="${ink}"/>
    </linearGradient>
    <filter id="financeGlow" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="0.8"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g filter="url(#financeGlow)"${kind === 'revenue' ? ' transform="translate(-8 -8) scale(1.25)"' : ''}>${glyph}</g>
</svg>
`;
}
