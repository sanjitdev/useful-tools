/* ============================================
   Random Tools
   Modes: number, password, dice, coin
   ============================================ */

(function () {
  'use strict';

  // Crypto-backed random integer in [min, max]
  function randInt(min, max) {
    if (max <= min) return min;
    var range = max - min + 1;
    if (window.crypto && window.crypto.getRandomValues) {
      var buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return min + (buf[0] % range);
    }
    return Math.floor(Math.random() * range) + min;
  }

  // Crypto-backed random float in [0, 1)
  function randFloat() {
    if (window.crypto && window.crypto.getRandomValues) {
      var buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return buf[0] / 4294967296;
    }
    return Math.random();
  }

  // -------- Number --------
  var nMin = HT.$('#n-min');
  var nMax = HT.$('#n-max');
  var nCount = HT.$('#n-count');
  var nInt = HT.$('#n-int');
  var nUnique = HT.$('#n-unique');
  var nGen = HT.$('#n-gen');

  function genNumbers() {
    var min = parseFloat(nMin.value);
    var max = parseFloat(nMax.value);
    var count = Math.min(100, Math.max(1, parseInt(nCount.value, 10) || 1));
    var integer = nInt.checked;
    var unique = nUnique.checked;

    if (isNaN(min) || isNaN(max)) {
      HT.$('#n-result').textContent = '—';
      HT.$('#n-sub').textContent = 'Enter valid min/max.';
      return;
    }
    if (min > max) {
      HT.$('#n-result').textContent = '—';
      HT.$('#n-sub').textContent = 'Min must be ≤ max.';
      return;
    }

    var results = [];
    if (unique) {
      // generate without replacement
      var intMin = integer ? Math.ceil(min) : Math.floor(min);
      var intMax = integer ? Math.floor(max) : Math.ceil(max);
      if (integer && (intMax - intMin + 1) < count) {
        HT.$('#n-result').textContent = '—';
        HT.$('#n-sub').textContent = 'Not enough unique integers in range.';
        return;
      }
      var used = {};
      while (results.length < count) {
        var v;
        if (integer) {
          v = randInt(intMin, intMax);
        } else {
          v = min + randFloat() * (max - min);
        }
        var key = integer ? v : v.toFixed(6);
        if (used[key]) continue;
        used[key] = true;
        results.push(v);
      }
    } else {
      for (var i = 0; i < count; i++) {
        if (integer) {
          results.push(randInt(Math.ceil(min), Math.floor(max)));
        } else {
          results.push(min + randFloat() * (max - min));
        }
      }
    }

    HT.$('#n-result').textContent = results.map(function (v) {
      return integer ? v : HT.formatNumber(v, { minFractionDigits: 0, maxFractionDigits: 6 });
    }).join(', ');
    HT.$('#n-sub').textContent =
      'Range ' + min + '–' + max + ' · ' + count + ' value' + (count === 1 ? '' : 's') +
      ' · ' + (unique ? 'unique' : 'with replacement');
  }

  nGen.addEventListener('click', genNumbers);
  nCount.addEventListener('input', HT.debounce(genNumbers, 100));
  nMin.addEventListener('change', genNumbers);
  nMax.addEventListener('change', genNumbers);
  nInt.addEventListener('change', genNumbers);
  nUnique.addEventListener('change', genNumbers);

  // -------- Password --------
  var pLen = HT.$('#p-len');
  var pLenVal = HT.$('#p-len-val');
  var pUp = HT.$('#p-up');
  var pLo = HT.$('#p-lo');
  var pNum = HT.$('#p-num');
  var pSym = HT.$('#p-sym');
  var pGen = HT.$('#p-gen');
  var pCopy = HT.$('#p-copy');
  var pStrength = HT.$('#p-strength');
  var pStrengthLabel = HT.$('#p-strength-label');

  var SETS = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    digits: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{};:,.<>/?'
  };

  function pickRandom(str) {
    return str.charAt(Math.floor(randFloat() * str.length));
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(randFloat() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function strengthBits(pwd) {
    var pool = 0;
    if (/[a-z]/.test(pwd)) pool += 26;
    if (/[A-Z]/.test(pwd)) pool += 26;
    if (/[0-9]/.test(pwd)) pool += 10;
    if (/[^A-Za-z0-9]/.test(pwd)) pool += 33;
    if (pool === 0) return 0;
    return pwd.length * (Math.log(pool) / Math.LN2);
  }

  function classifyStrength(bits) {
    if (bits < 40) return { cls: 's-weak', label: 'Weak' };
    if (bits < 80) return { cls: 's-medium', label: 'Medium' };
    return { cls: 's-strong', label: 'Strong' };
  }

  function genPassword() {
    var length = parseInt(pLen.value, 10) || 16;
    var sets = [];
    if (pUp.checked) sets.push(SETS.upper);
    if (pLo.checked) sets.push(SETS.lower);
    if (pNum.checked) sets.push(SETS.digits);
    if (pSym.checked) sets.push(SETS.symbols);

    if (sets.length === 0) {
      HT.$('#p-result').textContent = '—';
      HT.$('#p-sub').textContent = 'Pick at least one character type.';
      pStrength.style.width = '0%';
      pStrength.className = 'strength-bar-fill';
      pStrengthLabel.textContent = 'Strength: —';
      return;
    }

    var pool = sets.join('');
    var chars = [];
    // ensure at least one from each selected set
    sets.forEach(function (s) { chars.push(pickRandom(s)); });
    while (chars.length < length) {
      chars.push(pickRandom(pool));
    }
    chars = shuffle(chars);
    var pwd = chars.join('').slice(0, length);

    HT.$('#p-result').textContent = pwd;
    HT.$('#p-sub').textContent = 'Length ' + length + ' · ' + sets.length + ' character set' + (sets.length === 1 ? '' : 's');

    var bits = strengthBits(pwd);
    var cls = classifyStrength(bits);
    pStrength.className = 'strength-bar-fill ' + cls.cls;
    // Map 0-128 bits to 5-100%
    var pct = Math.min(100, Math.max(5, (bits / 128) * 100));
    pStrength.style.width = pct + '%';
    pStrengthLabel.textContent = 'Strength: ' + cls.label + ' (' + Math.round(bits) + ' bits)';
  }

  pLen.addEventListener('input', function () {
    pLenVal.textContent = pLen.value;
    genPassword();
  });
  pUp.addEventListener('change', genPassword);
  pLo.addEventListener('change', genPassword);
  pNum.addEventListener('change', genPassword);
  pSym.addEventListener('change', genPassword);
  pGen.addEventListener('click', genPassword);
  pCopy.addEventListener('click', function () {
    var txt = HT.$('#p-result').textContent;
    if (!txt || txt === '—') return;
    HT.copyToClipboard(txt);
  });

  // -------- Dice --------
  var dType = HT.$('#d-type');
  var dCount = HT.$('#d-count');
  var dRoll = HT.$('#d-roll');

  function rollDice() {
    var sides = parseInt(dType.value, 10);
    var count = Math.min(20, Math.max(1, parseInt(dCount.value, 10) || 1));
    var rolls = [];
    for (var i = 0; i < count; i++) rolls.push(randInt(1, sides));

    var total = rolls.reduce(function (a, b) { return a + b; }, 0);
    var min = rolls.reduce(function (a, b) { return Math.min(a, b); }, rolls[0]);
    var max = rolls.reduce(function (a, b) { return Math.max(a, b); }, rolls[0]);

    HT.$('#d-result').textContent = total;
    HT.$('#d-sub').textContent =
      count + 'd' + sides + ' · min ' + min + ' · max ' + max + ' · avg ' +
      HT.formatNumber(total / count, { minFractionDigits: 1, maxFractionDigits: 2 });

    var list = HT.$('#d-list');
    list.innerHTML = '';
    rolls.forEach(function (r) {
      var span = document.createElement('span');
      span.className = 'die';
      if (r === sides && sides > 1) span.classList.add('is-max');
      else if (r === 1 && sides > 1) span.classList.add('is-min');
      span.textContent = r;
      list.appendChild(span);
    });
  }

  dRoll.addEventListener('click', rollDice);
  dType.addEventListener('change', rollDice);
  dCount.addEventListener('input', HT.debounce(rollDice, 100));

  // -------- Coin --------
  var cCount = HT.$('#c-count');
  var cFlip = HT.$('#c-flip');
  var cBarHeads = HT.$('#c-bar-heads');
  var cBarTails = HT.$('#c-bar-tails');
  var cPctHeads = HT.$('#c-pct-heads');
  var cPctTails = HT.$('#c-pct-tails');

  function flipCoins() {
    var count = Math.min(100, Math.max(1, parseInt(cCount.value, 10) || 1));
    var heads = 0;
    for (var i = 0; i < count; i++) {
      if (randFloat() < 0.5) heads++;
    }
    var tails = count - heads;
    var hPct = (heads / count) * 100;
    var tPct = (tails / count) * 100;

    HT.$('#c-heads').textContent = heads;
    HT.$('#c-tails').textContent = tails;
    HT.$('#c-total').textContent = count;

    cBarHeads.style.width = hPct + '%';
    cBarTails.style.width = tPct + '%';
    cPctHeads.textContent = Math.round(hPct) + '%';
    cPctTails.textContent = Math.round(tPct) + '%';
  }

  cFlip.addEventListener('click', flipCoins);
  cCount.addEventListener('input', HT.debounce(flipCoins, 100));

  HT.makeTabs(HT.$('#mode-tabs'));

  // Default results so the page looks alive
  genNumbers();
  genPassword();
  rollDice();
  flipCoins();
})();