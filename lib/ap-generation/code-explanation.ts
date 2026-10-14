// AP Computer Science A: 선택지가 코드 블록(```)인 문항의 해설 정리(순수 함수).
// 파이프라인의 구조화 해설은 "The correct answer is ```\n코드\n```. 이유" 처럼 코드 펜스를 문장 한가운데에 둔다. 렌더러(render-learning-content)의 펜스는 줄 전체가 ``` 일 때만 코드 블록이므로
// 그대로 두면 학생 결과 화면에 백틱과 원문 코드(<=, >= 등)가 글자로 보인다. 펜스를 줄 단위로 옮겨 코드 블록으로 그리게 한다(문장 의미 변경 없음).
const BLOCK = "(```[^\\n`]*\\n(?:(?!```)[\\s\\S])*?\\n```)";

/** 코드 밖 문장 줄에서 맨몸 비교 연산자(<=, >=, 띄어 쓴 < >)를 한 줄 코드로 감싼다(수식·HTML 로 읽히지 않게). 펜스 안과 이미 백틱 안은 건드리지 않는다. */
function codeifyOperators(e: string): string {
  let open = false;
  return e.split("\n").map((ln) => {
    if (/^\s*```/.test(ln)) { open = !open; return ln; }
    if (open) return ln;
    return ln.replace(/(?<!`)(<=|>=)(?!`)/g, "`$1`").replace(/(?<=\s)([<>])(?=\s)/g, "`$1`");
  }).join("\n");
}

export function fenceCodeExplanation(e: string): string {
  const fenced = !e.includes("```") ? e : e
    .replace(new RegExp(`(^|\\n)The correct answer is ${BLOCK}\\.[ \\t]*`, "g"), "$1The correct answer is:\n$2\n")
    .replace(new RegExp(`(^|\\n)${BLOCK} is incorrect:[ \\t]*`, "g"), "$1An incorrect option:\n$2\n");
  return codeifyOperators(fenced);
}

/** 해설 안의 모든 펜스가 줄 전체(여는 줄 ```lang, 닫는 줄 ```)로만 쓰였는지. */
export function fencesOnOwnLines(e: string): boolean {
  let open = false;
  for (const ln of e.split("\n")) {
    if (!ln.includes("```")) continue;
    if (open) { if (!/^\s*```\s*$/.test(ln)) return false; open = false; }
    else { if (!/^\s*```[A-Za-z0-9_+-]*\s*$/.test(ln)) return false; open = true; }
  }
  return !open;
}
