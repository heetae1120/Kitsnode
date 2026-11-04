import type { Metadata } from "next";
import Link from "next/link";
import { ToolsHeader } from "@/components/tools-header";
import "../finance-bento.css";
import "../kits-pages.css";

export const metadata: Metadata = {
  title: "소개 | KITSNODE",
  description:
    "광고비와 이익을 함께 보고 브랜드를 키웁니다. 리큐엠을 처음부터 키워온 팀입니다.",
};

// Agency talking points that circle the core. Angles in degrees; rings rotate
// in opposite directions while each label counter-rotates to stay upright.
const outer = [
  ["검색 노출 점수", 200],
  ["광고비 대비 매출", 290],
  ["상위노출", 20],
  ["광고비", 110],
] as const;
const inner = [
  ["순위 변동", 245],
  ["클릭 수", 5],
  ["노출 수", 125],
] as const;
const place = (deg: number) => ({
  left: `${50 + 50 * Math.cos((deg * Math.PI) / 180)}%`,
  top: `${50 + 50 * Math.sin((deg * Math.PI) / 180)}%`,
});

export default function AboutPage() {
  return (
    <div className="kits-page finance-dashboard">
      <ToolsHeader active="about" />
      <main className="kp-main">
        <section className="kp-plate" aria-labelledby="kp-hero-title">
          <div className="kp-wrap kp-hero">
            <div>
              <h1 id="kp-hero-title">
                순위 말고,
                <br />
                브랜드를 남깁니다
              </h1>
              <p className="kp-hero-lede">
                광고를 줄여도 고객이 찾는 브랜드를 만듭니다.
              </p>
              <div className="kp-actions">
                <Link className="kp-button primary" href="/tools/survey/">
                  진단 설문하기
                </Link>
                <a className="kp-button quiet" href="#proof">
                  리큐엠 사례 보기
                </a>
              </div>
            </div>
            <div
              className="kp-orbit"
              role="img"
              aria-label="검색 노출 점수, 광고비 대비 매출, 상위노출, 광고비, 순위 변동이 주변을 돌고, 가운데에는 브랜드 기반이 고정되어 있는 그림"
            >
              <div
                className="kp-ring"
                style={{ "--inset": "4%", "--speed": "60s" } as React.CSSProperties}
              >
                {outer.map(([label, deg]) => (
                  <span key={label} style={place(deg)}>
                    <b>{label}</b>
                  </span>
                ))}
              </div>
              <div
                className="kp-ring reverse"
                style={{ "--inset": "20%", "--speed": "44s" } as React.CSSProperties}
              >
                {inner.map(([label, deg]) => (
                  <span key={label} style={place(deg)}>
                    <b>{label}</b>
                  </span>
                ))}
              </div>
              <div className="kp-core">
                <strong>브랜드 기반</strong>
                <span>운영의 중심</span>
              </div>
            </div>
          </div>
        </section>

        <section className="kp-section" aria-labelledby="kp-problem-title">
          <div className="kp-wrap">
            <h2 id="kp-problem-title">광고 매출만 보고 있나요?</h2>
            <p className="kp-lede">
              매출이 늘어도 이익이 없을 수 있어요. 고객이 다시 찾는지도 함께 봅니다.
            </p>
            <div className="kp-contrast">
              <div>
                <h3>대행사가 보여주는 것</h3>
                <ul>
                  <li>
                    <s>검색 노출 점수</s>
                    <small>상품명과 태그를 다듬은 점수표</small>
                  </li>
                  <li>
                    <s>광고 매출 보고서</s>
                    <small>광고비 안에서만 계산된 효율</small>
                  </li>
                  <li>
                    <s>광고로 끌어올린 순위</s>
                    <small>광고비가 멈추면 함께 내려가는 자리</small>
                  </li>
                </ul>
              </div>
              <div>
                <h3>우리가 먼저 만드는 것</h3>
                <ul>
                  <li>
                    꾸준히 팔 수 있는 기반
                    <small>상품·가격·설명·리뷰를 함께 다듬습니다</small>
                  </li>
                  <li>
                    광고 없이도 이어지는 판매 흐름
                    <small>다시 찾고, 다시 사는 고객이 남는 스토어</small>
                  </li>
                  <li>
                    대표님이 직접 판단할 수 있는 숫자
                    <small>남는 돈과 검색 수요를 직접 확인하는 기준</small>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="kp-tired" aria-labelledby="kp-tired-title">
          <div className="kp-wrap kp-section">
            <div>
              <h2 id="kp-tired-title">이런 순위 변동에 지치셨다면</h2>
              <p className="kp-lede">
                광고로 잠깐 올랐다가 꺼지는 순위는 브랜드에 아무것도 남기지
                않습니다.
              </p>
            </div>
            <ul className="kp-tired-list">
              <li>
                켜면 오르고, 끄면 떨어지는 순위
                <span>광고비가 멈추는 순간 다시 처음으로 돌아갑니다.</span>
              </li>
              <li>
                좋아진 숫자는 많은데 남는 매출이 없는 리포트
                <span>보고서의 성과와 통장의 성과가 다릅니다.</span>
              </li>
              <li>
                다음 달에도 같은 광고비를 써야 하는 구조
                <span>운영의 주도권이 광고에 묶여 있습니다.</span>
              </li>
            </ul>
          </div>
        </section>

        <section
          className="kp-plate kp-proof"
          id="proof"
          aria-labelledby="kp-proof-title"
        >
          <div className="kp-wrap">
            <div className="kp-proof-grid">
              <div>
                <h2 id="kp-proof-title">리큐엠도 처음부터 시작했습니다</h2>
                <p className="kp-figure">
                  <strong>
                    130억
                  </strong>
                  <span>까지, 3~4년</span>
                </p>
                <div className="kp-timeline" aria-hidden>
                  <b>처음</b>
                  <i />
                  <b>130억</b>
                </div>
              </div>
              <div className="kp-proof-side">
                <p>
                  광고 순위에 기대지 않고, 꾸준히 팔 수 있는 기반부터
                  쌓았습니다. 그 결과가 지금의 리큐엠입니다.
                </p>
                <p>말보다 스토어를 직접 확인해 보세요.</p>
                <a
                  className="kp-button quiet"
                  href="https://brand.naver.com/reqm"
                  target="_blank"
                  rel="noreferrer"
                >
                  리큐엠 브랜드스토어 보기
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="kp-section kp-data" aria-labelledby="kp-data-title">
          <div className="kp-wrap">
            <div>
              <h2 id="kp-data-title">결과와 데이터로만 말합니다</h2>
              <p className="kp-lede">
                남는 돈과 검색량을 직접 확인해 보세요.
              </p>
            </div>
            <nav className="kp-data-links" aria-label="데이터 도구">
              <Link href="/tools/">
                남는 돈 계산<span>광고비를 쓰고 남는 돈</span>
              </Link>
              <Link href="/tools/keywords/">
                검색어 찾기<span>PC·모바일 검색량 비교</span>
              </Link>
              <Link href="/tools/survey/">
                진단 설문<span>내 스토어 상황 알려주기</span>
              </Link>
            </nav>
          </div>
        </section>

        <section className="kp-plate kp-close" aria-labelledby="kp-close-title">
          <div className="kp-wrap kp-close-row">
            <div>
              <h2 id="kp-close-title">우리 스토어부터 진단해 보세요</h2>
              <p>지금 고민을 알려주세요. 함께 살펴볼게요.</p>
            </div>
            <Link className="kp-button primary" href="/tools/survey/">
              설문 시작하기
            </Link>
          </div>
          <div className="kp-wrap">
            <footer className="kp-footer">
              <strong>KITSNODE</strong>
              <span>고객이 다시 찾는 브랜드를 만듭니다</span>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
