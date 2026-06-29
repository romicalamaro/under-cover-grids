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

  function openCart() {
    if (isOpen) return;
    clearCloseTimer();
    isOpen = true;
    drawer.hidden = false;
    scrim.hidden = false;
    setAriaOpen(true);
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
