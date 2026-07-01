(function () {
  var SWIPE_THRESHOLD_PX = 40;
  var SHOP_HOVER_AUTOPLAY_MS = 2000;
  var SHOP_IMAGE_FALLBACK_COLOR = "#d8d2cc";
  var SHOP_FOLDER_IMAGES = {
    "name 01": ["1.webp", "2.webp", "3.webp", "4.webp", "5.webp"],
    "name 02": ["1.webp", "2.webp", "3.webp", "4.webp", "5.webp"],
    "name 03": [
      "1.webp",
      "2.webp",
      "3.webp",
      "4.webp",
      "5.webp",
      "6.webp",
      "7.webp",
      "8.webp",
      "9.webp",
    ],
    "name 04": ["1.webp", "2.webp", "3.webp", "4.webp", "5.webp"],
    "name 05": ["1.webp", "2.webp", "3.webp", "4.webp"],
    "name 06": ["1.webp", "2.webp", "3.webp", "4.webp", "5.webp", "6.webp"],
    "name 07": [
      "1.webp",
      "2.webp",
      "3.webp",
      "4.webp",
      "5.webp",
      "6.webp",
      "7.webp",
      "8.webp",
    ],
    "name 08": ["1.webp", "2.webp", "3.webp"],
    "name 09": ["2.webp", "3.webp", "4.webp"],
    "name 10": ["1.webp", "2.webp", "3.webp", "4.webp", "5.webp", "6.webp"],
    "name 11": ["1.webp", "2.webp"],
    "name 12": [
      "1.webp",
      "2.webp",
      "3.webp",
      "4.webp",
      "5.webp",
      "6.webp",
    ],
  };
  // Bump when files inside a shop folder change so browsers fetch fresh images.
  var SHOP_FOLDER_VERSION = {
    "name 01": "20260624-webp",
    "name 02": "20260624-webp",
    "name 03": "20260628-webp",
    "name 04": "20260628-webp",
    "name 05": "20260628-webp-v4",
    "name 06": "20260628-webp",
    "name 07": "20260628-webp",
    "name 08": "20260628-webp",
    "name 09": "20260624-webp-v3",
    "name 10": "20260628-webp",
    "name 11": "20260624-swap-10",
    "name 12": "20260624-webp-v2",
  };
  var shopSection = document.querySelector("#section-shop .shop-section");
  var albums = document.querySelectorAll("#section-shop .shop-album");
  var productSection = document.getElementById("section-product");
  var productHero = document.getElementById("product-hero");
  var productGallery = document.getElementById("product-gallery");
  var productTitle = document.getElementById("product-title");
  var page2 = document.getElementById("page2");
  var productCloseTimer = null;
  var PRODUCT_CLOSE_MS = 400;

  if (!albums.length) return;

  function clearProductCloseTimer() {
    if (productCloseTimer) {
      window.clearTimeout(productCloseTimer);
      productCloseTimer = null;
    }
  }

  function getProductImageUrls(album) {
    var card = album.closest(".shop-card");
    if (!card) return null;
    var folder = card.getAttribute("data-shop-folder");
    if (!folder) return null;
    var filenames = SHOP_FOLDER_IMAGES[folder];
    if (!filenames || !filenames.length) return null;
    var folderPath = "website/shop/" + encodeURIComponent(folder) + "/";
    var version = SHOP_FOLDER_VERSION[folder];
    return filenames.map(function (filename) {
      var url = folderPath + encodeURIComponent(filename);
      if (version) url += "?v=" + encodeURIComponent(version);
      return url;
    });
  }

  function getSlides(album) {
    return album.querySelectorAll(".shop-album__slide:not(.shop-album__slide--clone)");
  }

  function createSlide(color, options) {
    options = options || {};
    var slide = document.createElement("div");
    slide.className = "shop-album__slide";
    if (options.isClone) {
      slide.className += " shop-album__slide--clone";
      slide.setAttribute("aria-hidden", "true");
    } else {
      slide.setAttribute("aria-hidden", options.isActive ? "false" : "true");
    }
    if (options.image) {
      slide.dataset.image = options.image;
      slide.style.backgroundColor = color || SHOP_IMAGE_FALLBACK_COLOR;
      slide.style.backgroundImage = "url('" + options.image + "')";
    } else {
      slide.style.backgroundColor = color;
      slide.dataset.color = color;
    }
    return slide;
  }

  function logicalToPhysical(logicalIndex) {
    return logicalIndex + 1;
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function getShopCardLineText(nameEl) {
    if (!nameEl) return "";
    if (nameEl.dataset.shopLineText) return nameEl.dataset.shopLineText.trim();
    return nameEl.textContent.trim();
  }

  function setTrackTransform(track, physicalIndex, instant) {
    if (instant) {
      track.style.transition = "none";
    }
    track.style.transform = "translateX(-" + physicalIndex * 100 + "%)";
    if (instant) {
      void track.offsetWidth;
      track.style.transition = "";
    }
  }

  // Read the color swatches already on the card so placeholders share its palette.
  function getCardColors(album) {
    var card = album.closest(".shop-card");
    var colors = [];
    if (card) {
      card.querySelectorAll(".shop-card__swatch").forEach(function (swatch) {
        var color = swatch.style.getPropertyValue("--swatch-color").trim();
        if (color) colors.push(color);
      });
    }
    if (!colors.length) colors = ["#d8d2cc"];
    return colors;
  }

  // Fill the carousel with colored placeholder "photos" (one per swatch color)
  // so there is visible content to page through and to open large later.
  function populatePlaceholders(album) {
    var track = album.querySelector(".shop-album__track");
    if (!track) return;
    var colors = getCardColors(album);
    track.innerHTML = "";
    if (!colors.length) return;

    if (colors.length === 1) {
      track.appendChild(createSlide(colors[0], { isActive: true }));
      return;
    }

    track.appendChild(createSlide(colors[colors.length - 1], { isClone: true }));
    colors.forEach(function (color, i) {
      track.appendChild(createSlide(color, { isActive: i === 0 }));
    });
    track.appendChild(createSlide(colors[0], { isClone: true }));
  }

  function populateImages(album, urls) {
    var track = album.querySelector(".shop-album__track");
    if (!track) return;
    track.innerHTML = "";
    if (!urls.length) return;

    if (urls.length === 1) {
      track.appendChild(
        createSlide(SHOP_IMAGE_FALLBACK_COLOR, { isActive: true, image: urls[0] })
      );
      return;
    }

    track.appendChild(
      createSlide(SHOP_IMAGE_FALLBACK_COLOR, {
        isClone: true,
        image: urls[urls.length - 1],
      })
    );
    urls.forEach(function (url, i) {
      track.appendChild(
        createSlide(SHOP_IMAGE_FALLBACK_COLOR, { isActive: i === 0, image: url })
      );
    });
    track.appendChild(
      createSlide(SHOP_IMAGE_FALLBACK_COLOR, { isClone: true, image: urls[0] })
    );
  }

  function populateAlbum(album) {
    var urls = getProductImageUrls(album);
    if (urls && urls.length) {
      populateImages(album, urls);
    } else {
      populatePlaceholders(album);
    }
  }

  function clampIndex(index, count) {
    if (!count) return 0;
    return Math.max(0, Math.min(index, count - 1));
  }

  function wrapIndex(index, count) {
    if (!count) return 0;
    return ((index % count) + count) % count;
  }

  function goTo(album, index, options) {
    options = options || {};
    var slides = getSlides(album);
    if (!slides.length) return;

    var count = slides.length;
    var prevIndex = typeof album._index === "number" ? album._index : 0;
    var nextIndex = wrapIndex(index, count);
    var track = album.querySelector(".shop-album__track");
    if (!track) return;

    var instant = !!options.instant || prefersReducedMotion();
    var isWrapForward = !instant && count > 1 && prevIndex === count - 1 && nextIndex === 0;
    var isWrapBackward = !instant && count > 1 && prevIndex === 0 && nextIndex === count - 1;

    album._index = nextIndex;

    slides.forEach(function (slide, i) {
      slide.setAttribute("aria-hidden", i === nextIndex ? "false" : "true");
    });

    var physicalIndex = logicalToPhysical(nextIndex);
    if (isWrapForward) {
      physicalIndex = count + 1;
    } else if (isWrapBackward) {
      physicalIndex = 0;
    }

    if (instant || count === 1) {
      setTrackTransform(track, count === 1 ? 0 : logicalToPhysical(nextIndex), true);
    } else if (isWrapForward || isWrapBackward) {
      setTrackTransform(track, physicalIndex, false);
      track.addEventListener("transitionend", function onWrapEnd(event) {
        if (event.target !== track || event.propertyName !== "transform") return;
        track.removeEventListener("transitionend", onWrapEnd);
        setTrackTransform(track, logicalToPhysical(nextIndex), true);
      });
    } else {
      setTrackTransform(track, physicalIndex, false);
    }

    var prevBtn = album.querySelector(".shop-album__nav--prev");
    var nextBtn = album.querySelector(".shop-album__nav--next");
    if (prevBtn) prevBtn.disabled = false;
    if (nextBtn) nextBtn.disabled = false;
  }

  function stopHoverAutoplay(album) {
    if (album._hoverAutoplayTimer) {
      window.clearInterval(album._hoverAutoplayTimer);
      album._hoverAutoplayTimer = null;
    }
  }

  function startHoverAutoplay(album) {
    stopHoverAutoplay(album);
    var slides = getSlides(album);
    if (slides.length <= 1) return;
    if (prefersReducedMotion()) return;

    album._hoverAutoplayTimer = window.setInterval(function () {
      goTo(album, album._index + 1);
    }, SHOP_HOVER_AUTOPLAY_MS);
  }

  function applySlideToElement(slide, el) {
    if (!slide || !el) return;
    var color = slide.dataset.color || slide.style.backgroundColor;
    var image = slide.dataset.image;
    if (image) {
      el.style.backgroundImage = "url('" + image + "')";
    } else {
      el.style.backgroundImage = "";
      if (color) el.style.setProperty("--product-hero-color", color);
    }
  }

  function getGalleryTrack() {
    return productGallery && productGallery.querySelector(".product-gallery__track");
  }

  function getGalleryThumbHeight() {
    var thumb = productGallery && productGallery.querySelector(".product-gallery__thumb");
    return thumb ? thumb.offsetHeight : 0;
  }

  function getGalleryGapPx() {
    if (!productGallery) return 0;
    var track = getGalleryTrack();
    if (!track) return 0;
    var gap = window.getComputedStyle(track).gap;
    var parsed = parseFloat(gap);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getGalleryStride() {
    return getGalleryThumbHeight() + getGalleryGapPx();
  }

  function getGalleryEdgePad() {
    if (!productGallery) return 0;
    var thumbHeight = getGalleryThumbHeight();
    if (!thumbHeight) return 0;
    return Math.max(0, (productGallery.clientHeight - thumbHeight) / 2);
  }

  function updateGalleryEdgePadding() {
    if (!productGallery) return;
    var edgePad = getGalleryEdgePad();
    productGallery.style.setProperty("--product-gallery-edge-pad", edgePad + "px");
  }

  function setGallerySnapEnabled(enabled) {
    if (!productGallery) return;
    productGallery.style.scrollSnapType = enabled ? "y mandatory" : "none";
  }

  function getGalleryPhysicalIndexFromScroll() {
    if (!productGallery) return 0;
    var stride = getGalleryStride();
    var thumbHeight = getGalleryThumbHeight();
    if (!stride || !thumbHeight) return 0;

    var edgePad = getGalleryEdgePad();
    var centerY = productGallery.scrollTop + productGallery.clientHeight / 2;
    return Math.round((centerY - edgePad - thumbHeight / 2) / stride);
  }

  function getGalleryLogicalIndexFromScroll() {
    var count = productGallery && productGallery._count;
    if (!count) return 0;
    return wrapIndex(getGalleryPhysicalIndexFromScroll(), count);
  }

  function createGalleryThumb(slide, index, isClone) {
    var thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = "product-gallery__thumb";
    thumb.dataset.index = String(index);
    thumb.setAttribute("aria-label", "View color option " + (index + 1));
    applySlideToElement(slide, thumb);

    if (isClone) {
      thumb.className += " product-gallery__thumb--clone";
      thumb.setAttribute("aria-hidden", "true");
      thumb.tabIndex = -1;
    }

    return thumb;
  }

  function appendGalleryThumbSet(track, slides, isClone, album) {
    slides.forEach(function (slide, i) {
      var thumb = createGalleryThumb(slide, i, isClone);
      thumb.addEventListener("click", function (event) {
        event.stopPropagation();
        // Jump straight to the clicked color — no scroll-through animation past
        // the thumbnails in between.
        setProductSelection(album, i, { instant: true });
      });
      track.appendChild(thumb);
    });
  }

  function normalizeGalleryScroll() {
    if (!productGallery || !productGallery._loopEnabled || productGallery._normalizing) return;
    // While a click-driven smooth scroll is running we may temporarily land in a
    // clone region; suppress re-centering until the animation ends (scrollend).
    if (productGallery._programmaticScrolling) return;

    var count = productGallery._count;
    var stride = getGalleryStride();
    if (!count || !stride) return;

    var physicalIndex = getGalleryPhysicalIndexFromScroll();
    if (physicalIndex < count) {
      productGallery._normalizing = true;
      setGallerySnapEnabled(false);
      productGallery.scrollTop += count * stride;
      void productGallery.offsetHeight;
      setGallerySnapEnabled(true);
      productGallery._normalizing = false;
    } else if (physicalIndex >= count * 2) {
      productGallery._normalizing = true;
      setGallerySnapEnabled(false);
      productGallery.scrollTop -= count * stride;
      void productGallery.offsetHeight;
      setGallerySnapEnabled(true);
      productGallery._normalizing = false;
    }
  }

  function scrollGalleryToIndex(index, options) {
    options = options || {};
    if (!productGallery) return;

    var count = productGallery._count;
    if (!count) return;

    var safeIndex = wrapIndex(index, count);
    var instant = !!options.instant || prefersReducedMotion();

    if (!productGallery._loopEnabled) {
      updateGalleryEdgePadding();
      return;
    }

    var stride = getGalleryStride();
    var thumbHeight = getGalleryThumbHeight();
    if (!stride || !thumbHeight) return;

    var edgePad = getGalleryEdgePad();
    var curPhys = getGalleryPhysicalIndexFromScroll();

    // Instant jumps (open/resize) center on the real set. Click-driven smooth
    // scrolls instead target the copy of safeIndex nearest to the current
    // position, so a loop always takes the shortest visual path (never a long
    // scroll through every thumbnail in between).
    var physical;
    if (instant) {
      physical = count + safeIndex;
    } else {
      var curLogical = wrapIndex(curPhys, count);
      var delta = safeIndex - curLogical;
      if (delta > count / 2) delta -= count;
      else if (delta < -count / 2) delta += count;
      physical = curPhys + delta;
    }

    var scrollTop =
      edgePad + physical * stride + thumbHeight / 2 - productGallery.clientHeight / 2;

    if (instant) {
      // Hard reset: cancel any in-flight click animation bookkeeping.
      if (productGallery._galleryScrollEndHandler) {
        productGallery.removeEventListener("scrollend", productGallery._galleryScrollEndHandler);
        productGallery._galleryScrollEndHandler = null;
      }
      productGallery._programmaticScrolling = false;
      setGallerySnapEnabled(false);
      productGallery.scrollTop = scrollTop;
      void productGallery.offsetHeight;
      setGallerySnapEnabled(true);
    } else if (Math.abs(scrollTop - productGallery.scrollTop) < 1) {
      // Already at the target (clicked the current thumb) — nothing to animate.
    } else {
      var gallery = productGallery;
      // A fresh click supersedes any in-flight programmatic scroll.
      if (gallery._galleryScrollEndHandler) {
        gallery.removeEventListener("scrollend", gallery._galleryScrollEndHandler);
      }
      var onScrollEnd = function () {
        gallery.removeEventListener("scrollend", onScrollEnd);
        gallery._galleryScrollEndHandler = null;
        gallery._programmaticScrolling = false;
        // Re-center from any clone region back onto the real set (invisible jump).
        normalizeGalleryScroll();
      };
      gallery._galleryScrollEndHandler = onScrollEnd;
      gallery._programmaticScrolling = true;
      gallery.addEventListener("scrollend", onScrollEnd);
      gallery.scrollTo({ top: scrollTop, behavior: "smooth" });
    }
  }

  function syncHeroFromGalleryScroll(album) {
    if (!productGallery || productGallery._normalizing) return;
    var index = getGalleryLogicalIndexFromScroll();
    if (index !== album._index) {
      setProductSelection(album, index, { skipScroll: true });
    }
  }

  function onProductGalleryScroll() {
    if (!productGallery || !productGallery._album) return;
    normalizeGalleryScroll();
    if (productGallery._scrollSyncRaf) return;
    productGallery._scrollSyncRaf = window.requestAnimationFrame(function () {
      productGallery._scrollSyncRaf = 0;
      syncHeroFromGalleryScroll(productGallery._album);
    });
  }

  function onProductGalleryResize() {
    if (!productGallery || !productGallery._album) return;
    var album = productGallery._album;
    var currentIndex = album._index || 0;
    updateGalleryEdgePadding();
    scrollGalleryToIndex(currentIndex, { instant: true });
    setProductSelection(album, currentIndex, { skipScroll: true });
  }

  function initProductGalleryViewport() {
    if (!productGallery || productGallery._viewportReady) return;
    productGallery._viewportReady = true;
    productGallery.addEventListener("scroll", onProductGalleryScroll, { passive: true });

    if (typeof ResizeObserver !== "undefined") {
      var resizeObserver = new ResizeObserver(function () {
        onProductGalleryResize();
      });
      resizeObserver.observe(productGallery);
      productGallery._resizeObserver = resizeObserver;
    }
  }

  function buildProductGallery(album) {
    if (!productGallery) return;
    var slides = getSlides(album);
    var count = slides.length;

    productGallery.innerHTML = "";
    productGallery.classList.toggle("product-gallery--single", count <= 1);
    productGallery._album = album;
    productGallery._count = count;
    productGallery._loopEnabled = count > 1;

    var track = document.createElement("div");
    track.className = "product-gallery__track";

    if (count <= 1) {
      if (count === 1) {
        appendGalleryThumbSet(track, slides, false, album);
      }
    } else {
      appendGalleryThumbSet(track, slides, true, album);
      appendGalleryThumbSet(track, slides, false, album);
      appendGalleryThumbSet(track, slides, true, album);
    }

    productGallery.appendChild(track);
    initProductGalleryViewport();
    void productGallery.offsetHeight;
    updateGalleryEdgePadding();
  }

  function setProductSelection(album, selectedIndex, options) {
    options = options || {};
    if (!productHero || !productGallery) return;
    var slides = getSlides(album);
    if (!slides.length) return;

    var safeIndex = clampIndex(selectedIndex, slides.length);
    album._index = safeIndex;
    applySlideToElement(slides[safeIndex], productHero);

    productGallery.querySelectorAll(".product-gallery__thumb").forEach(function (thumb) {
      var isActive = Number(thumb.dataset.index) === safeIndex;
      thumb.classList.toggle("product-gallery__thumb--active", isActive);
      if (!thumb.classList.contains("product-gallery__thumb--clone")) {
        thumb.setAttribute("aria-current", isActive ? "true" : "false");
      }
    });

    if (!options.skipScroll) {
      scrollGalleryToIndex(safeIndex, { instant: !!options.instant });
    }
  }

  function finishCloseProduct() {
    if (!productSection) return;
    var album = productGallery && productGallery._album;
    if (album) goTo(album, album._index || 0, { instant: true });
    if (window.ProductComboSpec && typeof window.ProductComboSpec.clear === "function") {
      window.ProductComboSpec.clear();
    }
    resetOrderButton();
    productSection.hidden = true;
  }

  function revealProductPanel(options) {
    options = options || {};
    if (!page2 || !productSection) return;

    var shouldAnimateIn =
      productSection.hidden ||
      !page2.classList.contains("page2--product-open");

    clearProductCloseTimer();
    productSection.hidden = false;
    page2.classList.remove("page2--product-closing");

    if (!shouldAnimateIn) {
      page2.classList.add("page2--product-open");
      return;
    }

    page2.classList.remove("page2--product-open");
    if (prefersReducedMotion()) {
      page2.classList.add("page2--product-open");
      return;
    }

    if (options.deferAnimate) return;

    startProductPanelAnimation();
  }

  function startProductPanelAnimation() {
    if (!page2 || !productSection || productSection.hidden) return;
    if (prefersReducedMotion()) {
      page2.classList.add("page2--product-open");
      return;
    }

    // Two frames so the browser commits the off-screen transform before easing in.
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        page2.classList.add("page2--product-open");
      });
    });
  }

  // Show the currently visible image of an album large on the product page.
  function openProduct(album) {
    if (!productSection || !productHero || !productGallery) return;
    stopHoverAutoplay(album);
    var needsBuild = productGallery._album !== album;
    var card = album.closest(".shop-card");
    var nameEl = card && card.querySelector(".shop-card__name");

    // Mount off-screen first so the gallery has real dimensions, then animate in.
    revealProductPanel({ deferAnimate: true });
    productSection.scrollTop = 0;

    if (productTitle) {
      productTitle.textContent = getShopCardLineText(nameEl);
    }

    if (window.ProductComboSpec && typeof window.ProductComboSpec.render === "function") {
      var folder = card && card.getAttribute("data-shop-folder");
      window.ProductComboSpec.render(folder);
    }

    if (needsBuild) {
      buildProductGallery(album);
    } else {
      updateGalleryEdgePadding();
    }
    void productGallery.offsetHeight;
    setProductSelection(album, album._index || 0, { instant: true });
    startProductPanelAnimation();
  }

  // Close the internal page; the shop is still where the user left it underneath.
  function closeProduct() {
    if (!productSection || productSection.hidden) return;
    if (
      page2 &&
      !page2.classList.contains("page2--product-open") &&
      !productCloseTimer
    ) {
      return;
    }

    if (page2) {
      page2.classList.add("page2--product-closing");
      page2.classList.remove("page2--product-open");
    }
    clearProductCloseTimer();

    if (prefersReducedMotion()) {
      if (page2) page2.classList.remove("page2--product-closing");
      finishCloseProduct();
      return;
    }

    productCloseTimer = window.setTimeout(function () {
      productCloseTimer = null;
      if (page2 && page2.classList.contains("page2--product-open")) return;
      if (page2) page2.classList.remove("page2--product-closing");
      finishCloseProduct();
    }, PRODUCT_CLOSE_MS);
  }

  function initAlbum(album) {
    populateAlbum(album);
    album._index = 0;
    goTo(album, 0, { instant: true });

    var prevBtn = album.querySelector(".shop-album__nav--prev");
    var nextBtn = album.querySelector(".shop-album__nav--next");
    var viewport = album.querySelector(".shop-album__viewport");

    // Hovering a nav strip (or near an arrow) pauses autoplay so the manual
    // arrows can be used without the image swapping under the pointer.
    function bindNavStrip(btn, direction) {
      if (!btn) return;
      btn.addEventListener("click", function (event) {
        event.stopPropagation();
        goTo(album, album._index + direction);
      });
      btn.addEventListener("mouseenter", function () {
        album._navHover = true;
        stopHoverAutoplay(album);
      });
      btn.addEventListener("mouseleave", function () {
        album._navHover = false;
        startHoverAutoplay(album);
      });
    }

    bindNavStrip(prevBtn, -1);
    bindNavStrip(nextBtn, 1);

    album.addEventListener("mouseenter", function () {
      if (album._navHover) return;
      startHoverAutoplay(album);
    });
    album.addEventListener("mouseleave", function () {
      stopHoverAutoplay(album);
    });

    // Clicking the image area (and the card meta text) opens the product page.
    var card = album.closest(".shop-card");
    var meta = card && card.querySelector(".shop-card__meta");
    if (viewport) {
      viewport.addEventListener("click", function (event) {
        event.stopPropagation();
        openProduct(album);
      });
    }
    if (meta) {
      meta.style.cursor = "pointer";
      meta.addEventListener("click", function (event) {
        if (!event.target.closest(".shop-card__name, .shop-card__price")) return;
        event.stopPropagation();
        openProduct(album);
      });
    }

    if (!viewport) return;

    var touchStartX = 0;
    var touchStartY = 0;

    viewport.addEventListener(
      "touchstart",
      function (event) {
        if (!event.changedTouches.length) return;
        touchStartX = event.changedTouches[0].clientX;
        touchStartY = event.changedTouches[0].clientY;
      },
      { passive: true }
    );

    viewport.addEventListener(
      "touchend",
      function (event) {
        if (!event.changedTouches.length) return;
        var deltaX = event.changedTouches[0].clientX - touchStartX;
        var deltaY = event.changedTouches[0].clientY - touchStartY;

        if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
        if (Math.abs(deltaY) > Math.abs(deltaX)) return;

        event.stopPropagation();
        if (deltaX < 0) {
          goTo(album, album._index + 1);
        } else {
          goTo(album, album._index - 1);
        }
      },
      { passive: true }
    );
  }

  function getCurrentProductSnapshot() {
    var album = productGallery && productGallery._album;
    if (!album) return null;

    var card = album.closest(".shop-card");
    if (!card) return null;

    var folder = card.getAttribute("data-shop-folder") || "";
    var nameEl = card.querySelector(".shop-card__name");
    var name = getShopCardLineText(nameEl);
    var index = typeof album._index === "number" ? album._index : 0;
    var slides = getSlides(album);
    var slide = slides[index];
    if (!slide) return null;

    return {
      id: folder + ":" + String(index),
      folder: folder,
      name: name,
      imageIndex: index,
      imageUrl: slide.dataset.image || "",
      color: slide.dataset.color || slide.style.backgroundColor || "",
    };
  }

  albums.forEach(initAlbum);

  // The header stays visible above the product page; clicking a navigation
  // column should also close the product page so the chosen section is shown.
  // Capture phase runs before the header's own handler, so the overlay hides
  // first and the user sees the scroll land on the selected section.
  var header = document.querySelector(".page2-header");
  if (header && productSection) {
    header.addEventListener(
      "click",
      function (event) {
        if (productSection.hidden) return;
        var col = event.target.closest(".page2-header-col");
        if (!col || !col.querySelector(".page2-col-title")) return;
        closeProduct();
      },
      true
    );
  }

  var productCloseBtn =
    productSection &&
    productSection.querySelector(".page2-product-page__close");
  if (productCloseBtn) {
    productCloseBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      closeProduct();
    });
  }

  document.addEventListener("keydown", function (event) {
    if (!productSection || productSection.hidden) return;
    if (event.key !== "Escape") return;
    if (
      window.Page2Cart &&
      typeof window.Page2Cart.isOpen === "function" &&
      window.Page2Cart.isOpen()
    ) {
      return;
    }
    event.preventDefault();
    closeProduct();
  });

  // Clicking the exposed shop area (cols 11–12) closes the product panel.
  document.addEventListener(
    "click",
    function (event) {
      if (!productSection || productSection.hidden) return;
      if (productSection.contains(event.target)) return;
      if (event.target.closest(".page2-header")) return;
      closeProduct();
      event.stopPropagation();
    },
    true
  );

  if (shopSection) {
    shopSection.addEventListener("click", function (event) {
      event.stopPropagation();
    });
  }

  var orderBtn = document.getElementById("product-order-btn");

  function resetOrderButton() {
    if (!orderBtn) return;
    orderBtn.classList.remove("product-order-btn--added");
    orderBtn.textContent = "Add to cart";
  }

  if (orderBtn) {
    orderBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      var snapshot = getCurrentProductSnapshot();
      if (!snapshot) return;
      if (!window.Page2Cart || typeof window.Page2Cart.add !== "function") return;

      window.Page2Cart.add(snapshot);
      closeProduct();
    });
  }
})();
