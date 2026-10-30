(function () {
  'use strict';
  var data = window.STUDIO;
  if (!data) return;
  var $ = function (s, root) { return (root || document).querySelector(s); };
  var $$ = function (s, root) { return Array.from((root || document).querySelectorAll(s)); };
  var storageKey = 'studio-picks-v1-' + data.slug;
  var picks = [];
  var toastTimer;
  var product = null;
  var galleryIndex = 0;
  var previousFocus = null;
  var productDialog = $('#product-dialog');
  var picksDialog = $('#picks-dialog');
  var galleryDialog = $('#gallery-dialog');
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
  function readPicks() {
    try {
      var stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(stored)) return;
      stored.slice(0, 50).forEach(function (p) {
        if (!p || !getPiece(p.id) || !Number.isInteger(p.qty) || p.qty < 1 || p.qty > 20) return;
        var valid = {id:p.id, qty:p.qty, colour:clean(p.colour,100), size:clean(p.size,100), notes:clean(p.notes,500)};
        var existing = picks.find(function (item) { return signature(item) === signature(valid); });
        if (existing) existing.qty = Math.min(20, existing.qty + valid.qty);
        else picks.push(valid);
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
    $$('[data-open-picks]').forEach(function (el) { el.setAttribute('aria-label', 'Open my picks, ' + count + ' selected'); });
  }
  function openDialog(dialog) {
    if (dialog.open) return;
    previousFocus = document.activeElement;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
  }
  function closeDialog(dialog) { if (dialog.open) dialog.close(); }
  $$('dialog').forEach(function (dialog) {
    dialog.addEventListener('click', function (event) { if (event.target === dialog) closeDialog(dialog); });
    dialog.addEventListener('close', function () {
      document.body.style.overflow = '';
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    });
    $('[data-close]', dialog).addEventListener('click', function () { closeDialog(dialog); });
  });
  var menu = $('#nav-links');
  var menuToggle = $('#menu-toggle');
  function closeMenu() { menu.classList.remove('is-open'); menuToggle.setAttribute('aria-expanded','false'); }
  menuToggle.addEventListener('click', function () {
    var open = menu.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });
  $$('a', menu).forEach(function (link) { link.addEventListener('click', closeMenu); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeMenu(); });
  function showPiece(id) {
    product = getPiece(id);
    if (!product) return;
    $('#piece-title').textContent = product.title;
    $('#piece-category').textContent = product.category;
    $('#piece-description').textContent = product.description;
    $('#piece-image').src = product.images[0];
    $('#piece-image').alt = product.alt;
    $('#piece-form').reset();
    var thumbs = $('#piece-thumbs');
    thumbs.replaceChildren();
    product.images.forEach(function (src, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label','View photograph ' + (index + 1) + ' of ' + product.title);
      button.setAttribute('aria-pressed', String(index === 0));
      var image = document.createElement('img');
      image.src = src; image.alt = ''; image.width = 55; image.height = 55;
      button.append(image);
      button.addEventListener('click', function () {
        $('#piece-image').src = src;
        $$('button', thumbs).forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
      });
      thumbs.append(button);
    });
    thumbs.hidden = product.images.length < 2;
    var share = $('#piece-share');
    share.href = 'collection.html?piece=' + encodeURIComponent(product.id);
    openDialog(productDialog);
  }
  $$('[data-piece]').forEach(function (button) {
    button.addEventListener('click', function () { showPiece(button.dataset.piece); });
  });
  $('#piece-form').addEventListener('submit', function (event) {
    event.preventDefault();
    if (!product || !event.target.reportValidity()) return;
    var quantity = Number($('#piece-qty').value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return;
    var item = {id:product.id, qty:quantity, colour:clean($('#piece-colour').value,100), size:clean($('#piece-size').value,100), notes:clean($('#piece-notes').value,500)};
    var existing = picks.find(function (p) { return signature(p) === signature(item); });
    if (!existing && picks.length >= 50) { announce('Your list has 50 selections. Remove a selection before adding another.'); return; }
    if (existing) existing.qty = Math.min(20, existing.qty + item.qty);
    else picks.push(item);
    savePicks();
    closeDialog(productDialog);
    announce(product.title + ' added to your picks.');
  });
  function picksText() {
    return picks.map(function (pick, index) {
      var piece = getPiece(pick.id);
      var lines = [(index + 1) + '. ' + piece.title + ' — quantity: ' + pick.qty];
      if (pick.colour) lines.push('Preferred colour: ' + pick.colour);
      if (pick.size) lines.push('Preferred size: ' + pick.size);
      if (pick.notes) lines.push('Notes: ' + pick.notes);
      lines.push('Photo reference: ' + new URL('collection.html?piece=' + encodeURIComponent(piece.id), location.href).href);
      return lines.join('\n');
    }).join('\n\n');
  }
  function requestText() {
    return 'Hello ' + data.name + '!\nI would like to ask about the following photo references:\n\n' + picksText() + '\n\nCould you confirm what is possible, current prices, timing and delivery options? Thank you.';
  }
  function waLink(text) { return 'https://wa.me/' + data.phone.replace(/\D/g,'') + '?text=' + encodeURIComponent(text); }
  function renderPicks() {
    var list = $('#picks-list');
    list.replaceChildren();
    $('#picks-empty').hidden = picks.length > 0;
    $('#picks-footer').hidden = picks.length === 0;
    picks.forEach(function (pick, index) {
      var piece = getPiece(pick.id);
      var li = document.createElement('li'); li.className = 'pick';
      var img = document.createElement('img'); img.src = piece.images[0]; img.alt = piece.alt; img.width = 68; img.height = 90;
      var details = document.createElement('div');
      var h = document.createElement('h3'); h.textContent = piece.title;
      var prefs = document.createElement('p');
      prefs.textContent = [pick.colour ? 'Colour: ' + pick.colour : '',pick.size ? 'Size: ' + pick.size : '',pick.notes].filter(Boolean).join('\n') || 'Preferences to be discussed';
      var controls = document.createElement('div'); controls.className = 'pick-controls';
      function adjustButton(text, label, change) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.setAttribute('aria-label',label + ' ' + piece.title);
        b.disabled = change < 0 ? pick.qty <= 1 : pick.qty >= 20;
        b.addEventListener('click',function () { pick.qty += change; savePicks(); renderPicks(); });
        return b;
      }
      var count = document.createElement('span'); count.textContent = pick.qty; count.setAttribute('aria-label', 'Quantity ' + pick.qty);
      var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove'; remove.textContent = 'Remove';
      remove.setAttribute('aria-label','Remove ' + piece.title);
      remove.addEventListener('click',function () { picks.splice(index,1); savePicks(); renderPicks(); announce('Selection removed.'); });
      controls.append(adjustButton('−','Decrease quantity of',-1),count,adjustButton('+','Increase quantity of',1),remove);
      details.append(h,prefs,controls); li.append(img,details); list.append(li);
    });
    $('#picks-whatsapp').href = waLink(requestText());
  }
  $$('[data-open-picks]').forEach(function (button) {
    button.addEventListener('click', function () { renderPicks(); openDialog(picksDialog); });
  });
  $('#continue-browsing').addEventListener('click', function () { closeDialog(picksDialog); });
  $('#clear-picks').addEventListener('click',function () { picks = []; savePicks(); renderPicks(); announce('Your picks have been cleared.'); });
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        announce('Request copied. Paste it into your conversation.');
        return;
      }
    } catch (_) { /* Fall through to the HTTP-compatible copy route. */ }
    var field = $('#copy-fallback');
    field.value = text;
    var dialog = $$('dialog').find(function (d) { return d.open; });
    var host = dialog || document.body;
    host.append(field);
    field.hidden = false; field.focus(); field.select();
    var copied = false;
    try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
    if (copied) {
      field.hidden = true; document.body.append(field);
      announce('Request copied. Paste it into your conversation.');
    } else {
      field.className = ''; field.style.cssText = 'display:block;width:100%;min-height:180px;margin:15px 0;padding:12px';
      announce('Select and copy the request shown below.');
    }
  }
  $('#picks-copy').addEventListener('click',function () { copyText(requestText()); });
  var search = $('#collection-search');
  if (search) {
    var activeCategory = 'All';
    var params = new URLSearchParams(location.search);
    var wanted = params.get('category');
    if (wanted && data.pieces.some(function (p) { return p.category === wanted; })) activeCategory = wanted;
    search.value = clean(params.get('q'),100);
    function applyFilters() {
      var query = search.value.trim().toLocaleLowerCase();
      var cards = $$('[data-card]');
      var sort = $('#collection-sort').value;
      cards.sort(function (a,b) {
        var pa = getPiece(a.dataset.card), pb = getPiece(b.dataset.card);
        if (sort === 'az') return pa.title.localeCompare(pb.title);
        if (sort === 'za') return pb.title.localeCompare(pa.title);
        return data.pieces.indexOf(pa) - data.pieces.indexOf(pb);
      });
      var visible = 0;
      cards.forEach(function (card) {
        var p = getPiece(card.dataset.card);
        var match = (activeCategory === 'All' || p.category === activeCategory) && (p.title + ' ' + p.category + ' ' + p.description).toLocaleLowerCase().includes(query);
        card.hidden = !match; if (match) visible++;
        $('#collection-grid').append(card);
      });
      $$('[data-filter]').forEach(function (b) { b.setAttribute('aria-pressed',String(b.dataset.filter === activeCategory)); });
      $('#result-count').textContent = visible + ' of ' + data.pieces.length + ' photo collections';
      $('#collection-empty').hidden = visible > 0;
    }
    search.addEventListener('input',applyFilters);
    $('#collection-sort').addEventListener('change',applyFilters);
    $$('[data-filter]').forEach(function (b) { b.addEventListener('click',function () { activeCategory = b.dataset.filter; applyFilters(); }); });
    $$('[data-reset]').forEach(function (b) { b.addEventListener('click',function () { search.value=''; activeCategory='All'; $('#collection-sort').value='featured'; applyFilters(); search.focus(); }); });
    applyFilters();
  }
  function showGallery(index) {
    galleryIndex = (index + data.gallery.length) % data.gallery.length;
    var photo = data.gallery[galleryIndex];
    $('#lightbox-image').src = photo.src; $('#lightbox-image').alt = photo.alt;
    $('#lightbox-caption').textContent = photo.title;
    $('#lightbox-count').textContent = (galleryIndex + 1) + ' / ' + data.gallery.length;
  }
  $$('[data-gallery]').forEach(function (b) {
    b.addEventListener('click',function () { showGallery(Number(b.dataset.gallery)); openDialog(galleryDialog); });
  });
  $('#gallery-prev').addEventListener('click',function () { showGallery(galleryIndex - 1); });
  $('#gallery-next').addEventListener('click',function () { showGallery(galleryIndex + 1); });
  galleryDialog.addEventListener('keydown',function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); showGallery(galleryIndex + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); showGallery(galleryIndex - 1); }
  });
  var enquiryForm = $('#enquiry-form');
  var enquiryDraft = '';
  if (enquiryForm) {
    enquiryForm.addEventListener('submit',function (event) {
      event.preventDefault();
      if (!enquiryForm.reportValidity()) return;
      var person = clean($('#enquiry-name').value,100);
      var interest = $('#enquiry-interest').value;
      var area = clean($('#enquiry-area').value,100);
      var message = clean($('#enquiry-message').value,2000);
      enquiryDraft = 'Hello ' + data.name + '!\nMy name is ' + person + '.\nI am interested in: ' + interest + '.\n' + (area ? 'Delivery area: ' + area + '\n' : '') + '\n' + message;
      if ($('#include-picks').checked && picks.length) enquiryDraft += '\n\nMy photo references:\n' + picksText();
      enquiryDraft += '\n\nCould you confirm the options, current price and timing? Thank you.';
      $('#enquiry-draft').value = enquiryDraft;
      $('#enquiry-whatsapp').href = waLink(enquiryDraft);
      $('#draft-result').hidden = false;
      $('#enquiry-draft').focus();
      announce('Your draft is ready to review. Nothing has been sent.');
    });
    $('#enquiry-copy').addEventListener('click',function () { copyText(enquiryDraft); });
  }
  readPicks(); updateCount();
  var deepPiece = new URLSearchParams(location.search).get('piece');
  if (deepPiece) showPiece(deepPiece);
})();
