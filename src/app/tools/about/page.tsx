import type { Metadata } from "next";
import Link from "next/link";
import { AboutGalleryHero } from "@/components/about-gallery-hero";
import "./about-gallery.css";
import { ToolsHeader } from "@/components/tools-header";
import { BrandHomeLink } from "@/components/brand-wordmark";
import { StoreSurvey } from "@/components/store-survey";
import { AD_CHECK_HREF } from "@/components/public-categories";
import "../finance-bento.css";
import "../kits-pages.css";
import "../survey/survey.css";

export const metadata: Metadata = {
  title: "소개 | KITSNODE",
  description:
    "광고비와 이익을 함께 보고 브랜드를 키웁니다. 브랜드를 처음부터 키워온 팀입니다.",
};

export default function AboutPage() {
  return (
    <div className="kits-page finance-dashboard about-gallery-page">
      <ToolsHeader active="about" />
      <main className="kp-main">
        <AboutGalleryHero />

        <section className="kp-section" id="kp-approach" aria-labelledby="kp-problem-title">
          <div className="kp-wrap">
            <h2 id="kp-problem-title">주문 한 건에 남는 돈부터 봅니다.</h2>
            <p className="kp-lede">
              판매가에서 원가, 수수료, 배송·반품비와 광고비를 빼면 주문 한 건의 이익이 보입니다. 이 금액을 기준으로 광고 예산을 판단해요.
            </p>
            <div className="kp-contrast">
              <div>
                <h3>보고서에서 보는 숫자</h3>
                <ul>
                  <li>
                    상위노출
                    <small>어떤 검색어에서 상품이 보였는지</small>
                  </li>
                  <li>
                    ROAS
                    <small>광고비 대비 광고에 집계된 매출</small>
                  </li>
                  <li>
                    매출 상승
                    <small>판매로 들어온 금액의 변화</small>
                  </li>
                </ul>
              </div>
              <div>
                <h3>키츠노드가 함께 보는 숫자</h3>
                <ul>
                  <li>
                    광고 없이 찾아온 고객
                    <small>자연 검색으로 들어오는 상품과 검색어를 봅니다</small>
                  </li>
                  <li>
                    주문 한 건의 이익
                    <small>판매 비용과 광고비를 빼고 실제로 남는 돈을 계산합니다</small>
                  </li>
                  <li>
                    매출이 늘 때의 이익
                    <small>판매가 늘면서 총이익도 함께 커지는지 확인합니다</small>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="kp-tired" aria-labelledby="kp-tired-title">
          <div className="kp-wrap kp-section">
            <div>
              <h2 id="kp-tired-title">진단한 숫자로 판매를 다듬습니다.</h2>
              <p className="kp-lede">
                이익이 줄어드는 지점을 찾으면 가격, 비용, 상품 설명 중 어디부터 손볼지 정할 수 있습니다.
              </p>
            </div>
            <ul className="kp-tired-list">
              <li>
                가격과 비용 점검
                <span>상품별 손익을 보고 조정할 수 있는 비용부터 찾습니다.</span>
              </li>
              <li>
                검색과 상품 페이지 점검
                <span>고객이 쓰는 검색어와 상품 페이지가 구매에 필요한 정보를 주는지 확인합니다.</span>
              </li>
              <li>
                집행 여부 판단
                <span>예상 광고비가 주문당 이익 범위 안에 들어오는지 비교합니다.</span>
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
              <Link href={AD_CHECK_HREF}>
                광고·키워드 분석<span>검색량과 클릭당 광고비 확인</span>
              </Link>
              <Link href="#survey">
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
            <Link className="kp-button primary" href="#survey">
              설문 시작하기
            </Link>
          </div>
        </section>
        <section id="survey" className="survey-page" aria-labelledby="about-survey-title">
          <div className="kp-wrap kp-survey">
            <div className="kp-survey-intro">
              <h2 id="about-survey-title">브랜드 설문</h2>
              <p>만들고 싶은 브랜드를 알려주세요. 첫걸음을 함께 정리할게요.</p>
              <ul>
                <li>브랜드 이야기부터 연락처까지 8단계예요</li>
                <li>아직 정하지 못한 부분이 있어도 괜찮아요</li>
                <li>마지막에 연락처를 남겨주세요</li>
              </ul>
            </div>
            <StoreSurvey />
          </div>
        </section>
        <div className="kp-plate kp-close">
          <div className="kp-wrap">
            <footer className="kp-footer">
              <BrandHomeLink className="kn-wordmark"/>
              <span>고객이 다시 찾는 브랜드를 만듭니다</span>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
