(function () {
  'use strict';

  var dataElement = document.getElementById('studio-data');
  if (!dataElement) return;
  var data;
  try { data = JSON.parse(dataElement.textContent); } catch (_) { return; }

  var $ = function (selector, root) { return (root || document).querySelector(selector); };
  var $$ = function (selector, root) { return Array.from((root || document).querySelectorAll(selector)); };

  var MAX_PICKS = 50;
  var MAX_QTY = 20;
  var storageKey = 'studio-picks-v1-' + data.slug;
  var picks = [];
  var toastTimer;
  var product = null;
  var galleryIndex = 0;
  var previousFocus = null;
  var productDialog = $('#product-dialog');
  var picksDialog = $('#picks-dialog');
  var galleryDialog = $('#gallery-dialog');
  var onCollectionPage = !!$('#collection-grid');

  function announce(message) {
    var toast = $('#toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 3600);
  }

  function getPiece(id) { return data.pieces.find(function (p) { return p.id === id; }); }
  function clean(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
  function signature(p) { return JSON.stringify([p.id, p.colour, p.size, p.notes]); }
  function pieceUrl(id) { return new URL(data.collectionUrl + '?piece=' + encodeURIComponent(id), location.href).href; }

  /* ---------- Saved picks ---------- */

  function addPick(item) {
    var existing = picks.find(function (p) { return signature(p) === signature(item); });
    if (existing) {
      existing.qty = Math.min(MAX_QTY, existing.qty + item.qty);
      return true;
    }
    if (picks.length >= MAX_PICKS) {
      announce('Your list has ' + MAX_PICKS + ' selections. Remove one before adding another.');
      return false;
    }
    picks.push(item);
    return true;
  }

  function readPicks() {
    picks = [];
    try {
      var stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(stored)) return;
      stored.slice(0, MAX_PICKS).forEach(function (p) {
        if (!p || !getPiece(p.id) || !Number.isInteger(p.qty) || p.qty < 1 || p.qty > MAX_QTY) return;
        addPick({ id: p.id, qty: p.qty, colour: clean(p.colour, 100), size: clean(p.size, 100), notes: clean(p.notes, 500) });
      });
    } catch (_) { picks = []; }
  }

  function savePicks() {
    try { localStorage.setItem(storageKey, JSON.stringify(picks)); }
    catch (_) { announce('Your picks are saved for this visit only. Browser storage is unavailable.'); }
    updateCount();
  }

  function updateCount() {
    var count = picks.reduce(function (sum, p) { return sum + p.qty; }, 0);
    $$('[data-picks-count]').forEach(function (el) { el.textContent = count; });
    $$('[data-open-picks]').forEach(function (el) {
      el.setAttribute('aria-label', 'Open my picks, ' + count + ' selected');
      el.classList.toggle('has-picks', count > 0);
    });
    var includeCount = $('#include-picks-count');
    if (includeCount) includeCount.textContent = picks.length ? '(' + picks.length + ' saved)' : '(none saved yet)';
  }

  /* ---------- Dialogs ---------- */

  function openDialog(dialog) {
    if (dialog.open) return;
    previousFocus = document.activeElement;
    dialog.showModal();
    document.documentElement.classList.add('dialog-open');
  }

  function closeDialog(dialog) { if (dialog.open) dialog.close(); }

  $$('dialog').forEach(function (dialog) {
    // A click on the dark backdrop lands on the dialog element itself.
    dialog.addEventListener('click', function (event) { if (event.target === dialog) closeDialog(dialog); });
    dialog.addEventListener('close', function () {
      if (!$$('dialog').some(function (d) { return d.open; })) document.documentElement.classList.remove('dialog-open');
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    });
    $('[data-close]', dialog).addEventListener('click', function () { closeDialog(dialog); });
  });

  /* ---------- Mobile menu ---------- */

  var menu = $('#nav-links');
  var menuToggle = $('#menu-toggle');
  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
  }
  menuToggle.addEventListener('click', function () { setMenu(!menu.classList.contains('is-open')); });
  $$('a', menu).forEach(function (link) { link.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); menuToggle.focus(); }
  });
  document.addEventListener('click', function (event) {
    if (menu.classList.contains('is-open') && !menu.contains(event.target) && !menuToggle.contains(event.target)) setMenu(false);
  });

  /* ---------- Piece details ---------- */

  function showPiece(id) {
    product = getPiece(id);
    if (!product) return;
    var image = $('#piece-image');
    $('#piece-title').textContent = product.title;
    $('#piece-category').textContent = product.category;
    $('#piece-description').textContent = product.description;
    image.src = product.images[0];
    image.alt = product.alt;
    $('#piece-form').reset();
    var thumbs = $('#piece-thumbs');
    thumbs.replaceChildren();
    product.images.forEach(function (src, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', 'View photograph ' + (index + 1) + ' of ' + product.title);
      button.setAttribute('aria-pressed', String(index === 0));
      var thumb = document.createElement('img');
      thumb.src = product.thumbs[index]; thumb.alt = ''; thumb.width = 55; thumb.height = 55;
      button.append(thumb);
      button.addEventListener('click', function () {
        image.src = src;
        image.alt = product.alt + ' (photograph ' + (index + 1) + ' of ' + product.images.length + ')';
        $$('button', thumbs).forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
      });
      thumbs.append(button);
    });
    thumbs.hidden = product.images.length < 2;
    $('#piece-share').href = pieceUrl(product.id);
    openDialog(productDialog);
  }

  $$('[data-piece]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (button.classList.contains('card-quick')) {
        var piece = getPiece(button.dataset.piece);
        if (piece && addPick({ id: piece.id, qty: 1, colour: '', size: '', notes: '' })) {
          savePicks();
          announce(piece.title + ' added to your picks.');
        }
        return;
      }
      showPiece(button.dataset.piece);
    });
  });

  $('#piece-form').addEventListener('submit', function (event) {
    event.preventDefault();
    if (!product || !event.target.reportValidity()) return;
    var quantity = Number($('#piece-qty').value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) return;
    var item = { id: product.id, qty: quantity, colour: clean($('#piece-colour').value, 100), size: clean($('#piece-size').value, 100), notes: clean($('#piece-notes').value, 500) };
    if (!addPick(item)) return;
    savePicks();
    closeDialog(productDialog);
    announce(product.title + ' added to your picks.');
  });

  /* ---------- Picks drawer ---------- */

  function picksText() {
    return picks.map(function (pick, index) {
      var piece = getPiece(pick.id);
      var lines = [(index + 1) + '. ' + piece.title + ' — quantity: ' + pick.qty];
      if (pick.colour) lines.push('Preferred colour: ' + pick.colour);
      if (pick.size) lines.push('Preferred size: ' + pick.size);
      if (pick.notes) lines.push('Notes: ' + pick.notes);
      lines.push('Photo reference: ' + pieceUrl(piece.id));
      return lines.join('\n');
    }).join('\n\n');
  }

  function requestText() {
    return 'Hello ' + data.name + '!\nI would like to ask about the following photo references:\n\n' + picksText() +
      '\n\nCould you confirm what is possible, current prices, timing and delivery options? Thank you.';
  }

  function waLink(text) { return 'https://wa.me/' + data.phone.replace(/\D/g, '') + '?text=' + encodeURIComponent(text); }

  function renderPicks() {
    var list = $('#picks-list');
    list.replaceChildren();
    $('#picks-empty').hidden = picks.length > 0;
    $('#picks-footer').hidden = picks.length === 0;
    picks.forEach(function (pick, index) {
      var piece = getPiece(pick.id);
      var li = document.createElement('li'); li.className = 'pick';
      var img = document.createElement('img'); img.src = piece.thumbs[0]; img.alt = piece.alt; img.width = 68; img.height = 90;
      var details = document.createElement('div');
      var heading = document.createElement('h3'); heading.textContent = piece.title;
      var prefs = document.createElement('p');
      prefs.textContent = [pick.colour ? 'Colour: ' + pick.colour : '', pick.size ? 'Size: ' + pick.size : '', pick.notes].filter(Boolean).join('\n') || 'Preferences to be discussed';
      var controls = document.createElement('div'); controls.className = 'pick-controls';
      function adjustButton(text, label, change) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.setAttribute('aria-label', label + ' ' + piece.title);
        b.disabled = change < 0 ? pick.qty <= 1 : pick.qty >= MAX_QTY;
        b.addEventListener('click', function () {
          pick.qty = Math.min(MAX_QTY, Math.max(1, pick.qty + change));
          savePicks(); renderPicks();
          // Re-rendering replaces the buttons, so put focus back on the same control.
          var row = $('#picks-list').children[index];
          var buttons = row ? $$('.pick-controls button', row) : [];
          var same = buttons[change < 0 ? 0 : 1], other = buttons[change < 0 ? 1 : 0];
          (same && !same.disabled ? same : other || $('#picks-title')).focus();
        });
        return b;
      }
      var count = document.createElement('span'); count.textContent = pick.qty; count.setAttribute('aria-label', 'Quantity ' + pick.qty);
      var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove'; remove.textContent = 'Remove';
      remove.setAttribute('aria-label', 'Remove ' + piece.title);
      remove.addEventListener('click', function () { picks.splice(index, 1); savePicks(); renderPicks(); $('#picks-title').focus(); announce('Selection removed.'); });
      controls.append(adjustButton('−', 'Decrease quantity of', -1), count, adjustButton('+', 'Increase quantity of', 1), remove);
      details.append(heading, prefs, controls); li.append(img, details); list.append(li);
    });
    $('#picks-whatsapp').href = waLink(requestText());
  }

  $('#picks-title').tabIndex = -1;
  $$('[data-open-picks]').forEach(function (button) {
    button.addEventListener('click', function () { renderPicks(); openDialog(picksDialog); });
  });
  $('#continue-browsing').addEventListener('click', function (event) {
    if (onCollectionPage) { event.preventDefault(); closeDialog(picksDialog); }
  });
  $('#clear-picks').addEventListener('click', function () {
    if (!window.confirm('Remove every saved pick from this browser?')) return;
    picks = []; savePicks(); renderPicks(); announce('Your picks have been cleared.');
  });

  // Keep the count right when picks change in another tab.
  window.addEventListener('storage', function (event) {
    if (event.key !== storageKey) return;
    readPicks(); updateCount();
    if (picksDialog.open) renderPicks();
  });

  /* ---------- Copy to clipboard ---------- */

  var copyField = $('#copy-fallback');
  async function copyText(text, button) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        announce('Copied. Paste it into your conversation.');
        return;
      }
    } catch (_) { /* Fall through to the route that also works over plain http. */ }
    copyField.value = text;
    // Inside an open modal dialog only the dialog is focusable, so the field must live there.
    var openDialogElement = $$('dialog').find(function (d) { return d.open; });
    (openDialogElement || button.parentElement).append(copyField);
    copyField.classList.remove('is-visible');
    copyField.hidden = false;
    copyField.focus();
    copyField.select();
    var copied = false;
    try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
    if (copied) {
      copyField.hidden = true;
      button.focus();
      announce('Copied. Paste it into your conversation.');
    } else {
      copyField.classList.add('is-visible');
      announce('Select and copy the text shown below.');
    }
  }
  $('#picks-copy').addEventListener('click', function (event) { copyText(requestText(), event.currentTarget); });

  /* ---------- Collection filters ---------- */

  var search = $('#collection-search');
  if (search) {
    var sortSelect = $('#collection-sort');
    var grid = $('#collection-grid');
    var activeCategory = 'All';
    var params = new URLSearchParams(location.search);
    var wanted = params.get('category');
    if (wanted && data.pieces.some(function (p) { return p.category === wanted; })) activeCategory = wanted;
    search.value = clean(params.get('q'), 100);
    if (['az', 'za'].indexOf(params.get('sort')) >= 0) sortSelect.value = params.get('sort');

    var applyFilters = function () {
      var query = search.value.trim().toLocaleLowerCase();
      var sort = sortSelect.value;
      var cards = $$('[data-card]', grid);
      cards.sort(function (a, b) {
        var pa = getPiece(a.dataset.card), pb = getPiece(b.dataset.card);
        if (sort === 'az') return pa.title.localeCompare(pb.title);
        if (sort === 'za') return pb.title.localeCompare(pa.title);
        return data.pieces.indexOf(pa) - data.pieces.indexOf(pb);
      });
      var visible = 0;
      cards.forEach(function (card) {
        var p = getPiece(card.dataset.card);
        var text = (p.title + ' ' + p.category + ' ' + p.description).toLocaleLowerCase();
        var match = (activeCategory === 'All' || p.category === activeCategory) && text.includes(query);
        card.hidden = !match;
        if (match) visible++;
        grid.append(card);
      });
      $$('[data-filter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.filter === activeCategory)); });
      $('#result-count').textContent = visible + ' of ' + data.pieces.length + ' photo collections';
      $('#collection-empty').hidden = visible > 0;

      // Keep the address shareable without adding history entries.
      var url = new URL(location.href);
      ['category', 'q', 'sort'].forEach(function (k) { url.searchParams.delete(k); });
      if (activeCategory !== 'All') url.searchParams.set('category', activeCategory);
      if (query) url.searchParams.set('q', search.value.trim());
      if (sort !== 'featured') url.searchParams.set('sort', sort);
      history.replaceState(history.state, '', url);
    };

    search.addEventListener('input', applyFilters);
    sortSelect.addEventListener('change', applyFilters);
    $$('[data-filter]').forEach(function (b) { b.addEventListener('click', function () { activeCategory = b.dataset.filter; applyFilters(); }); });
    $$('[data-reset]').forEach(function (b) {
      b.addEventListener('click', function () { search.value = ''; activeCategory = 'All'; sortSelect.value = 'featured'; applyFilters(); search.focus(); });
    });
    applyFilters();
  }

  /* ---------- Gallery lightbox ---------- */

  function showGallery(index) {
    galleryIndex = (index + data.gallery.length) % data.gallery.length;
    var photo = data.gallery[galleryIndex];
    var image = $('#lightbox-image');
    image.src = photo.src; image.alt = photo.alt; image.width = photo.width; image.height = photo.height;
    $('#lightbox-caption').textContent = photo.title;
    $('#lightbox-count').textContent = (galleryIndex + 1) + ' / ' + data.gallery.length;
  }
  $$('[data-gallery]').forEach(function (b) {
    b.addEventListener('click', function () { showGallery(Number(b.dataset.gallery)); openDialog(galleryDialog); });
  });
  $('#gallery-prev').addEventListener('click', function () { showGallery(galleryIndex - 1); });
  $('#gallery-next').addEventListener('click', function () { showGallery(galleryIndex + 1); });
  galleryDialog.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); showGallery(galleryIndex + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); showGallery(galleryIndex - 1); }
  });
  // Swipe left or right on phones.
  var touchStartX = null;
  galleryDialog.addEventListener('touchstart', function (e) { touchStartX = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  galleryDialog.addEventListener('touchend', function (e) {
    if (touchStartX === null) return;
    var dx = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(dx) > 50) showGallery(galleryIndex + (dx < 0 ? 1 : -1));
  });

  /* ---------- Enquiry form ---------- */

  var enquiryForm = $('#enquiry-form');
  var enquiryDraft = '';
  if (enquiryForm) {
    var interestSelect = $('#enquiry-interest');
    var includePicks = $('#include-picks');
    interestSelect.addEventListener('change', function () { if (interestSelect.value === 'My saved picks') includePicks.checked = true; });
    enquiryForm.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!enquiryForm.reportValidity()) return;
      var person = clean($('#enquiry-name').value, 100);
      var interest = interestSelect.value;
      var area = clean($('#enquiry-area').value, 100);
      var message = clean($('#enquiry-message').value, 2000);
      if (message.length < 10) {
        $('#enquiry-message').setCustomValidity('Please write at least 10 characters.');
        enquiryForm.reportValidity();
        $('#enquiry-message').setCustomValidity('');
        return;
      }
      enquiryDraft = 'Hello ' + data.name + '!\nMy name is ' + person + '.\nI am interested in: ' + interest + '.\n' +
        (area ? 'Delivery area: ' + area + '\n' : '') + '\n' + message;
      if (includePicks.checked && picks.length) enquiryDraft += '\n\nMy photo references:\n' + picksText();
      enquiryDraft += '\n\nCould you confirm the options, current price and timing? Thank you.';
      $('#enquiry-draft').value = enquiryDraft;
      $('#enquiry-whatsapp').href = waLink(enquiryDraft);
      $('#draft-result').hidden = false;
      $('#enquiry-draft').focus();
      announce('Your draft is ready to review. Nothing has been sent.');
    });
    $('#enquiry-copy').addEventListener('click', function (event) { copyText(enquiryDraft, event.currentTarget); });
  }

  /* ---------- Start ---------- */

  readPicks();
  updateCount();
  var deepPiece = new URLSearchParams(location.search).get('piece');
  if (deepPiece && getPiece(deepPiece)) {
    showPiece(deepPiece);
    var card = $('[data-card="' + CSS.escape(deepPiece) + '"]');
    if (card) card.scrollIntoView({ block: 'center' });
  }
})();
