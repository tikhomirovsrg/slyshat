export default function SceneArt({small=false}:{small?:boolean}) {
 return <svg className={small?'scene-art small':'scene-art'} viewBox="0 0 580 390" role="img" aria-label="Уютное кафе Little Corner рядом со станцией">
 <defs><pattern id="grain" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="#473e2b" opacity=".07"/></pattern><clipPath id="arch"><path d="M150 285V139a77 77 0 0 1 154 0v146z"/></clipPath></defs>
 <rect width="580" height="390" fill="#e9deca"/><circle cx="440" cy="79" r="43" fill="#df9b68"/>
 <path d="M0 310L580 294V390H0z" fill="#d0d5c6"/><path d="M0 335L580 319M90 390L310 300M390 390L421 300" stroke="#b9bfaf" strokeWidth="1.3"/>
 <path d="M74 306V38h278v268" fill="#f5efdf"/><path d="M79 43h265v263" fill="none" stroke="#cdc3af" strokeWidth="2"/>
 <path d="M109 100V75h204v25" fill="#2f5048"/><text x="211" y="92" fontSize="13" fill="#f6edda" textAnchor="middle" letterSpacing="3" fontFamily="Georgia">LITTLE CORNER</text>
 <path d="M142 305V154a77 77 0 0 1 154 0v151" fill="#bc7857"/><path d="M151 298V155a68 68 0 0 1 136 0v143" fill="#304c45"/>
 <path d="M153 298V155a66 66 0 0 1 132 0v143" fill="#779080" opacity=".5"/>
 <path d="M154 215h130M220 90v209" stroke="#e7d7bc" strokeWidth="5"/>
 <path d="M170 117l32 74M175 236l28 45M237 125l30 62" stroke="#f7f0de" opacity=".2" strokeWidth="10"/>
 <rect x="238" y="248" width="22" height="32" rx="2" fill="#ede2cb" transform="rotate(-5 249 264)"/><text x="249" y="260" fontSize="5" textAnchor="middle" fill="#405a4d">COFFEE</text><path d="M243 266h12m-12 4h10" stroke="#ba8062"/>
 <path d="M352 60h70v248h-70" fill="#ddcdb8"/><rect x="367" y="103" width="36" height="75" rx="18" fill="#779080"/><path d="M385 106v69m-17-34h34" stroke="#efe4d0" strokeWidth="3"/>
 <path d="M99 308l-8-42h35l-8 42" fill="#aa6b50"/><path d="M108 273v-63m-1 30c-35-19-24-42-24-42 30 5 25 42 25 42m2 16c27-6 29-34 29-34-26-1-29 34-29 34" fill="#526e54"/>
 <path d="M435 315v-95m-14 0h29" stroke="#37584d" strokeWidth="4"/><path d="M420 225h47v-32h-47z" fill="#f5efdf"/><text x="444" y="207" fontFamily="Arial" fontSize="7" textAnchor="middle" fill="#37584d">STATION</text><path d="M433 213h18m-4-3l4 3-4 3" stroke="#37584d" fill="none"/>
 <ellipse cx="324" cy="289" rx="38" ry="9" fill="#b89b79"/><path d="M324 296v42m-17 0h34" stroke="#355248" strokeWidth="4"/><path d="M278 308l-6 28m-4-32h24m-22-1-5-19m98 25 5 29m-15-33h25m-1-2 5-19" stroke="#5d7564" strokeWidth="4" fill="none"/>
 <path d="M313 278v8c0 6 13 6 13 0v-8z" fill="#faf5e7"/><path d="M327 280c10-2 8 7 0 6" stroke="#faf5e7" fill="none" strokeWidth="2"/>
 <path d="M315 270c-5-6 6-7 1-12m7 13c-5-6 5-7 1-12" stroke="#fbf6e9" fill="none" strokeWidth="2" opacity=".8"/>
 <path d="M486 313v-70m0 15c-27-21-22-43-22-43 29 9 22 43 22 43m1 18c28-8 29-40 29-40-31 5-29 40-29 40" fill="#6d805e"/><path d="M468 312h37l-6 27h-25z" fill="#bc7857"/>
 <rect width="580" height="390" fill="url(#grain)"/>
 </svg>;
}
