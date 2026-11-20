import {useId} from 'react';

export function DealWheelSky(){
  const id=useId();
  return <svg className="dw-sky" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id={id+'sky'} x2="0" y2="1"><stop stopColor="#5485b6"/><stop offset=".52" stopColor="#b3b5cf"/><stop offset="1" stopColor="#edb69a"/></linearGradient>
      <linearGradient id={id+'sun'} x2="0" y2="1"><stop stopColor="#fff0bd"/><stop offset="1" stopColor="#e5a17f"/></linearGradient>
      <filter id={id+'soft'}><feGaussianBlur stdDeviation="12"/></filter>
      <filter id={id+'grain'}><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3" stitchTiles="stitch"/></filter>
    </defs>
    <path fill={'url(#'+id+'sky)'} d="M0 0H1440V800H0Z"/>
    <g fill={'url(#'+id+'sun)'} filter={'url(#'+id+'soft)'}>
      <path d="M965 800V475C944 405 989 366 1044 385C1008 331 1058 290 1106 310C1071 254 1109 220 1158 231C1170 176 1238 170 1265 224C1328 196 1357 243 1337 285C1418 261 1459 320 1440 374V800Z"/>
      <path d="M0 800V620C17 562 68 563 95 582C83 510 145 482 188 520C193 459 257 443 288 495C343 458 386 508 371 558C431 531 477 580 454 632L617 800Z"/>
      <path d="M732 96C838 49 907 57 969 81C1041 30 1147 28 1240 60C1298 36 1382 38 1440 70V113C1341 83 1280 102 1218 102C1119 80 1050 112 985 112C868 89 821 114 732 96Z"/>
    </g>
    <path d="M0 0H1440V800H0Z" filter={'url(#'+id+'grain)'} opacity=".065"/>
  </svg>;
}

/** Solid foreground: cards can never show through the cloud bank. */
export function DealWheelClouds(){
  const id=useId();
  return <svg className="dw-clouds" viewBox="0 0 1440 380" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id={id+'cloud'} x2="0" y2="1"><stop stopColor="#fff0cf"/><stop offset=".62" stopColor="#efc0a0"/><stop offset="1" stopColor="#c39ba3"/></linearGradient></defs>
    <path d="M0 115C34 70 81 79 99 121C107 62 167 56 193 97C211 34 284 27 317 91C364 57 407 89 414 132C448 108 499 129 503 169C543 145 592 154 615 198C659 162 702 177 726 210C750 176 797 176 822 198C846 150 901 138 938 169C950 111 1007 95 1043 132C1053 74 1117 64 1150 108C1165 48 1245 42 1274 97C1312 63 1370 76 1376 122C1407 103 1421 109 1440 125V380H0Z" fill={'url(#'+id+'cloud)'}/>
    <path d="M0 253C54 210 102 231 129 263C155 203 228 196 263 251C302 215 356 232 365 275C408 243 452 254 471 288C518 242 579 262 605 300C642 269 688 275 710 307C744 260 806 261 836 300C868 255 926 247 956 285C991 241 1054 233 1087 272C1122 217 1187 216 1221 258C1257 208 1325 203 1363 248C1391 229 1421 232 1440 254V380H0Z" fill="#e7b3a0"/>
    <path d="M0 332C130 294 202 339 307 320C426 297 497 346 605 330C701 311 780 349 886 326C1019 298 1102 343 1194 322C1295 301 1364 321 1440 308V380H0Z" fill="#d5a6a6"/>
  </svg>;
}
