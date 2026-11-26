// Gallery decor bought for sugar stars (design/meta-rewards.md, 20 stars each): a frame for each finished picture
// (chosen on the colouring screen) and one wallpaper for the whole gallery (chosen in the shop).
// The look is CSS: .frame.f-<id> and #gallery.w-<id> in style.css. price 0 = everyone has it.
(function () {
  const FRAMES = [
    { id: 'wood', price: 0, swatch: '#d2a77f' },
    { id: 'mint', price: 20, swatch: '#a6e3d2' },
    { id: 'rose', price: 20, swatch: '#f9c6d0' },
    { id: 'lace', price: 20, swatch: '#fff' },
    { id: 'gold', price: 20, swatch: '#f0c24e' },
    { id: 'cloud', price: 20, swatch: '#a9cff0' },
    { id: 'lilac', price: 20, swatch: '#c9b8f0' },
  ];
  const WALLS = [
    { id: 'stripes', price: 0 },
    { id: 'dots', price: 20 },
    { id: 'gingham', price: 20 },
    { id: 'sakura', price: 20 },
    { id: 'night', price: 20 },
  ];
  const all = FRAMES.concat(WALLS);
  window.Decor = { frames: FRAMES, walls: WALLS, get: id => all.find(d => d.id === id) };
})();
