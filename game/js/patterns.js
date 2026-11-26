// Patterns for the paints (design: art/assets.md, design/meta-rewards.md). A pattern is drawn tone-on-tone
// on the paint jar and on the main object of that colour in the picture. Patterns are chosen per picture,
// never repeated within one picture. price 0 = in the starter set; others are bought in the shop for stars.
// Tiles are in picture units (the picture is 360 x 480); `T` is replaced by the tone colour.
(function () {
  const P = [
    // starter set
    { id: 'check', price: 0, size: 16, svg: '<path d="M0,0H8V8H0ZM8,8H16V16H8Z" fill="T" fill-opacity=".55"/>' },
    { id: 'dots', price: 0, size: 12, svg: '<circle cx="3" cy="3" r="2.2" fill="T"/><circle cx="9" cy="9" r="2.2" fill="T"/>' },
    { id: 'stripes', price: 0, size: 12, rot: 45, svg: '<rect width="4.5" height="12" fill="T" fill-opacity=".7"/>' },
    { id: 'waves', price: 0, size: 18, svg: '<path d="M0,6C4.5,1 9,11 13.5,6S18,1 18,1M0,15C4.5,10 9,20 13.5,15S18,10 18,10" fill="none" stroke="T" stroke-width="2.2" stroke-linecap="round"/>' },
    { id: 'leaves', price: 0, size: 18, svg: '<path d="M4,13C4,7 9,4 13,4C13,9 9,13 4,13ZM4,13L9,8" fill="T" stroke="T" stroke-width=".8"/>' },
    { id: 'flowers', price: 0, size: 18, svg: '<g fill="T"><circle cx="9" cy="5.5" r="2.6"/><circle cx="12.5" cy="9" r="2.6"/><circle cx="9" cy="12.5" r="2.6"/><circle cx="5.5" cy="9" r="2.6"/></g>' },
    { id: 'stars', price: 0, size: 18, svg: '<path d="M9,3L10.6,7.1 15,7.3 11.6,10 12.8,14.3 9,11.8 5.2,14.3 6.4,10 3,7.3 7.4,7.1Z" fill="T"/>' },
    { id: 'clouds', price: 0, size: 22, svg: '<path d="M5,14C2.5,14 2.5,10 5,10C5,6.5 10,6 11,9C12,7 16.5,7.5 16,10.5C19,10.5 19,14 16.5,14Z" fill="T" fill-opacity=".75"/>' },
    { id: 'scales', price: 0, size: 14, svg: '<path d="M0,7A7,7 0 0 1 14,7M-7,14A7,7 0 0 1 7,14M7,14A7,7 0 0 1 21,14M-7,0A7,7 0 0 1 7,0M7,0A7,7 0 0 1 21,0" fill="none" stroke="T" stroke-width="1.8"/>' },
    { id: 'bricks', price: 0, size: 16, svg: '<path d="M0,0.8H16M0,8.8H16M4,0.8V8.8M12,8.8V16.8" fill="none" stroke="T" stroke-width="1.8"/>' },
    { id: 'sprinkles', price: 0, size: 18, svg: '<g stroke="T" stroke-width="2.2" stroke-linecap="round"><path d="M3,4L6,6M12,3L11,6.5M8,10L11,11M3,14L4,11M14,13L16,15"/></g>' },
    { id: 'hearts', price: 0, size: 18, svg: '<path d="M9,14C3,10 3,5.5 6,5.5C7.5,5.5 8.5,6.5 9,7.5C9.5,6.5 10.5,5.5 12,5.5C15,5.5 15,10 9,14Z" fill="T"/>' },
    // shop
    { id: 'fish', price: 20, size: 22, svg: '<path d="M4,11C7,6.5 13,6.5 16,11C13,15.5 7,15.5 4,11ZM16,11L20,7.5V14.5Z" fill="T"/>' },
    { id: 'berries', price: 20, size: 18, svg: '<g fill="T"><circle cx="7" cy="11" r="3"/><circle cx="12" cy="12" r="3"/></g><path d="M7,8C8,5 10,4 12,4M12,9C11.5,6 12,5 12,4" fill="none" stroke="T" stroke-width="1.2"/>' },
    { id: 'bows', price: 20, size: 20, svg: '<path d="M10,10L4,6V14ZM10,10L16,6V14Z" fill="T"/><circle cx="10" cy="10" r="2" fill="T"/>' },
    { id: 'paws', price: 20, size: 20, svg: '<g fill="T"><ellipse cx="10" cy="13" rx="3.6" ry="3"/><circle cx="5.5" cy="8.5" r="1.6"/><circle cx="8.3" cy="6" r="1.6"/><circle cx="11.7" cy="6" r="1.6"/><circle cx="14.5" cy="8.5" r="1.6"/></g>' },
    { id: 'daisies', price: 20, size: 20, svg: '<g fill="none" stroke="T" stroke-width="1.6"><circle cx="10" cy="10" r="2.2"/><path d="M10,2.5V6M10,14V17.5M2.5,10H6M14,10H17.5M4.7,4.7L7.2,7.2M12.8,12.8L15.3,15.3M15.3,4.7L12.8,7.2M7.2,12.8L4.7,15.3" stroke-linecap="round"/></g>' },
    { id: 'snowflakes', price: 10, size: 20, svg: '<g stroke="T" stroke-width="1.6" stroke-linecap="round"><path d="M10,3V17M3.9,6.5L16.1,13.5M3.9,13.5L16.1,6.5"/></g>' },
    { id: 'zigzag', price: 10, size: 16, svg: '<path d="M0,5L4,1 8,5 12,1 16,5M0,13L4,9 8,13 12,9 16,13" fill="none" stroke="T" stroke-width="2" stroke-linejoin="round"/>' },
    { id: 'moons', price: 10, size: 20, svg: '<path d="M12,4A6.5,6.5 0 1 0 15,15A5,5 0 1 1 12,4Z" fill="T"/>' },
    { id: 'drops', price: 10, size: 18, svg: '<path d="M9,3C12,8 13,10 13,12A4,4 0 0 1 5,12C5,10 6,8 9,3Z" fill="T"/>' },
    { id: 'triangles', price: 10, size: 16, svg: '<path d="M8,2L14,13H2Z" fill="T" fill-opacity=".7"/>' },
    { id: 'rings', price: 10, size: 16, svg: '<circle cx="8" cy="8" r="4.5" fill="none" stroke="T" stroke-width="2"/>' },
    { id: 'petals', price: 20, size: 20, svg: '<path d="M10,3C14,6 14,11 10,13C6,11 6,6 10,3Z" fill="T"/><path d="M3,15C6,13 9,14 10,17C7,18 4,18 3,15Z" fill="T" fill-opacity=".7"/>' },
  ];
  const byId = Object.fromEntries(P.map(p => [p.id, p]));

  // tone-on-tone: a darker shade of the paint (lighter for very dark paints)
  function tone(hex) {
    const v = parseInt(hex.slice(1), 16), r = v >> 16, g = v >> 8 & 255, b = v & 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b, k = lum < 90 ? 0.35 : -0.22;
    const m = x => Math.round(k > 0 ? x + (255 - x) * k : x * (1 + k));
    return '#' + ((m(r) << 16) | (m(g) << 8) | m(b)).toString(16).padStart(6, '0');
  }
  // <pattern> element: base colour + the tile in its tone; scale for small swatches (jars)
  function def(id, patternId, color, scale = 1) {
    const p = byId[patternId]; if (!p) return '';
    const tf = [p.rot ? `rotate(${p.rot})` : '', scale !== 1 ? `scale(${scale})` : ''].join(' ').trim();
    return `<pattern id="${id}" width="${p.size}" height="${p.size}" patternUnits="userSpaceOnUse"${tf ? ` patternTransform="${tf}"` : ''}>` +
      `<rect width="${p.size}" height="${p.size}" fill="${color}"/>${p.svg.replace(/="T"/g, `="${tone(color)}"`)}</pattern>`;
  }
  // default patterns of a picture: starter patterns in an order fixed by the picture id, none repeated
  function defaults(pic) {
    const free = P.filter(p => !p.price).map(p => p.id);
    let h = 0; for (const ch of pic.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const out = [];
    pic.palette.forEach((_, i) => { out.push(free[(h + i * 5) % free.length]); });
    // the step 5 is coprime with 12, so the first 12 colours never repeat
    return out;
  }

  window.Patterns = { list: P, get: id => byId[id], def, defaults, tone };
})();
