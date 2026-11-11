/* The respelling engines, by pair id (<target>-<native>). A pair that has one needs no respelling in its sources:
   tools/wordbase.js fills every empty respelling ("") from the engine when it reads the sources. */
'use strict';
const engines={
  'es-tr':()=>require('./es-tr.js').respell,
  'tr-fr':()=>require('./tr-fr.js').transcribe
};
// a respelling holds letters, digits and ordinary punctuation only (symbols of a grammar note such as "ir a + mastar" are dropped)
const clean=text=>text.replace(/[^\p{L}\p{N} ,.;:!?'’\-–—()…\/"«»]/gu,'').replace(/\s+/g,' ').trim();
module.exports={forPair:pair=>{const run=engines[pair]&&engines[pair]();return run?text=>clean(run(text)):null;},pairs:Object.keys(engines)};
