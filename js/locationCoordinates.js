(function () {
  "use strict";

  var NOWHERE_PLACEHOLDER = "XX.XXXX° N, XX.XXXX° E";
  var IRAN_GEOCODE_QUERY = "Tehran";

  var ISRAEL_TERMS = [
    "ISRAEL",
    "TEL AVIV",
    "JERUSALEM",
    "HAIFA",
    "BEER SHEVA",
    "BEERSHEBA",
    "EILAT",
    "NETANYA",
    "ASHDOD",
    "ASHKELON",
    "TIBERIAS",
    "ACRE",
    "AKKO",
    "NAZARETH",
    "RAMAT GAN",
    "HOLON",
    "BAT YAM",
    "HERZLIYA",
    "RAANANA",
    "KFAR SABA",
    "MODIIN",
    "LOD",
    "RAMLA",
    "SAFED",
    "TZFAT",
    "KIRYAT SHMONA",
    "AFULA",
    "HADERA",
    "REHOVOT",
    "PETAH TIKVA",
    "BNEI BRAK",
    "JUDEA",
    "SAMARIA",
    "GALILEE",
    "NEGEV",
  ];

  var GERMANY_TERMS = [
    "GERMANY",
    "DEUTSCHLAND",
    "MAINZ",
    "BERLIN",
    "MUNICH",
    "MUENCHEN",
    "HAMBURG",
    "FRANKFURT",
    "COLOGNE",
    "KOELN",
    "STUTTGART",
    "DUSSELDORF",
    "DORTMUND",
    "LEIPZIG",
    "BREMEN",
    "DRESDEN",
    "HANOVER",
    "NUREMBERG",
    "BONN",
    "HEIDELBERG",
    "FREIBURG",
    "AACHEN",
    "KARLSRUHE",
    "WIESBADEN",
    "HANAU",
    "DARMSTADT",
    "MANNHEIM",
    "WUPPERTAL",
    "BIELEFELD",
    "ESSEN",
    "COLOGNE",
  ];

  var cachedContextKey = "";
  var cachedFormatted = "";
  var lookupToken = 0;
  var debounceTimer = null;
  /** @type {((formatted: string) => void) | null} */
  var onUpdate = null;

  /**
   * @param {number} lat
   * @param {number} lon
   * @returns {string}
   */
  function formatCoordinates(lat, lon) {
    var latAbs = Math.abs(lat).toFixed(4);
    var lonAbs = Math.abs(lon).toFixed(4);
    var latDir = lat >= 0 ? "N" : "S";
    var lonDir = lon >= 0 ? "E" : "W";
    return latAbs + "° " + latDir + ", " + lonAbs + "° " + lonDir;
  }

  /**
   * @param {string} text
   * @returns {number}
   */
  function hashString(text) {
    var h = 0;
    var i;
    for (i = 0; i < text.length; i++) {
      h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  /**
   * @param {string} locationText
   * @returns {{ lat: number, lon: number }}
   */
  function fakeCoordinates(locationText) {
    var key = String(locationText || "UNKNOWN").trim().toUpperCase() || "UNKNOWN";
    var h = hashString(key);
    var lat = 10 + (h % 5000) / 100;
    var lon = 1 + ((h >> 8) % 17900) / 100;
    if (h & 1) lat = -lat;
    if (h & 2) lon = -lon;
    return { lat: lat, lon: lon };
  }

  /**
   * @param {string} location
   * @returns {"IL" | "DE" | "OTHER"}
   */
  function detectRegion(location) {
    var upper = String(location || "").trim().toUpperCase();
    var i;
    if (!upper) return "OTHER";
    for (i = 0; i < ISRAEL_TERMS.length; i++) {
      if (upper.indexOf(ISRAEL_TERMS[i]) >= 0) return "IL";
    }
    for (i = 0; i < GERMANY_TERMS.length; i++) {
      if (upper.indexOf(GERMANY_TERMS[i]) >= 0) return "DE";
    }
    return "OTHER";
  }

  /**
   * @param {string} location
   * @param {string} countryCode
   * @returns {Promise<{ lat: number, lon: number } | null>}
   */
  function geocodeReal(location, countryCode) {
    var url =
      "https://geocoding-api.open-meteo.com/v1/search?name=" +
      encodeURIComponent(location) +
      "&count=1&language=en&format=json&countryCode=" +
      countryCode;
    return fetch(url)
      .then(function (response) {
        if (!response.ok) return null;
        return response.json();
      })
      .then(function (data) {
        if (!data || !data.results || !data.results.length) return null;
        return {
          lat: data.results[0].latitude,
          lon: data.results[0].longitude,
        };
      })
      .catch(function () {
        return null;
      });
  }

  /**
   * @param {string} locationText
   * @returns {Promise<{ lat: number, lon: number } | null>}
   */
  function resolveNowInCoordinates(locationText) {
    var loc = String(locationText || "").trim();
    var region;
    if (!loc) return Promise.resolve(null);
    region = detectRegion(loc);
    if (region === "IL") {
      return geocodeReal(loc, "IL").then(function (coords) {
        return coords || fakeCoordinates(loc);
      });
    }
    if (region === "DE") {
      return geocodeReal(loc, "DE").then(function (coords) {
        return coords || fakeCoordinates(loc);
      });
    }
    return Promise.resolve(fakeCoordinates(loc));
  }

  /**
   * @param {{ homeAt?: string, nowIn?: string }} context
   * @returns {string}
   */
  function getContextKey(context) {
    var homeAt = context && context.homeAt ? context.homeAt : "inIran";
    var nowIn = context && context.nowIn ? String(context.nowIn).trim() : "";
    return homeAt + "|" + nowIn;
  }

  /**
   * @param {{ homeAt?: string, nowIn?: string }} context
   * @returns {Promise<string>}
   */
  function resolveFormattedCoordinates(context) {
    var homeAt = context && context.homeAt ? context.homeAt : "inIran";
    var nowIn = context && context.nowIn ? String(context.nowIn).trim() : "";

    if (homeAt === "nowhere") {
      return Promise.resolve(NOWHERE_PLACEHOLDER);
    }

    if (homeAt === "inIran") {
      return geocodeReal(IRAN_GEOCODE_QUERY, "IR").then(function (coords) {
        if (!coords) {
          return formatCoordinates(35.6944, 51.4215);
        }
        return formatCoordinates(coords.lat, coords.lon);
      });
    }

    if (homeAt === "whereILive") {
      return resolveNowInCoordinates(nowIn).then(function (coords) {
        if (!coords) return "";
        return formatCoordinates(coords.lat, coords.lon);
      });
    }

    return Promise.resolve("");
  }

  function applyFormatted(formatted, contextKey) {
    cachedFormatted = formatted;
    cachedContextKey = contextKey;
    if (onUpdate) onUpdate(cachedFormatted);
  }

  /**
   * @param {{ homeAt?: string, nowIn?: string }} context
   * @returns {Promise<void>}
   */
  function updateFromContext(context) {
    var contextKey = getContextKey(context);
    var token = ++lookupToken;

    if (contextKey === cachedContextKey && cachedFormatted) {
      return Promise.resolve();
    }

    return resolveFormattedCoordinates(context).then(function (formatted) {
      if (token !== lookupToken) return;
      applyFormatted(formatted || "", contextKey);
    });
  }

  /**
   * @param {{ homeAt?: string, nowIn?: string }} context
   */
  function scheduleUpdateFromContext(context) {
    var homeAt = context && context.homeAt ? context.homeAt : "inIran";
    var nowIn = context && context.nowIn ? String(context.nowIn).trim() : "";
    var contextKey = getContextKey(context);
    var region;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    if (homeAt === "nowhere") {
      applyFormatted(NOWHERE_PLACEHOLDER, contextKey);
      return;
    }

    if (homeAt === "inIran") {
      updateFromContext(context);
      return;
    }

    if (homeAt === "whereILive") {
      if (!nowIn) {
        updateFromContext(context);
        return;
      }
      region = detectRegion(nowIn);
      if (region === "OTHER") {
        var fake = fakeCoordinates(nowIn);
        applyFormatted(formatCoordinates(fake.lat, fake.lon), contextKey);
        return;
      }
      debounceTimer = setTimeout(function () {
        debounceTimer = null;
        updateFromContext(context);
      }, 400);
      return;
    }

    updateFromContext(context);
  }

  window.LocationCoordinates = {
    getFormatted: function () {
      return cachedFormatted;
    },
    scheduleUpdateFromContext: scheduleUpdateFromContext,
    updateFromContext: updateFromContext,
    setOnUpdate: function (fn) {
      onUpdate = fn;
    },
    formatCoordinates: formatCoordinates,
    detectRegion: detectRegion,
    NOWHERE_PLACEHOLDER: NOWHERE_PLACEHOLDER,
  };
})();
