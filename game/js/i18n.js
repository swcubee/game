// UI strings. The portal passes a locale through QSPlaySDK.game.getConfig();
// add a language by adding a block below with the same keys.
(function () {
  const STR = {
    ru: {
      brew: 'Смешать краски', brewDone: 'Красок хватает', soon: 'Скоро новые картины',
      level: 'Уровень {n}', gallery: 'Галерея',
      winTitle: 'Готово!', winText: 'Краски для картины:', toPaint: 'Рисовать',
      loseTitle: 'Краски застыли', loseText: 'Ходов больше нет. Флаконы будут те же.', retry: 'Ещё раз',
      loseMoves: 'Ходы закончились. Флаконы будут те же.', moves: 'Ходы',
      noMoves: 'Ходов нет — отмени ход', enough: 'хватает',
      picDone: 'Картина готова!', next: 'Следующая картина', toGallery: 'В галерею', leave: 'Выйти из уровня?', leaveText: 'Прогресс уровня не сохранится.', stay: 'Остаться', exit: 'Выйти',
      progress: '{a} из {b}',
    },
    en: {
      brew: 'Brew paint', brewDone: 'Enough paint', soon: 'New pictures soon',
      level: 'Level {n}', gallery: 'Gallery',
      winTitle: 'Done!', winText: 'Paint for your picture:', toPaint: 'Paint',
      loseTitle: 'The paint has set', loseText: 'No moves left. You will get the same flasks.', retry: 'Try again',
      loseMoves: 'Out of moves. You will get the same flasks.', moves: 'Moves',
      noMoves: 'No moves — undo one', enough: 'enough',
      picDone: 'Picture finished!', next: 'Next picture', toGallery: 'To the gallery', leave: 'Leave the level?', leaveText: 'Level progress will be lost.', stay: 'Stay', exit: 'Leave',
      progress: '{a} of {b}',
    },
  };
  let lang = 'en';
  window.I18N = {
    setLocale(loc) { const l = String(loc || '').slice(0, 2).toLowerCase(); lang = STR[l] ? l : (['uk', 'be', 'kk'].includes(l) ? 'ru' : 'en'); document.documentElement.lang = lang; },
    lang: () => lang,
    t(key, vars) { let s = (STR[lang] && STR[lang][key]) || STR.en[key] || key; if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]); return s; },
    apply() { document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = this.t(el.dataset.i18n); }); },
  };
})();
