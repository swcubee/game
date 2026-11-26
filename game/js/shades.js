// Replacement shades (design/meta-rewards.md): bought in the shop for stars, a shade replaces a paint of its family
// in one picture (numbers stay, only the colour changes). A shade is offered only when it stays distinct from every
// other paint of that picture: CIE76 delta E >= MIN_DE with normal vision and with protanopia, deuteranopia (Vienot 1999)
// and tritanopia (Machado 2009) simulated. The family is the base paint the shade belongs to (Zefir palette, art/palette-zefir-v3).
(function () {
  const MIN_DE = 12;
  const L = [
    { id: 'honey', base: '#F9E58A', hex: '#F0C24E', price: 60 },
    { id: 'raspberry', base: '#F9C6D0', hex: '#EE9BB5', price: 60 },
    { id: 'mint', base: '#A9CFF0', hex: '#A6E3D2', price: 70 },
    { id: 'pistachio', base: '#CDEBB4', hex: '#A0BE5A', price: 50 },
    { id: 'sunset', base: '#F59E86', hex: '#F8B48A', price: 60 },
    { id: 'lavender', base: '#B39BE3', hex: '#9F87DE', price: 70 },
    { id: 'seawave', base: '#4FAFA6', hex: '#5AA3C4', price: 70 },
    { id: 'chocolate', base: '#8B6656', hex: '#5E3D30', price: 50 },
    { id: 'caramel', base: '#E9CBA7', hex: '#C19E4D', price: 50 },
  ];
  const byId = Object.fromEntries(L.map(s => [s.id, s]));

  const lin = v => (v /= 255) <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  const rgb = hex => { const v = parseInt(hex.slice(1), 16); return [lin(v >> 16), lin(v >> 8 & 255), lin(v & 255)]; };
  const mul = (m, c) => m.map(r => r[0] * c[0] + r[1] * c[1] + r[2] * c[2]);
  const SIM = [
    null,
    [[0.11238, 0.88762, 0], [0.11238, 0.88762, 0], [0.00401, -0.00401, 1]],      // protanopia
    [[0.29275, 0.70725, 0], [0.29275, 0.70725, 0], [-0.02234, 0.02234, 1]],      // deuteranopia
    [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3089]],   // tritanopia (Machado 2009)
  ];
  function lab(c) {
    const [x, y, z] = mul([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]], c);
    const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    const fx = f(x / 0.95047), fy = f(y), fz = f(z / 1.08883);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  // smallest delta E of two colours over normal vision and the simulated colour blindness types
  function deltaE(a, b) {
    const ca = rgb(a), cb = rgb(b);
    return Math.min(...SIM.map(m => {
      const la = lab(m ? mul(m, ca) : ca), lb = lab(m ? mul(m, cb) : cb);
      return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
    }));
  }
  // may `shade` replace paint c of a picture? base: the picture's own palette, colours: its colours now (with shades)
  function fits(shade, base, colours, c) {
    if (shade.base.toLowerCase() !== base[c].toLowerCase()) return false;
    return colours.every((col, i) => i === c || deltaE(shade.hex, col) >= MIN_DE);
  }
  const family = base => L.filter(s => s.base.toLowerCase() === base.toLowerCase());

  window.Shades = { list: L, get: id => byId[id], family, fits, deltaE, MIN_DE };
})();
