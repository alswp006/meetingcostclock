// 검수 준수 정적 테스트 — src/**/*.ts(x)(테스트 제외)를 스캔해 토스 검수 반려 패턴을 막는다.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..");

// 개발 전용 갤러리(프로덕션 빌드에서 tree-shake됨)와 템플릿 조건부 라벨은 문구 검사에서만 제외
const DEV_ONLY = new Set(["pages/__TdsGallery.tsx"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "__tests__" || e.name === "node_modules") continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !e.name.startsWith("__")) {
      out.push(p);
    }
  }
  return out;
}

const FILES = walk(SRC).map((f) => ({
  rel: path.relative(SRC, f).split(path.sep).join("/"),
  body: fs.readFileSync(f, "utf8"),
}));

/** 주석(블록·라인)을 제거한다 — 문구 검사는 사용자에게 보이는 코드만 대상으로 한다. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

function grepLines(re: RegExp, opts: { code?: boolean; skip?: Set<string> } = {}): string[] {
  const hits: string[] = [];
  for (const { rel, body } of FILES) {
    if (opts.skip?.has(rel)) continue;
    const text = opts.code ? stripComments(body) : body;
    text.split("\n").forEach((line, i) => {
      if (re.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
    });
  }
  return hits;
}

function grepFiles(re: RegExp): string[] {
  return FILES.filter(({ body }) => re.test(stripComments(body))).map(({ rel }) => rel);
}

describe("검수 준수 정적 스캔", () => {
  it("스캔 대상이 실제로 존재한다", () => {
    expect(FILES.length).toBeGreaterThan(20);
    expect(FILES.some((f) => f.rel === "App.tsx")).toBe(true);
  });

  it("AC-1: HEX 색상 리터럴이 0건이다(다크모드 — var(--tds-color-*)만)", () => {
    expect(grepLines(/#[0-9a-fA-F]{3,8}\b/)).toEqual([]);
  });

  it("AC-2: 금지 UI 라이브러리(shadcn/mui/antd/chakra) import가 0건이다", () => {
    const banned =
      /(from\s+|import\s*\(|require\()\s*["'](@mui|@material-ui|antd|@ant-design|@chakra-ui|@radix-ui|@\/components\/ui\/|shadcn)/i;
    expect(grepLines(banned)).toEqual([]);
    // TDS가 실제로 쓰이고 있어야 한다
    expect(grepLines(/from\s+["']@toss\/tds-mobile["']/).length).toBeGreaterThan(0);
  });

  it("AC-2: 외부 로그인·결제·광고 SDK import가 0건이다", () => {
    const banned =
      /(from\s+|import\s*\(|require\()\s*["'](stripe|@stripe|@tosspayments|@portone|iamport|firebase\/auth|@firebase\/auth|next-auth|kakao|@react-oauth|.*admob|.*google-?ads|react-adsense)/i;
    expect(grepLines(banned)).toEqual([]);
  });

  it("AC-2: 외부 분석 도구(GA·Amplitude·Mixpanel) import가 0건이다", () => {
    const banned =
      /(from\s+|import\s*\(|require\()\s*["'](react-ga|@amplitude|amplitude-js|mixpanel|firebase\/analytics)/i;
    expect(grepLines(banned)).toEqual([]);
  });

  it("'AI' 문구가 사용자 화면에 없다(생성형 AI 미사용 앱)", () => {
    // 주석 제외, 문자열·JSX 텍스트 안의 AI 단어
    const aiText = /(["'`>][^"'`<]*\bAI\b[^"'`<]*["'`<])/;
    expect(
      grepLines(aiText, { code: true, skip: new Set([...DEV_ONLY, "components/SummaryHero.tsx"]) }),
    ).toEqual([]);
    // 템플릿 SummaryHero의 AI 라벨(ai prop)을 켜는 화면이 없다
    expect(grepFiles(/<SummaryHero\b[^>]*\sai(\s|=|\/|>)/)).toEqual([]);
  });

  it("다이얼로그 버튼에 '취소' 라벨이 없다('닫기' 사용)", () => {
    expect(grepFiles(/<(ConfirmDialog\.CancelButton|AlertDialog\.AlertButton|CancelButton|AlertButton)\b[^>]*>\s*취소\s*</)).toEqual([]);
    expect(grepLines(/(cancelButton|closeButton)\s*[:=]\s*\{?\s*["'`]취소["'`]/, { code: true })).toEqual([]);
  });

  it("'설치'·'다운로드' 유도 문구가 0건이다", () => {
    expect(
      grepLines(/["'`>]\s*[^"'`<]*(앱\s*설치|설치하|다운로드)[^"'`<]*["'`<]/, { code: true, skip: DEV_ONLY }),
    ).toEqual([]);
  });

  it("Tailwind 여백 클래스(p-*/px-*/py-*/gap-*)가 0건이다", () => {
    expect(grepLines(/className=\{?["'`][^"'`]*\b(p|px|py|pt|pb|pl|pr|gap|m|mx|my)-\d/)).toEqual([]);
  });

  it("외부 URL로의 직접 이탈(window.location.href·window.open)이 0건이다", () => {
    expect(grepLines(/window\.open\(|window\.location\.href\s*=/, { code: true })).toEqual([]);
  });
});
