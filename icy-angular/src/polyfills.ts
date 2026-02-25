// Prevent zone.js from patching unload handlers to improve bfcache compatibility.
(window as any).__Zone_ignore_on_properties = [
  {
    target: window,
    ignoreProperties: ['unload', 'beforeunload']
  }
];
(window as any).__zone_symbol__UNPATCHED_EVENTS = ['unload', 'beforeunload'];

import 'zone.js';
