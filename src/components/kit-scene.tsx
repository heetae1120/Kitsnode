"use client";
import { useId } from "react";

/** Original vector object studies, not photographs of products for sale. */
export function KitScene({
  variant = "hero",
  className = "",
}: {
  variant?: "hero" | "heritage" | "present" | "next";
  className?: string;
}) {
  const id = useId().replaceAll(":", "");
  const g = (name: string) => `url(#${id}-${name})`;
  return (
    <svg
      className={`kit-scene ${className}`}
      viewBox="0 0 640 540"
      fill="none"
      role="img"
      aria-label={
        {
          hero: "금속 링, 정제된 패키지, 그린 오브제로 표현한 KITS의 조형 스터디",
          heritage: "시간의 흔적을 담은 아치와 석재 오브제 콘셉트",
          present: "모바일 라이프를 위한 세이지 그린 도구 콘셉트",
          next: "새로운 물성과 반사를 탐구하는 금속 링 콘셉트",
        }[variant]
      }
    >
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2=".85">
          <stop stopColor="#eff3ed" />
          <stop offset=".15" stopColor="#727a70" />
          <stop offset=".29" stopColor="#fcfff8" />
          <stop offset=".43" stopColor="#a4ada1" />
          <stop offset=".51" stopColor="#353d33" />
          <stop offset=".64" stopColor="#d4dcd0" />
          <stop offset=".8" stopColor="#f6faf0" />
          <stop offset="1" stopColor="#6a7565" />
        </linearGradient>
        <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fffdf2" />
          <stop offset=".65" stopColor="#d5d2bd" />
          <stop offset="1" stopColor="#aaa996" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#777d67" />
          <stop offset=".45" stopColor="#bfc2a5" />
          <stop offset="1" stopColor="#5f6955" />
        </linearGradient>
        <linearGradient id={`${id}-green`} x1="0" y1="0" x2=".9" y2="1">
          <stop stopColor="#d8e9b5" />
          <stop offset=".45" stopColor="#a3b77c" />
          <stop offset="1" stopColor="#596c41" />
        </linearGradient>
        <linearGradient id={`${id}-black`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#454b3d" />
          <stop offset=".6" stopColor="#24291f" />
          <stop offset="1" stopColor="#141912" />
        </linearGradient>
        <radialGradient id={`${id}-sphere`} cx=".3" cy=".25" r=".75">
          <stop stopColor="#f5f7f0" />
          <stop offset=".25" stopColor="#bfc8b6" />
          <stop offset=".55" stopColor="#66705d" />
          <stop offset=".78" stopColor="#2c3527" />
          <stop offset="1" stopColor="#a5b398" />
        </radialGradient>
        <filter
          id={`${id}-shadow`}
          x="-70%"
          y="-70%"
          width="240%"
          height="240%"
        >
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id={`${id}-soft`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow
            dx="7"
            dy="17"
            stdDeviation="10"
            floodColor="#000"
            floodOpacity=".2"
          />
        </filter>
        <pattern
          id={`${id}-grain`}
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r=".4" fill="#fff" opacity=".13" />
          <circle cx="4" cy="5" r=".4" fill="#000" opacity=".12" />
        </pattern>
      </defs>
      <ellipse
        cx="330"
        cy="452"
        rx="225"
        ry="31"
        fill="#000"
        opacity=".32"
        filter={g("shadow")}
      />
      {variant === "hero" && (
        <g>
          <g className="scene-ring" transform="translate(164 160) rotate(-29)">
            <ellipse rx="114" ry="99" fill={g("metal")} />
            <ellipse rx="75" ry="66" fill="#20251c" />
            <ellipse
              rx="78"
              ry="69"
              stroke="#f4f8e9"
              strokeWidth="1.5"
              opacity=".45"
            />
            <path
              d="M-88-38C-60-83 34-96 83-42"
              stroke="#fff"
              strokeWidth="3"
              opacity=".7"
            />
          </g>
          <g
            transform="translate(218 119) rotate(13 105 153)"
            filter={g("soft")}
          >
            <rect x="10" y="8" width="211" height="308" rx="7" fill="#8f927e" />
            <rect width="211" height="308" rx="6" fill={g("paper")} />
            <rect width="211" height="308" rx="6" fill={g("grain")} />
            <path d="M23 26H188" stroke="#9d9d87" strokeWidth=".6" />
            <text
              x="25"
              y="54"
              fontSize="10"
              letterSpacing="2.8"
              fill="#666c58"
              fontFamily="var(--font-pretendard), sans-serif"
            >
              THE EVERYDAY SERIES
            </text>
            <text
              x="21"
              y="145"
              fill="#343a2d"
              fontFamily="var(--font-pretendard), sans-serif"
              fontSize="69"
              fontWeight="700"
              letterSpacing="-5"
            >
              KITS
            </text>
            <path
              d="M26 222H70M26 229H61M26 236H65"
              stroke="#858873"
              strokeWidth="1"
            />
            <text
              x="25"
              y="280"
              fontSize="9"
              fill="#777d68"
              letterSpacing="1.2"
            >
              SENSIBLE BY NATURE.
            </text>
            <g stroke="#6c725e" strokeWidth="1.2">
              {Array.from({ length: 18 }, (_, i) => (
                <path
                  key={i}
                  d={`M${143 + i * 2} 231v${i % 3 === 0 ? 29 : 23}`}
                />
              ))}
            </g>
          </g>
          <g
            transform="translate(109 309) rotate(-16 87 59)"
            filter={g("soft")}
          >
            <rect x="3" y="7" width="177" height="119" rx="23" fill="#1b2118" />
            <rect width="177" height="119" rx="23" fill={g("black")} />
            <path d="M18 15H158" stroke="#88917e" strokeOpacity=".2" />
            <circle cx="139" cy="39" r="12" stroke="#8e9b7a" />
            <text
              x="20"
              y="94"
              fill="#a2ac93"
              fontSize="12"
              fontWeight="700"
              letterSpacing="1.5"
            >
              K/S — 001
            </text>
          </g>
          <g transform="translate(431 318) rotate(31)" filter={g("soft")}>
            <rect x="4" y="6" width="109" height="172" rx="54" fill="#51603e" />
            <rect width="109" height="172" rx="54" fill={g("green")} />
            <path
              d="M24 19C46 4 79 8 93 34"
              stroke="#e8f5d4"
              opacity=".55"
              strokeWidth="2"
            />
            <circle cx="54" cy="72" r="12" stroke="#697d4b" strokeWidth=".8" />
            <path d="M49 72h10m-5-5v10" stroke="#687b4c" />
            <text
              x="31"
              y="135"
              fontSize="10"
              letterSpacing="2.5"
              fill="#6c8051"
            >
              KITS
            </text>
          </g>
          <circle cx="480" cy="193" r="28" fill={g("sphere")} />
          <circle cx="151" cy="465" r="13" fill={g("sphere")} />
        </g>
      )}
      {variant === "heritage" && (
        <g transform="translate(81 57)">
          <path
            d="M75 377V190a153 153 0 0 1 306 0v187h-75V190a78 78 0 0 0-156 0v187Z"
            fill="#aaa795"
            transform="translate(13 10)"
          />
          <path
            d="M75 377V190a153 153 0 0 1 306 0v187h-75V190a78 78 0 0 0-156 0v187Z"
            fill={g("paper")}
          />
          <path
            d="M75 377V190a153 153 0 0 1 306 0v187h-75V190a78 78 0 0 0-156 0v187Z"
            fill={g("grain")}
          />
          <rect
            x="212"
            y="264"
            width="138"
            height="123"
            rx="5"
            fill={g("black")}
            transform="rotate(-11 280 326)"
          />
          <path
            d="M230 302h48m-48 7h29"
            stroke="#b5b6a3"
            strokeWidth="1"
            transform="rotate(-11 280 326)"
          />
          <circle cx="155" cy="379" r="36" fill={g("sphere")} />
          <text
            x="303"
            y="364"
            fill="#797d6b"
            fontSize="10"
            transform="rotate(-90 303 364)"
            letterSpacing="2"
          >
            INHERITED FORM
          </text>
        </g>
      )}
      {variant === "present" && (
        <g transform="translate(157 76) rotate(-16 153 200)" filter={g("soft")}>
          <rect x="8" y="8" width="272" height="366" rx="54" fill="#6e7c54" />
          <rect width="272" height="366" rx="54" fill={g("green")} />
          <rect
            x="18"
            y="18"
            width="236"
            height="330"
            rx="39"
            stroke="#dce9bf"
            strokeOpacity=".45"
          />
          <rect x="32" y="33" width="65" height="88" rx="23" fill="#677b4c" />
          <circle cx="53" cy="57" r="11" fill={g("sphere")} />
          <circle cx="76" cy="92" r="11" fill={g("sphere")} />
          <circle cx="136" cy="202" r="64" stroke="#6b7d50" strokeWidth="2" />
          <path
            d="M115 270H157"
            stroke="#6b7d50"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect
            x="81"
            y="167"
            width="112"
            height="26"
            rx="13"
            fill={g("metal")}
            transform="rotate(-24 137 180)"
          />
          <text
            x="99"
            y="326"
            fill="#5e7045"
            fontSize="19"
            letterSpacing="3"
            fontWeight="700"
          >
            KITS
          </text>
        </g>
      )}
      {variant === "next" && (
        <g>
          <g transform="translate(322 260) rotate(-27)">
            <ellipse rx="195" ry="149" fill={g("metal")} />
            <ellipse rx="136" ry="101" fill="#20251f" />
            <ellipse
              rx="140"
              ry="105"
              stroke="#f5f7ee"
              strokeWidth="1"
              opacity=".65"
            />
            <path
              d="M-149-50C-98-140 91-139 149-57"
              stroke="#fff"
              strokeWidth="4"
              opacity=".8"
            />
          </g>
          <circle cx="346" cy="274" r="59" fill={g("green")} />
          <circle cx="176" cy="395" r="25" fill={g("sphere")} />
        </g>
      )}
    </svg>
  );
}
