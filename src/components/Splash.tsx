// Static scenery, copied verbatim from the single-file version.
const FIGURE = (x: number, y: number, c: string) =>
  `<g transform="translate(${x} ${y}) scale(1.5)"><ellipse cx="0" cy="0.6" rx="7.5" ry="1.6" fill="#0E2F22" opacity=".25"/><g stroke="${c}" stroke-linecap="round" fill="none"><path d="M-3 0 L-2.6 -11" stroke-width="3.6"/><path d="M3 0 L2.6 -11" stroke-width="3.6"/><path d="M-5.4 -21 Q-8.4 -16 -8 -10.5" stroke-width="3"/><path d="M5.4 -21 Q8.4 -16 8 -10.5" stroke-width="3"/></g><path d="M-5.8 -10 Q-6.6 -22.5 0 -24 Q6.6 -22.5 5.8 -10 Q0 -8.6 -5.8 -10Z" fill="${c}"/><circle cx="0" cy="-29.2" r="4.6" fill="${c}"/></g>`;

const HILLS = `
<defs>
  <linearGradient id="g-main" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3E6E56"/><stop offset="1" stop-color="#1E4C38"/></linearGradient>
  <linearGradient id="g-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C8D2C6"/><stop offset="1" stop-color="#E1E0D4"/></linearGradient>
  <linearGradient id="g-mid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A3B3A5"/><stop offset="1" stop-color="#C9CEC3"/></linearGradient>
  <linearGradient id="g-mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F1E7CF" stop-opacity="0"/><stop offset="1" stop-color="#EDE6D6" stop-opacity=".9"/></linearGradient>
  <radialGradient id="g-sun"><stop offset="0" stop-color="#F0D89C" stop-opacity=".85"/><stop offset="1" stop-color="#F0D89C" stop-opacity="0"/></radialGradient>
</defs>
<circle cx="1060" cy="190" r="220" fill="url(#g-sun)"/>
<circle cx="1060" cy="190" r="44" fill="#E3C888" opacity=".9"/>
<g fill="#FBF8EE" opacity=".55">
  <ellipse cx="260" cy="150" rx="120" ry="14"/><ellipse cx="330" cy="136" rx="70" ry="12"/><ellipse cx="190" cy="136" rx="52" ry="9"/>
  <ellipse cx="1180" cy="96" rx="110" ry="12"/><ellipse cx="1240" cy="82" rx="60" ry="10"/>
  <ellipse cx="620" cy="70" rx="90" ry="10" opacity=".7"/><ellipse cx="560" cy="60" rx="48" ry="8" opacity=".7"/>
</g>
<path d="M0 330 C90 300 160 270 250 282 C330 292 380 236 470 222 C560 208 610 250 690 244 C790 236 860 176 960 186 C1060 196 1110 246 1210 238 C1300 231 1380 256 1440 250 V520 H0Z" fill="url(#g-back)"/>
<rect x="0" y="250" width="1440" height="120" fill="url(#g-mist)"/>
<path d="M0 390 L110 322 L170 346 L300 250 L380 300 L440 276 L640 450 V520 H0Z" fill="url(#g-mid)"/>
<path d="M900 520 L1060 300 L1130 336 L1230 262 L1340 330 L1440 300 V520Z" fill="url(#g-mid)"/>
<rect x="0" y="330" width="1440" height="130" fill="url(#g-mist)"/>
<path d="M360 520 L590 262 L650 298 L686 140 Q760 128 834 140 L850 236 L905 206 L1130 520Z" fill="url(#g-main)"/>
<path d="M802 138 L848 240 L905 210 L1126 520 L840 520 L800 330 L790 220 L784 140Z" fill="#3C6A55" opacity=".35"/>
<path d="M470 520 C540 470 600 452 640 420 C690 380 640 350 690 316 C730 288 700 250 735 214 C748 194 726 166 724 140" fill="none" stroke="#F3EFE6" stroke-width="2.5" stroke-dasharray="1 8" stroke-linecap="round" opacity=".9"/>
<g fill="#F3EFE6" stroke="#3C6A55" stroke-width="2.5">
  <circle cx="640" cy="420" r="6"/><circle cx="690" cy="316" r="6"/><circle cx="735" cy="214" r="6"/>
</g>
<path d="M760 132 V30" stroke="#101111" stroke-width="2.5" stroke-linecap="round"/>
<path d="M761 30 C774 25 786 37 800 32 L800 58 C786 63 774 51 761 56Z" fill="#6E2428"/>
<g class="climbers">${FIGURE(702, 136, '#101111')}${FIGURE(732, 134, '#154230')}${FIGURE(789, 134, '#5D1E21')}${FIGURE(819, 136, '#A6824A')}</g>
<path d="M0 450 C180 420 320 470 520 456 C720 442 860 486 1060 468 C1240 452 1340 440 1440 446 V520 H0Z" fill="#3A6A53"/>
<path d="M0 488 C220 470 420 500 700 492 C960 484 1200 500 1440 486 V520 H0Z" fill="#24503D"/>`;

export function Splash({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="screen splash active" id="s-splash">
      <div className="inner">
        <div className="logo">
          <svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true">
            <circle cx="25" cy="25" r="15" fill="none" stroke="#101111" strokeWidth="5" />
            <circle cx="39" cy="39" r="15" fill="none" stroke="#101111" strokeWidth="5" />
          </svg>
          <span>Connection.App</span>
        </div>
        <h1>The <span>Ascent</span></h1>
        <p className="sub">6 weeks &middot; Kickoff Day Monday, November 30, 2026</p>
        <div className="stack">
          <button className="btn" type="button" onClick={onOpen}>Open the Plan</button>
        </div>
      </div>
      <svg className="hills" viewBox="0 0 1440 520" preserveAspectRatio="xMidYMax slice" aria-hidden="true" dangerouslySetInnerHTML={{ __html: HILLS }} />
    </section>
  );
}
