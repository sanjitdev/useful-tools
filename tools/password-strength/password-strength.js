/* ============================================
   Password Strength
   All analysis runs locally in the browser; nothing is sent over the wire.
   ============================================ */

(function () {
  'use strict';

  var pwEl = HT.$('#pw');
  var toggleBtn = HT.$('#toggle-pw');

  var labelEl = HT.$('#strength-label');
  var subEl = HT.$('#strength-sub');
  var barEl = HT.$('#bar-fill');

  var lengthEl = HT.$('#m-length');
  var classesEl = HT.$('#m-classes');
  var entropyEl = HT.$('#m-entropy');
  var charsetEl = HT.$('#m-charset');
  var onlineEl = HT.$('#crack-online');
  var offlineEl = HT.$('#crack-offline');
  var suggEl = HT.$('#suggestions');

  toggleBtn.addEventListener('click', function () {
    if (pwEl.type === 'password') { pwEl.type = 'text'; toggleBtn.textContent = 'Hide'; }
    else { pwEl.type = 'password'; toggleBtn.textContent = 'Show'; }
  });

  function analyze(pw) {
    var length = pw.length;
    var hasLower = /[a-z]/.test(pw);
    var hasUpper = /[A-Z]/.test(pw);
    var hasDigit = /[0-9]/.test(pw);
    var hasSymbol = /[^A-Za-z0-9]/.test(pw);
    var classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

    var charset = 0;
    if (hasLower) charset += 26;
    if (hasUpper) charset += 26;
    if (hasDigit) charset += 10;
    // Symbol charset estimate: ~33 printable ASCII symbols
    // (covers the common !@#$%^&* etc. subset). Sufficient for
    // a rough entropy estimate; the regex above also matches a
    // few extra printable chars but the rounding effect is small.
    if (hasSymbol) charset += 33;

    var entropy = length > 0 ? length * Math.log2(charset || 1) : 0;

    // Strength bucket
    var label, sub, score;
    if (length === 0) {
      label = '—'; sub = 'Start typing to see analysis.'; score = 0;
    } else if (length < 6) {
      label = 'Very weak'; sub = 'Too short — length matters most.'; score = 1;
    } else if (entropy < 28) {
      label = 'Very weak'; sub = 'Easily guessable.'; score = 1;
    } else if (entropy < 40) {
      label = 'Weak'; sub = 'Add more length and variety.'; score = 2;
    } else if (entropy < 60) {
      label = 'Fair'; sub = 'Reasonable, but could be stronger.'; score = 3;
    } else if (entropy < 80) {
      label = 'Strong'; sub = 'Solid password.'; score = 4;
    } else {
      label = 'Very strong'; sub = 'Excellent — hard to crack.'; score = 5;
    }

    var guesses = length > 0 ? Math.pow(charset || 1, length) : 0;

    return {
      length: length, classes: classes, charset: charset,
      entropy: entropy, label: label, sub: sub, score: score,
      hasLower: hasLower, hasUpper: hasUpper, hasDigit: hasDigit, hasSymbol: hasSymbol,
      guesses: guesses
    };
  }

  function fmtTime(seconds) {
    var YEAR_SECS = 86400 * 365.25;
    if (!isFinite(seconds) || seconds <= 0) return '—';
    if (seconds < 1) return 'less than a second';
    if (seconds < 60) return Math.round(seconds) + ' seconds';
    if (seconds < 3600) return Math.round(seconds / 60) + ' minutes';
    if (seconds < 86400) return Math.round(seconds / 3600) + ' hours';
    if (seconds < 86400 * 30) return Math.round(seconds / 86400) + ' days';
    if (seconds < YEAR_SECS) return Math.round(seconds / (86400 * 30)) + ' months';
    if (seconds < YEAR_SECS * 1000) return Math.round(seconds / YEAR_SECS) + ' years';
    if (seconds < YEAR_SECS * 1e6) return HT.formatNumber(Math.round(seconds / (YEAR_SECS * 1000))) + ' thousand years';
    if (seconds < YEAR_SECS * 1e9) return HT.formatNumber(Math.round(seconds / (YEAR_SECS * 1e6))) + ' million years';
    if (seconds < YEAR_SECS * 1e12) return HT.formatNumber(Math.round(seconds / (YEAR_SECS * 1e9))) + ' billion years';
    return 'effectively forever';
  }

  function renderSuggestions(pw, a) {
    var items = [];
    if (a.length === 0) {
      suggEl.innerHTML = '';
      return;
    }
    if (a.length < 14) items.push({ t: 'Increase length to 14+ characters.', k: 'warn' });
    if (!a.hasUpper) items.push({ t: 'Add uppercase letters.', k: 'warn' });
    if (!a.hasLower) items.push({ t: 'Add lowercase letters.', k: 'warn' });
    if (!a.hasDigit) items.push({ t: 'Add digits.', k: 'warn' });
    if (!a.hasSymbol) items.push({ t: 'Add a symbol (!, @, #, …).', k: 'warn' });

    // Repeated character / sequence detection (very light)
    if (/^(.)\1+$/.test(pw)) items.push({ t: 'Avoid repeating the same character.', k: 'warn' });
    if (/(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|qwer|asdf)/i.test(pw)) items.push({ t: 'Avoid obvious sequences (1234, qwerty, …).', k: 'warn' });

    if (a.length >= 14 && a.classes >= 3 && a.entropy >= 60) {
      items.push({ t: 'Looks great — long, varied, and high-entropy.', k: 'ok' });
    }

    suggEl.innerHTML = items.map(function (it) {
      return '<li class="' + it.k + '">' + it.t + '</li>';
    }).join('');
  }

  function update() {
    var pw = pwEl.value;
    var a = analyze(pw);

    labelEl.textContent = a.label;
    subEl.textContent = a.sub;
    barEl.className = 'bar-fill';
    if (a.score > 0) barEl.classList.add('s-' + a.score);
    barEl.style.width = (a.score / 5 * 100) + '%';

    lengthEl.textContent = HT.formatNumber(a.length);
    classesEl.textContent = a.classes + ' / 4';
    entropyEl.textContent = HT.formatNumber(a.entropy, { minFractionDigits: 0, maxFractionDigits: 1 }) + ' bits';
    charsetEl.textContent = HT.formatNumber(a.charset);

    if (a.guesses > 0) {
      onlineEl.textContent = fmtTime(a.guesses / 1e10);
      offlineEl.textContent = fmtTime(a.guesses / 1e11);
    } else {
      onlineEl.textContent = '—';
      offlineEl.textContent = '—';
    }

    renderSuggestions(pw, a);
  }

  pwEl.addEventListener('input', HT.debounce(update, 30));
  update();
})();