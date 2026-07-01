(function () {
  "use strict";

  var page2 = document.getElementById("page2");
  var trigger = document.querySelector(".page2-cart-trigger");
  var drawer = document.getElementById("page2-cart-drawer");
  var scrim = document.querySelector(".page2-cart-scrim");
  var closeBtn = drawer && drawer.querySelector(".page2-cart-drawer__close");
  var emptyEl = drawer && drawer.querySelector(".page2-cart-drawer__empty");
  var listEl = drawer && drawer.querySelector(".page2-cart-drawer__list");
  var buyBtn = drawer && drawer.querySelector(".page2-cart-drawer__buy");
  var countEl = trigger && trigger.querySelector(".page2-cart-trigger__count");

  if (!page2 || !trigger || !drawer || !scrim || !closeBtn) return;

  var isOpen = false;
  var closeTimer = null;
  var items = [];
  var DRAWER_TRANSITION_MS = 450;
  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // --- Keep the cart from covering the footer -------------------------------
  // The drawer is position:fixed, so on its own it always fills the whole
  // screen (height: 100vh) and ends up sitting on top of the red footer once
  // you scroll down to it. The footer, on the other hand, scrolls with the
  // page. CSS alone can't react to a scrolling element from a fixed one, so
  // this small helper measures where the footer currently is and trims the
  // drawer's height to "screen height minus the part of the footer that is on
  // screen". When the footer isn't visible, the drawer stays full height.
  var heightSyncFrame = null;

  // Returns how many pixels of footer are currently showing at the bottom of
  // the viewport (0 when no footer is on screen).
  function getVisibleFooterHeight() {
    // Only the active section is displayed, so in practice one footer is live.
    var footers = document.querySelectorAll(".page2-footer");
    var viewportH = window.innerHeight || document.documentElement.clientHeight;
    var maxOverlap = 0;

    for (var i = 0; i < footers.length; i++) {
      var footer = footers[i];
      // Skip footers in hidden sections (display:none -> no layout box).
      if (!footer.getClientRects().length) continue;
      var rect = footer.getBoundingClientRect();
      // Overlap between the footer and the bottom of the viewport.
      var overlap = viewportH - Math.max(rect.top, 0);
      // Clamp so we never subtract more than the footer's own height.
      if (overlap > rect.height) overlap = rect.height;
      if (overlap > maxOverlap) maxOverlap = overlap;
    }
    return maxOverlap;
  }

  function applyDrawerHeight() {
    heightSyncFrame = null;
    if (!isOpen) return;
    var footerOnScreen = getVisibleFooterHeight();
    // The panel starts below the header (CSS top), so its height is
    // "screen minus header minus the visible footer".
    drawer.style.height =
      "calc(100vh - var(--page2-header-band-height) - " +
      footerOnScreen +
      "px)";
  }

  // Throttle scroll/resize work to one update per animation frame.
  function scheduleDrawerHeight() {
    if (heightSyncFrame !== null) return;
    heightSyncFrame = window.requestAnimationFrame(applyDrawerHeight);
  }

  function startHeightSync() {
    applyDrawerHeight();
    // Scrolling happens inside inner containers, so listen in the capture
    // phase to catch those scroll events too (not just window scrolling).
    window.addEventListener("scroll", scheduleDrawerHeight, true);
    window.addEventListener("resize", scheduleDrawerHeight);
  }

  function stopHeightSync() {
    window.removeEventListener("scroll", scheduleDrawerHeight, true);
    window.removeEventListener("resize", scheduleDrawerHeight);
    if (heightSyncFrame !== null) {
      window.cancelAnimationFrame(heightSyncFrame);
      heightSyncFrame = null;
    }
    // Leave the last height in place so the slide-out stays smooth; the next
    // openCart() always recomputes a fresh height before showing the drawer.
  }
  // -------------------------------------------------------------------------

  function setAriaOpen(open) {
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
    scrim.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function clearCloseTimer() {
    if (closeTimer) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function getTotalQuantity() {
    var total = 0;
    for (var i = 0; i < items.length; i++) {
      total += items[i].quantity || 1;
    }
    return total;
  }

  function updateCartCount() {
    if (!countEl) return;
    var total = getTotalQuantity();
    if (total > 0) {
      countEl.textContent = String(total);
      countEl.hidden = false;
      countEl.setAttribute("aria-hidden", "false");
      trigger.setAttribute(
        "aria-label",
        "Open cart, " + String(total) + " item" + (total === 1 ? "" : "s")
      );
    } else {
      countEl.textContent = "";
      countEl.hidden = true;
      countEl.setAttribute("aria-hidden", "true");
      trigger.setAttribute("aria-label", "Open cart");
    }
  }

  function applyThumbStyle(el, item) {
    if (!el || !item) return;
    if (item.imageUrl) {
      el.style.backgroundImage = "url('" + item.imageUrl + "')";
      el.style.backgroundColor = item.color || "#d8d2cc";
    } else {
      el.style.backgroundImage = "";
      el.style.backgroundColor = item.color || "#d8d2cc";
    }
  }

  function renderCart() {
    if (!emptyEl || !listEl) return;

    if (!items.length) {
      emptyEl.hidden = false;
      listEl.hidden = true;
      listEl.innerHTML = "";
      if (buyBtn) buyBtn.hidden = true;
      updateCartCount();
      return;
    }

    emptyEl.hidden = true;
    listEl.hidden = false;
    listEl.innerHTML = "";
    if (buyBtn) buyBtn.hidden = false;

    items.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "page2-cart-drawer__item";
      li.dataset.cartId = item.id;

      var thumb = document.createElement("div");
      thumb.className = "page2-cart-drawer__item-thumb";
      thumb.setAttribute("aria-hidden", "true");
      applyThumbStyle(thumb, item);

      var info = document.createElement("div");
      info.className = "page2-cart-drawer__item-info";

      var name = document.createElement("p");
      name.className = "page2-cart-drawer__item-name";
      name.textContent = item.name || "Handkerchief";

      var variant = document.createElement("p");
      variant.className = "page2-cart-drawer__item-variant";
      var variantLabel = "Option " + String((item.imageIndex || 0) + 1);
      if (item.quantity > 1) {
        variantLabel += " · Qty " + String(item.quantity);
      }
      variant.textContent = variantLabel;

      info.appendChild(name);
      info.appendChild(variant);

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "page2-cart-drawer__item-remove";
      removeBtn.setAttribute("aria-label", "Remove " + (item.name || "item") + " from cart");
      removeBtn.textContent = "\u00d7";
      removeBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        removeItem(item.id);
      });

      li.appendChild(thumb);
      li.appendChild(info);
      li.appendChild(removeBtn);
      listEl.appendChild(li);
    });

    updateCartCount();
  }

  function addItem(snapshot) {
    if (!snapshot || !snapshot.id) return false;

    var existing = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === snapshot.id) {
        existing = items[i];
        break;
      }
    }

    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
      existing.imageUrl = snapshot.imageUrl || existing.imageUrl;
      existing.color = snapshot.color || existing.color;
    } else {
      items.push({
        id: snapshot.id,
        folder: snapshot.folder || "",
        name: snapshot.name || "",
        imageIndex: snapshot.imageIndex || 0,
        imageUrl: snapshot.imageUrl || "",
        color: snapshot.color || "",
        quantity: 1,
      });
    }

    renderCart();
    return true;
  }

  function removeItem(id) {
    items = items.filter(function (item) {
      return item.id !== id;
    });
    renderCart();
  }

  function clearCart() {
    items = [];
    renderCart();
  }

  function openCart() {
    if (isOpen) return;
    clearCloseTimer();
    isOpen = true;
    drawer.hidden = false;
    scrim.hidden = false;
    setAriaOpen(true);
    startHeightSync();
    window.requestAnimationFrame(function () {
      page2.classList.add("page2--cart-open");
      closeBtn.focus();
    });
  }

  function closeCart() {
    if (!isOpen) return;
    isOpen = false;
    page2.classList.remove("page2--cart-open");
    setAriaOpen(false);
    stopHeightSync();
    trigger.focus();

    clearCloseTimer();
    if (prefersReducedMotion) {
      drawer.hidden = true;
      scrim.hidden = true;
      return;
    }

    closeTimer = window.setTimeout(function () {
      closeTimer = null;
      if (!isOpen) {
        drawer.hidden = true;
        scrim.hidden = true;
      }
    }, DRAWER_TRANSITION_MS);
  }

  trigger.addEventListener("click", function (event) {
    event.stopPropagation();
    if (isOpen) {
      closeCart();
    } else {
      openCart();
    }
  });

  closeBtn.addEventListener("click", function (event) {
    event.stopPropagation();
    closeCart();
  });

  if (buyBtn) {
    buyBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      clearCart();
      closeCart();
    });
  }

  scrim.addEventListener("click", function () {
    closeCart();
  });

  document.addEventListener("keydown", function (event) {
    if (!isOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeCart();
    }
  });

  page2.addEventListener("page2:hide", function () {
    closeCart();
  });

  renderCart();

  window.Page2Cart = {
    open: openCart,
    close: closeCart,
    isOpen: function () {
      return isOpen;
    },
    add: function (snapshot, options) {
      options = options || {};
      var added = addItem(snapshot);
      if (added && options.open !== false) {
        openCart();
      }
      return added;
    },
    remove: removeItem,
    getItems: function () {
      return items.slice();
    },
    getCount: getTotalQuantity,
  };
})();
