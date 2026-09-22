import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = path.join(root, "components/app-market/custom-app-runner.tsx");
let source = fs.readFileSync(runnerPath, "utf8");

if (source.includes("CUSTOM_APP_WORLD_CLOCK_V1")) {
  console.log("[patch-custom-app-world-clock] already applied");
  process.exit(0);
}

const importAnchor = 'import { getPwaHostedSafeArea, PWA_DISPLAY_MODE_CHANGED_EVENT } from "@/lib/pwa-display-mode";';
if (!source.includes(importAnchor)) throw new Error("Missing PWA import anchor in custom-app-runner");
source = source.replace(
  importAnchor,
  `${importAnchor}\nimport { STORY_CALENDAR_YEAR } from "@/lib/calendar-utils";`,
);

const bridgeAnchor = "  var seq = 0;\n";
if (!source.includes(bridgeAnchor)) throw new Error("Missing custom app bridge anchor");

const worldClock = String.raw`

  // CUSTOM_APP_WORLD_CLOCK_V1
  // Resource-market apps run inside this sandbox. Their date arithmetic stays on the
  // device calendar so weekday / leap-day behavior matches the phone, while every
  // exposed calendar year is shifted into the story world. Timers stay real-time.
  (function installAiPhoneWorldClock(){
    var NativeDate = window.Date;
    var NativeDateTimeFormat = window.Intl && window.Intl.DateTimeFormat;
    var realBaseYear = new NativeDate().getFullYear();
    var storyBaseYear = STORY_YEAR_TOKEN;
    var yearOffset = realBaseYear - storyBaseYear;

    function storyYearFromInternal(year){
      return Number(year) - yearOffset;
    }
    function internalYearFromStory(year){
      var numeric = Number(year);
      if (!isFinite(numeric)) return numeric;
      // Reinterpret values around the story era, but do not double-shift genuine
      // device-year values arriving from a network API or legacy stored data.
      if (Math.abs(numeric - storyBaseYear) <= 80) return numeric + yearOffset;
      return numeric;
    }
    function padYear(year){
      var numeric = Math.trunc(Number(year));
      if (numeric >= 0 && numeric <= 9999) return String(numeric).padStart(4, '0');
      var sign = numeric < 0 ? '-' : '+';
      return sign + String(Math.abs(numeric)).padStart(6, '0');
    }
    function nativeFullYear(date){
      try { return NativeDate.prototype.getFullYear.call(date); }
      catch (_) { return new NativeDate(date).getFullYear(); }
    }
    function storyYearFor(date){
      return storyYearFromInternal(nativeFullYear(date));
    }
    function mapStoryDateText(value){
      var text = String(value);
      return text.replace(/(^|[^0-9])(1[89][0-9]{2}|20[0-9]{2})(?=[^0-9]|$)/g, function(match, prefix, yearText){
        var year = Number(yearText);
        var mapped = internalYearFromStory(year);
        return prefix + (mapped === year ? yearText : String(mapped));
      });
    }
    function replaceDisplayedYear(text, date){
      var internalYear = nativeFullYear(date);
      var storyYear = storyYearFromInternal(internalYear);
      return String(text).replace(new RegExp('(^|[^0-9])' + String(internalYear) + '(?=[^0-9]|$)', 'g'), function(match, prefix){
        return prefix + String(storyYear);
      });
    }
    function worldYearPart(partValue, date){
      var storyYear = storyYearFor(date);
      if (/^[0-9]{2}$/.test(String(partValue))) return String(Math.abs(storyYear) % 100).padStart(2, '0');
      return String(storyYear);
    }
    function mapParts(parts, date){
      return parts.map(function(part){
        if (part.type !== 'year') return part;
        return { type: part.type, value: worldYearPart(part.value, date), source: part.source };
      });
    }

    function makeInternalDate(args){
      if (!args.length) return new NativeDate();
      if (args.length === 1) {
        var only = args[0];
        if (typeof only === 'string') return new NativeDate(mapStoryDateText(only));
        return new NativeDate(only);
      }
      var mapped = args.slice();
      if (typeof mapped[0] === 'number') mapped[0] = internalYearFromStory(mapped[0]);
      return Reflect.construct(NativeDate, mapped);
    }

    function WorldDate(){
      var args = Array.prototype.slice.call(arguments);
      if (!(this instanceof WorldDate)) return new WorldDate().toString();
      var date = makeInternalDate(args);
      Object.setPrototypeOf(date, WorldDate.prototype);
      return date;
    }
    WorldDate.prototype = Object.create(NativeDate.prototype);
    Object.defineProperty(WorldDate.prototype, 'constructor', { value: WorldDate, configurable: true, writable: true });
    Object.setPrototypeOf(WorldDate, NativeDate);

    WorldDate.now = function(){ return NativeDate.now(); };
    WorldDate.parse = function(value){ return NativeDate.parse(mapStoryDateText(value)); };
    WorldDate.UTC = function(){
      var args = Array.prototype.slice.call(arguments);
      if (typeof args[0] === 'number') args[0] = internalYearFromStory(args[0]);
      return NativeDate.UTC.apply(NativeDate, args);
    };

    WorldDate.prototype.getFullYear = function(){
      return storyYearFromInternal(NativeDate.prototype.getFullYear.call(this));
    };
    WorldDate.prototype.getUTCFullYear = function(){
      return storyYearFromInternal(NativeDate.prototype.getUTCFullYear.call(this));
    };
    WorldDate.prototype.getYear = function(){ return this.getFullYear() - 1900; };
    WorldDate.prototype.setFullYear = function(year){
      var args = Array.prototype.slice.call(arguments);
      args[0] = internalYearFromStory(year);
      return NativeDate.prototype.setFullYear.apply(this, args);
    };
    WorldDate.prototype.setUTCFullYear = function(year){
      var args = Array.prototype.slice.call(arguments);
      args[0] = internalYearFromStory(year);
      return NativeDate.prototype.setUTCFullYear.apply(this, args);
    };
    WorldDate.prototype.setYear = function(year){
      var numeric = Number(year);
      if (numeric >= 0 && numeric <= 99) numeric += 1900;
      return this.setFullYear(numeric);
    };
    WorldDate.prototype.toISOString = function(){
      var native = NativeDate.prototype.toISOString.call(this);
      var storyYear = storyYearFromInternal(NativeDate.prototype.getUTCFullYear.call(this));
      return padYear(storyYear) + native.slice(4);
    };
    WorldDate.prototype.toJSON = function(){ return this.toISOString(); };
    WorldDate.prototype.toString = function(){ return replaceDisplayedYear(NativeDate.prototype.toString.call(this), this); };
    WorldDate.prototype.toDateString = function(){ return replaceDisplayedYear(NativeDate.prototype.toDateString.call(this), this); };
    WorldDate.prototype.toUTCString = function(){ return replaceDisplayedYear(NativeDate.prototype.toUTCString.call(this), this); };
    WorldDate.prototype.toGMTString = WorldDate.prototype.toUTCString;
    WorldDate.prototype.toLocaleString = function(locales, options){
      var text = NativeDate.prototype.toLocaleString.call(this, locales, options);
      if (options && options.year === '2-digit' && NativeDateTimeFormat) {
        try {
          var parts = new NativeDateTimeFormat(locales, options).formatToParts(this);
          return mapParts(parts, this).map(function(part){ return part.value; }).join('');
        } catch (_) {}
      }
      return replaceDisplayedYear(text, this);
    };
    WorldDate.prototype.toLocaleDateString = function(locales, options){
      var text = NativeDate.prototype.toLocaleDateString.call(this, locales, options);
      if (options && options.year === '2-digit' && NativeDateTimeFormat) {
        try {
          var parts = new NativeDateTimeFormat(locales, options).formatToParts(this);
          return mapParts(parts, this).map(function(part){ return part.value; }).join('');
        } catch (_) {}
      }
      return replaceDisplayedYear(text, this);
    };
    WorldDate.prototype.toLocaleTimeString = function(locales, options){
      return replaceDisplayedYear(NativeDate.prototype.toLocaleTimeString.call(this, locales, options), this);
    };

    window.Date = WorldDate;

    // Intl.DateTimeFormat bypasses Date.prototype formatting, so wrap it too.
    if (NativeDateTimeFormat && window.Intl) {
      function WorldDateTimeFormat(locales, options){
        var formatter = new NativeDateTimeFormat(locales, options);
        return new Proxy(formatter, {
          get: function(target, prop){
            if (prop === 'format') return function(value){
              var date = value === undefined ? new NativeDate() : new NativeDate(value instanceof NativeDate ? value.getTime() : value);
              try {
                return mapParts(target.formatToParts(date), date).map(function(part){ return part.value; }).join('');
              } catch (_) {
                return replaceDisplayedYear(target.format(date), date);
              }
            };
            if (prop === 'formatToParts') return function(value){
              var date = value === undefined ? new NativeDate() : new NativeDate(value instanceof NativeDate ? value.getTime() : value);
              return mapParts(target.formatToParts(date), date);
            };
            if (prop === 'formatRange' && typeof target.formatRangeToParts === 'function') return function(start, end){
              var startDate = new NativeDate(start instanceof NativeDate ? start.getTime() : start);
              var endDate = new NativeDate(end instanceof NativeDate ? end.getTime() : end);
              return target.formatRangeToParts(startDate, endDate).map(function(part){
                if (part.type !== 'year') return part.value;
                var date = part.source === 'endRange' ? endDate : startDate;
                return worldYearPart(part.value, date);
              }).join('');
            };
            if (prop === 'formatRangeToParts' && typeof target.formatRangeToParts === 'function') return function(start, end){
              var startDate = new NativeDate(start instanceof NativeDate ? start.getTime() : start);
              var endDate = new NativeDate(end instanceof NativeDate ? end.getTime() : end);
              return target.formatRangeToParts(startDate, endDate).map(function(part){
                if (part.type !== 'year') return part;
                var date = part.source === 'endRange' ? endDate : startDate;
                return { type: part.type, value: worldYearPart(part.value, date), source: part.source };
              });
            };
            var value = Reflect.get(target, prop, target);
            return typeof value === 'function' ? value.bind(target) : value;
          }
        });
      }
      WorldDateTimeFormat.supportedLocalesOf = NativeDateTimeFormat.supportedLocalesOf.bind(NativeDateTimeFormat);
      Object.setPrototypeOf(WorldDateTimeFormat, NativeDateTimeFormat);
      WorldDateTimeFormat.prototype = NativeDateTimeFormat.prototype;
      window.Intl.DateTimeFormat = WorldDateTimeFormat;
    }

    window.AiPhoneWorldClock = Object.freeze({
      storyYear: storyBaseYear,
      deviceYear: realBaseYear,
      yearOffset: yearOffset,
      now: function(){ return new WorldDate(); }
    });
  })();
`;

const injected = worldClock.replace("STORY_YEAR_TOKEN", "${STORY_CALENDAR_YEAR}");
source = source.replace(bridgeAnchor, bridgeAnchor + injected);

fs.writeFileSync(runnerPath, source, "utf8");
console.log("[patch-custom-app-world-clock] resource-market apps now follow the story calendar year");
