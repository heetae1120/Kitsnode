import type { Metadata } from "next";
import Link from "next/link";
import { AboutGalleryHero } from "@/components/about-gallery-hero";
import "./about-gallery.css";
import { ToolsHeader } from "@/components/tools-header";
import "../finance-bento.css";
import "../kits-pages.css";

export const metadata: Metadata = {
  title: "소개 | KITSNODE",
  description:
    "광고비와 이익을 함께 보고 브랜드를 키웁니다. 브랜드을 처음부터 키워온 팀입니다.",
};

export default function AboutPage() {
  return (
    <div className="kits-page finance-dashboard about-gallery-page">
      <ToolsHeader active="about" />
      <main className="kp-main">
        <AboutGalleryHero />

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
                <h2 id="kp-proof-title">브랜드도 처음부터 시작했습니다</h2>
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
                  쌓았습니다. 그 결과가 지금의 브랜드입니다.
                </p>
                <p>말보다 스토어를 직접 확인해 보세요.</p>
                <a
                  className="kp-button quiet"
                  href="https://brand.naver.com/reqm"
                  target="_blank"
                  rel="noreferrer"
                >
                  브랜드 브랜드스토어 보기
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
