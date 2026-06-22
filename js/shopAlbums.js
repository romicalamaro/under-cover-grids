(function () {
  var SWIPE_THRESHOLD_PX = 40;
  var shopSection = document.querySelector("#section-shop .shop-section");
  var albums = document.querySelectorAll("#section-shop .shop-album");

  if (!albums.length) return;

  function getSlides(album) {
    return album.querySelectorAll(".shop-album__slide");
  }

  function goTo(album, index) {
    var slides = getSlides(album);
    if (!slides.length) return;

    var maxIndex = slides.length - 1;
    var nextIndex = Math.max(0, Math.min(index, maxIndex));
    album._index = nextIndex;

    var track = album.querySelector(".shop-album__track");
    if (track) {
      track.style.transform = "translateX(-" + nextIndex * 100 + "%)";
    }

    slides.forEach(function (slide, i) {
      slide.setAttribute("aria-hidden", i === nextIndex ? "false" : "true");
    });

    var prevBtn = album.querySelector(".shop-album__nav--prev");
    var nextBtn = album.querySelector(".shop-album__nav--next");
    if (prevBtn) prevBtn.disabled = nextIndex <= 0;
    if (nextBtn) nextBtn.disabled = nextIndex >= maxIndex;
  }

  function initAlbum(album) {
    album._index = 0;
    goTo(album, 0);

    var prevBtn = album.querySelector(".shop-album__nav--prev");
    var nextBtn = album.querySelector(".shop-album__nav--next");
    var viewport = album.querySelector(".shop-album__viewport");

    if (prevBtn) {
      prevBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        goTo(album, album._index - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        goTo(album, album._index + 1);
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

  albums.forEach(initAlbum);

  if (shopSection) {
    shopSection.addEventListener("click", function (event) {
      event.stopPropagation();
    });
  }
})();
